'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import LoadingState from './LoadingState';
import useGoogleSheet from './useGoogleSheet';
import { loadStoredFilters, saveStoredFilters } from './filterStorage';
import { computeComplianceScore, findValue, normalizeLabel, parseDate, previousMonthKey, toDayKey, toDisplayString, toMonthKey } from './dashboardDataUtils';
import { saveDashboardScore } from './scoreCache';
import { type DashboardLang } from 'app/dashboard/i18n-copy';
import KpiCard from 'app/ui/KpiCard';
import ScoreBlock from 'app/ui/ScoreBlock';
import ExportButton from 'app/ui/ExportButton';
import EmptyState from 'app/ui/EmptyState';
import TrendChart from 'app/ui/TrendChart';
import HorizontalBarChart from 'app/ui/HorizontalBarChart';
import { DataTable, type Column } from 'app/ui/DataTable';
import Sparkline from 'app/ui/Sparkline';
import TrendIndicator from 'app/ui/TrendIndicator';
import InlineMonthPicker from 'app/ui/InlineMonthPicker';
import InlineDayPicker from 'app/ui/InlineDayPicker';
import MultiSelect from 'app/ui/MultiSelect';
import FilterBar from 'app/ui/FilterBar';
import DonutChart from 'app/ui/DonutChart';
import AlertHeatmap from 'app/ui/AlertHeatmap';
import {
  heading2, textSecondary, CHART_COLORS,
} from 'app/ui/design-tokens';
import { normalizeDrivingThresholds, thresholdEntryValue, type DrivingThresholds } from './drivingThresholds';
import { deriveSubPages, subPageBySlug } from './drivingSubPages';
import ThresholdSubPage from './ThresholdSubPage';
import { buildDriveHoursViolations, buildRestHoursViolations } from './violationBuilders';

type DashboardProps = {
  dashboardId: string;
  dashboardName: string;
  sheetId: string;
  sheetGid: string;
  dashboardNotes?: string | null;
  organizationName?: string | null;
  lang?: DashboardLang;
  allowedAlertTypes?: string[] | null;
  allowedRemarks?: string[] | null;
  drivingThresholds?: DrivingThresholds | null;
  lineChannels?: { id: number; name: string }[];
  defaultLineChannelId?: number | null;
  warnings?: Array<{ violationKey: string; sentAt: Date; channelName: string }>;
  isAdmin?: boolean;
};

type DrivingRow = {
  sourceRow: Record<string, unknown>;
  driver: string;
  vehicle: string;
  date: Date | null;
  loginAt: Date | null;
  logoutAt: Date | null;
  loginLocation: string;
  logoutLocation: string;
  driveHours: number;
  workingHours: number;
  restHours: number;
  distanceKm: number;
  status: string;
  fleet?: string;
};
type DriverAggregate = {
  driver: string;
  tripCount: number;
  totalDistanceKm: number;
  totalCntDrvDurationHours: number;
  avgDistancePerTrip: number;
  avgDurationPerTrip: number;
  monthlyDistances: number[];
};
type MonthlyTrendPoint = { monthKey: string; monthLabel: string; totalDistanceKm: number; totalCntDrvDurationHours: number; tripCount: number };

const parseNumber = (value: unknown) => {
  if (value == null || value === '') return 0;
  const cleaned = String(value).replace(/,/g, '').trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseDurationHours = (value: unknown) => {
  if (value == null || value === '') return 0;
  const raw = String(value).trim();
  if (!raw) return 0;
  if (raw.includes(':')) {
    const parts = raw.split(':').map((part) => Number(part));
    if (parts.some((part) => Number.isNaN(part))) return 0;
    if (parts.length === 3) return parts[0] + parts[1] / 60 + parts[2] / 3600;
    if (parts.length === 2) return parts[0] + parts[1] / 60;
  }
  return parseNumber(raw);
};

const formatHours = (hours: number) => `${hours.toFixed(2)} h`;
const formatDistance = (km: number) => `${km.toFixed(1)} km`;
const getMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const getMonthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

export default function DrivingDashboard({
  dashboardId,
  dashboardName,
  sheetId,
  sheetGid,
  dashboardNotes,
  organizationName,
  lang = 'en',
  drivingThresholds: drivingThresholdsProp,
  lineChannels: _lineChannels = [],
  defaultLineChannelId: _defaultLineChannelId = null,
  warnings = [],
  isAdmin = false,
}: DashboardProps) {
  const thresholds = useMemo(
    () => normalizeDrivingThresholds(drivingThresholdsProp),
    [drivingThresholdsProp],
  );
  const subPages = useMemo(() => deriveSubPages(thresholds, lang), [thresholds, lang]);
  const searchParams = useSearchParams();
  const activeSubPage = useMemo(
    () => subPageBySlug(subPages, searchParams.get('tab')),
    [subPages, searchParams],
  );
  const pathname = usePathname();
  const tabHref = useCallback(
    (slug: string) => {
      const usp = new URLSearchParams(searchParams.toString());
      usp.set('tab', slug);
      return `${pathname}?${usp.toString()}`;
    },
    [pathname, searchParams],
  );
  const driveMaxHours = thresholds.driveHours[0]
    ? thresholdEntryValue(thresholds.driveHours[0]) : Infinity;
  const restMinHours = thresholds.restHours[0]
    ? thresholdEntryValue(thresholds.restHours[0]) : 0;
  const workingMaxHours = Infinity;
  const { rows, columns: sheetColumns, loading, error, lastUpdated, refresh } = useGoogleSheet({
    sheetId,
    gid: sheetGid,
  });
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const [driverFilters, setDriverFilters] = useState<string[]>([]);
  const [vehicleFilters, setVehicleFilters] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [dayFilters, setDayFilters] = useState<string[]>([]);

  const normalizedOrganizationName = useMemo(() => (organizationName ? normalizeLabel(organizationName) : null), [organizationName]);
  const storageKey = useMemo(() => `${dashboardId}-driving`, [dashboardId]);
  const didSetDefaultMonth = useRef(false);
  const defaultMonthKey = useMemo(() => previousMonthKey(), []);

  // ── Load persisted filters ──────────────────────────────────────────────
  useEffect(() => {
    const stored = loadStoredFilters<{
      selectedMonth?: string;
      dayFilters?: string[];
      driverFilters?: string[];
      vehicleFilters?: string[];
    }>(storageKey);
    if (!stored) return;
    didSetDefaultMonth.current = true;
    const frame = requestAnimationFrame(() => {
      if (typeof stored.selectedMonth === 'string') setSelectedMonth(stored.selectedMonth);
      if (Array.isArray(stored.dayFilters)) setDayFilters(stored.dayFilters.filter((v) => typeof v === 'string'));
      if (Array.isArray(stored.driverFilters)) setDriverFilters(stored.driverFilters.filter((v) => typeof v === 'string'));
      if (Array.isArray(stored.vehicleFilters)) setVehicleFilters(stored.vehicleFilters.filter((v) => typeof v === 'string'));
    });
    return () => cancelAnimationFrame(frame);
  }, [storageKey]);

  // ── Persist filters ─────────────────────────────────────────────────────
  useEffect(() => {
    saveStoredFilters(storageKey, {
      selectedMonth,
      dayFilters,
      driverFilters,
      vehicleFilters,
    });
  }, [storageKey, selectedMonth, dayFilters, driverFilters, vehicleFilters]);

  const drivingRows = useMemo<DrivingRow[]>(() => rows.map((row) => ({
    sourceRow: row,
    driver: toDisplayString(findValue(row, ['Driver Name'])),
    vehicle: toDisplayString(findValue(row, ['Vehicle No', 'Vehicle No TH'])),
    date: parseDate(findValue(row, ['DateTime', 'Login Time', 'Date', 'Start Time'])),
    loginAt: parseDate(findValue(row, ['Login Time', 'Start Time', 'Login DateTime'])),
    logoutAt: parseDate(findValue(row, ['Logout Time', 'End Time', 'Logout DateTime'])),
    loginLocation: toDisplayString(findValue(row, ['Login Location'])),
    logoutLocation: toDisplayString(findValue(row, ['Logout Location'])),
    driveHours: parseDurationHours(findValue(row, ['DriveHrs', 'DriveHrs duration', 'Cnt Drv Hr', 'Cnt Drv duration'])),
    restHours: parseDurationHours(findValue(row, [
      'Rest Time', 'Rest Hr', 'RestHr', 'Rest Hour', 'Rest Hours', 'Rest duration', 'RestHrs', 'RestHrs duration',
    ])),
    workingHours: parseDurationHours(findValue(row, [
      'Working Hr', 'Working Hour', 'Working Hours',
      'Work Hr', 'Work Hour', 'Work Hours', 'Working Time', 'Work Time', 'Total Working',
      'WorkHrs', 'WorkHrs duration',
    ])),
    distanceKm: parseNumber(findValue(row, ['Distance', 'Distance KM', 'Distance(KM)'])),
    status: toDisplayString(findValue(row, ['Status'])).toUpperCase(),
    fleet: toDisplayString(findValue(row, ['Fleet'])),
  })).filter((row) => {
    if (!normalizedOrganizationName) return true;
    return normalizeLabel(row.fleet ?? '') === normalizedOrganizationName;
  }).map((row) => ({
    sourceRow: row.sourceRow,
    driver: row.driver,
    vehicle: row.vehicle,
    date: row.date,
    loginAt: row.loginAt,
    logoutAt: row.logoutAt,
    loginLocation: row.loginLocation,
    logoutLocation: row.logoutLocation,
    driveHours: row.driveHours,
    restHours: row.restHours,
    workingHours: row.workingHours,
    distanceKm: row.distanceKm,
    status: row.status,
  })), [rows, normalizedOrganizationName]);

  const driverOptions = useMemo(() => Array.from(new Set(drivingRows.map((r) => r.driver).filter((n) => n !== '—'))).sort(), [drivingRows]);
  const vehicleOptions = useMemo(() => Array.from(new Set(drivingRows.map((r) => r.vehicle).filter((n) => n !== '—'))).sort(), [drivingRows]);

  const filteredRows = useMemo(() => {
    return drivingRows.filter((row) => {
      if (driverFilters.length > 0 && !driverFilters.includes(row.driver)) return false;
      if (vehicleFilters.length > 0 && !vehicleFilters.includes(row.vehicle)) return false;
      if (selectedMonth) {
        if (!row.date) return false;
        const rowMonth = getMonthKey(row.date);
        if (rowMonth !== selectedMonth) return false;
      }
      if (dayFilters.length > 0 && row.date) {
        if (!dayFilters.includes(toDayKey(row.date))) return false;
      }
      return true;
    });
  }, [drivingRows, driverFilters, vehicleFilters, selectedMonth, dayFilters]);

  const warningsMap = useMemo(() => {
    const m = new Map<string, { sentAt: Date; channelName: string }>();
    for (const w of warnings ?? []) m.set(w.violationKey, { sentAt: w.sentAt, channelName: w.channelName });
    return m;
  }, [warnings]);

  const driveHrsViolations = useMemo(() => {
    if (activeSubPage.kind !== 'drive_hrs') return [];
    return buildDriveHoursViolations(
      filteredRows,
      { threshold: activeSubPage.threshold, label: activeSubPage.label },
      warningsMap,
    );
  }, [activeSubPage, filteredRows, warningsMap]);

  const restHrsViolations = useMemo(() => {
    if (activeSubPage.kind !== 'rest_hrs') return [];
    return buildRestHoursViolations(
      filteredRows,
      { threshold: activeSubPage.threshold, label: activeSubPage.label },
      warningsMap,
    );
  }, [activeSubPage, filteredRows, warningsMap]);

  // Active filter count for DashboardShell badge
  const activeFilterCount = useMemo(
    () => [driverFilters.length > 0, vehicleFilters.length > 0, selectedMonth, dayFilters.length > 0].filter(Boolean).length,
    [driverFilters, vehicleFilters, selectedMonth, dayFilters],
  );

  // Date range string for ExportButton
  const dateRange = useMemo(() => selectedMonth || undefined, [selectedMonth]);

  // All months in filtered data (sorted)
  const allMonthKeys = useMemo(() => {
    const keys = new Set<string>();
    filteredRows.forEach((row) => { if (row.date) keys.add(getMonthKey(row.date)); });
    return Array.from(keys).sort();
  }, [filteredRows]);

  // All months in raw data (for default month when no filter)
  const allMonthsFromData = useMemo(() => {
    const keys = new Set<string>();
    drivingRows.forEach((row) => { if (row.date) keys.add(getMonthKey(row.date)); });
    return Array.from(keys).sort();
  }, [drivingRows]);

  // ── Default to current month when no stored filters ──────────────────────
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (didSetDefaultMonth.current) return;
      if (allMonthsFromData.length === 0) return;
      if (selectedMonth !== '') {
        didSetDefaultMonth.current = true;
        return;
      }
      didSetDefaultMonth.current = true;
      if (allMonthsFromData.includes(defaultMonthKey)) {
        setSelectedMonth(defaultMonthKey);
        setDayFilters([]);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [allMonthsFromData, defaultMonthKey, selectedMonth]);

  const aggregates = useMemo<DriverAggregate[]>(() => {
    const totals = new Map<string, { driver: string; tripCount: number; totalDistanceKm: number; totalCntDrvDurationHours: number; monthlyMap: Map<string, number> }>();
    filteredRows.forEach((row) => {
      const c = totals.get(row.driver) ?? { driver: row.driver, tripCount: 0, totalDistanceKm: 0, totalCntDrvDurationHours: 0, monthlyMap: new Map() };
      c.tripCount += 1;
      c.totalDistanceKm += row.distanceKm;
      c.totalCntDrvDurationHours += row.driveHours;
      if (row.date) {
        const mk = getMonthKey(row.date);
        c.monthlyMap.set(mk, (c.monthlyMap.get(mk) ?? 0) + row.distanceKm);
      }
      totals.set(row.driver, c);
    });
    return Array.from(totals.values())
      .map((c) => ({
        driver: c.driver,
        tripCount: c.tripCount,
        totalDistanceKm: c.totalDistanceKm,
        totalCntDrvDurationHours: c.totalCntDrvDurationHours,
        avgDistancePerTrip: c.tripCount > 0 ? c.totalDistanceKm / c.tripCount : 0,
        avgDurationPerTrip: c.tripCount > 0 ? c.totalCntDrvDurationHours / c.tripCount : 0,
        // sparkline: monthly distance in order of allMonthKeys
        monthlyDistances: allMonthKeys.map((mk) => c.monthlyMap.get(mk) ?? 0),
      }))
      .sort((a, b) => b.totalDistanceKm - a.totalDistanceKm);
  }, [filteredRows, allMonthKeys]);

  // KPI trend: split filteredRows by date into first/second half
  const kpiTrend = useMemo(() => {
    const dated = filteredRows.filter((r) => r.date).sort((a, b) => a.date!.getTime() - b.date!.getTime());
    if (dated.length < 4) return null;
    const half = Math.floor(dated.length / 2);
    const first = dated.slice(0, half);
    const second = dated.slice(half);
    return {
      tripsFirst: first.length,
      tripsSecond: second.length,
      distFirst: first.reduce((s, r) => s + r.distanceKm, 0),
      distSecond: second.reduce((s, r) => s + r.distanceKm, 0),
      durFirst: first.reduce((s, r) => s + r.driveHours, 0),
      durSecond: second.reduce((s, r) => s + r.driveHours, 0),
    };
  }, [filteredRows]);

  const kpis = useMemo(() => {
    const totalTrips = filteredRows.length;
    const totalDistanceKm = filteredRows.reduce((s, r) => s + r.distanceKm, 0);
    const totalCntDrvDurationHours = filteredRows.reduce((s, r) => s + r.driveHours, 0);
    const totalRestHours = filteredRows.reduce((s, r) => s + r.restHours, 0);
    return {
      totalTrips,
      totalDistanceKm,
      totalCntDrvDurationHours,
      totalRestHours,
      avgDistancePerTrip: totalTrips > 0 ? totalDistanceKm / totalTrips : 0,
      avgCntDrvPerTrip: totalTrips > 0 ? totalCntDrvDurationHours / totalTrips : 0,
      avgRestPerTrip: totalTrips > 0 ? totalRestHours / totalTrips : 0,
    };
  }, [filteredRows]);

  const monthlyTrend = useMemo<MonthlyTrendPoint[]>(() => {
    const map = new Map<string, MonthlyTrendPoint>();
    filteredRows.forEach((row) => {
      if (!row.date) return;
      const mk = getMonthKey(row.date);
      const c = map.get(mk) ?? { monthKey: mk, monthLabel: getMonthLabel(mk), totalDistanceKm: 0, totalCntDrvDurationHours: 0, tripCount: 0 };
      c.totalDistanceKm += row.distanceKm; c.totalCntDrvDurationHours += row.driveHours; c.tripCount += 1;
      map.set(mk, c);
    });
    return Array.from(map.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey)).slice(-8);
  }, [filteredRows]);

  // --- Fleet counts ---
  const fleetCounts = useMemo(() => ({
    uniqueDrivers: new Set(filteredRows.map((r) => r.driver).filter((d) => d !== '—')).size,
    uniqueVehicles: new Set(filteredRows.map((r) => r.vehicle).filter((v) => v !== '—')).size,
  }), [filteredRows]);

  // --- Vehicle aggregates ---
  type VehicleAggregate = { vehicle: string; tripCount: number; totalDistanceKm: number; totalCntDrvDurationHours: number; driverCount: number };
  const vehicleAggregates = useMemo<VehicleAggregate[]>(() => {
    const map = new Map<string, { vehicle: string; tripCount: number; totalDistanceKm: number; totalCntDrvDurationHours: number; drivers: Set<string> }>();
    filteredRows.forEach((row) => {
      if (row.vehicle === '—') return;
      const c = map.get(row.vehicle) ?? { vehicle: row.vehicle, tripCount: 0, totalDistanceKm: 0, totalCntDrvDurationHours: 0, drivers: new Set<string>() };
      c.tripCount += 1;
      c.totalDistanceKm += row.distanceKm;
      c.totalCntDrvDurationHours += row.driveHours;
      if (row.driver !== '—') c.drivers.add(row.driver);
      map.set(row.vehicle, c);
    });
    return Array.from(map.values())
      .map((c) => ({ vehicle: c.vehicle, tripCount: c.tripCount, totalDistanceKm: c.totalDistanceKm, totalCntDrvDurationHours: c.totalCntDrvDurationHours, driverCount: c.drivers.size }))
      .sort((a, b) => b.totalDistanceKm - a.totalDistanceKm);
  }, [filteredRows]);

  // --- Donut chart data ---
  const tripsByDriverDonut = useMemo(() => {
    const sorted = [...aggregates].sort((a, b) => b.tripCount - a.tripCount);
    const top = sorted.slice(0, 6);
    const rest = sorted.slice(6);
    const result = top.map((r) => ({ label: r.driver, value: r.tripCount }));
    if (rest.length > 0) result.push({ label: lang === 'th' ? 'อื่นๆ' : 'Others', value: rest.reduce((s, r) => s + r.tripCount, 0) });
    return result;
  }, [aggregates, lang]);

  const distByVehicleDonut = useMemo(() => {
    const sorted = [...vehicleAggregates].sort((a, b) => b.totalDistanceKm - a.totalDistanceKm);
    const top = sorted.slice(0, 6);
    const rest = sorted.slice(6);
    const result = top.map((r) => ({ label: r.vehicle, value: Math.round(r.totalDistanceKm) }));
    if (rest.length > 0) result.push({ label: lang === 'th' ? 'อื่นๆ' : 'Others', value: Math.round(rest.reduce((s, r) => s + r.totalDistanceKm, 0)) });
    return result;
  }, [vehicleAggregates, lang]);

  // --- Heatmap dates (trip timestamps) ---
  const heatmapDates = useMemo(() => filteredRows.filter((r) => r.date).map((r) => r.date!), [filteredRows]);

  // --- Top 5 drivers by total driving hours (for heatmap companion) ---
  const topDriversByHours = useMemo(() => {
    return [...aggregates]
      .sort((a, b) => b.totalCntDrvDurationHours - a.totalCntDrvDurationHours)
      .slice(0, 5)
      .map((a) => ({ label: a.driver, value: Math.round(a.totalCntDrvDurationHours * 10) / 10 }));
  }, [aggregates]);

  // --- Violation reports ---
  type ViolationRow = {
    driver: string;
    vehicle: string;
    date: string;
    cntDrvHours: number;
    restHours: number;
    workingHours: number;
    type: 'cnt_drv' | 'rest_hr' | 'working_hr';
  };
  const violations = useMemo<ViolationRow[]>(() => {
    const result: ViolationRow[] = [];
    filteredRows.forEach((row) => {
      const dateStr = row.date ? row.date.toLocaleDateString('en-GB') : '—';
      if (row.driveHours > driveMaxHours) {
        result.push({
          driver: row.driver,
          vehicle: row.vehicle,
          date: dateStr,
          cntDrvHours: row.driveHours,
          restHours: row.restHours,
          workingHours: row.workingHours,
          type: 'cnt_drv',
        });
      }
      if (row.restHours > 0 && row.restHours < restMinHours) {
        result.push({
          driver: row.driver,
          vehicle: row.vehicle,
          date: dateStr,
          cntDrvHours: row.driveHours,
          restHours: row.restHours,
          workingHours: row.workingHours,
          type: 'rest_hr',
        });
      }
      if (row.workingHours > 0 && row.workingHours > workingMaxHours) {
        result.push({
          driver: row.driver,
          vehicle: row.vehicle,
          date: dateStr,
          cntDrvHours: row.driveHours,
          restHours: row.restHours,
          workingHours: row.workingHours,
          type: 'working_hr',
        });
      }
    });
    const typeOrder = { cnt_drv: 0, rest_hr: 1, working_hr: 2 } as const;
    return result.sort((a, b) => {
      if (a.type !== b.type) return typeOrder[a.type] - typeOrder[b.type];
      return a.driver.localeCompare(b.driver);
    });
  }, [filteredRows, driveMaxHours, restMinHours, workingMaxHours]);

  const cntDrvViolations = useMemo(() => violations.filter((v) => v.type === 'cnt_drv'), [violations]);
  const restHrViolations = useMemo(() => violations.filter((v) => v.type === 'rest_hr'), [violations]);
  const workingHrViolations = useMemo(() => violations.filter((v) => v.type === 'working_hr'), [violations]);

  // --- Driving safety score (cached for main dashboard listing) ---
  const complianceScore = useMemo(
    () =>
      computeComplianceScore(
        cntDrvViolations.length + restHrViolations.length + workingHrViolations.length,
        Math.max(1, filteredRows.length),
      ),
    [cntDrvViolations.length, restHrViolations.length, workingHrViolations.length, filteredRows.length],
  );

  useEffect(() => {
    if (loading) return;
    const violationCount =
      cntDrvViolations.length + restHrViolations.length + workingHrViolations.length;
    saveDashboardScore(dashboardId, complianceScore, violationCount);
  }, [
    dashboardId,
    loading,
    complianceScore,
    cntDrvViolations.length,
    restHrViolations.length,
    workingHrViolations.length,
  ]);

  // --- Per-driver sorted by cnt drv hours (for requested bar+line chart) ---
  const driversByCntDrv = useMemo(() =>
    [...aggregates].sort((a, b) => b.totalCntDrvDurationHours - a.totalCntDrvDurationHours).slice(0, 10),
    [aggregates],
  );

  // --- Per-driver rest hours vs cnt drv hours ---
  const restVsCntDrvByDriver = useMemo(() => {
    const map = new Map<string, { driver: string; totalRestHours: number; totalCntDrvHours: number; tripCount: number }>();
    filteredRows.forEach((row) => {
      if (row.driver === '—') return;
      const c = map.get(row.driver) ?? { driver: row.driver, totalRestHours: 0, totalCntDrvHours: 0, tripCount: 0 };
      c.totalRestHours += row.restHours;
      c.totalCntDrvHours += row.driveHours;
      c.tripCount += 1;
      map.set(row.driver, c);
    });
    return Array.from(map.values()).sort((a, b) => b.totalCntDrvHours - a.totalCntDrvHours).slice(0, 10);
  }, [filteredRows]);

  // --- Driving hours donut chart ---
  const drvHoursDonut = useMemo(() => {
    const sorted = [...aggregates].sort((a, b) => b.totalCntDrvDurationHours - a.totalCntDrvDurationHours);
    const top = sorted.slice(0, 6);
    const rest = sorted.slice(6);
    const result = top.map((r) => ({ label: r.driver, value: Math.round(r.totalCntDrvDurationHours * 100) / 100 }));
    if (rest.length > 0) result.push({ label: lang === 'th' ? 'อื่นๆ' : 'Others', value: Math.round(rest.reduce((s, r) => s + r.totalCntDrvDurationHours, 0) * 100) / 100 });
    return result;
  }, [aggregates, lang]);

  const violationTableColumns = useMemo<Column<ViolationRow>[]>(() => {
    const maxCnt = driveMaxHours;
    const minRest = restMinHours;
    const maxWork = workingMaxHours;
    return [
      { key: 'driver', label: lang === 'th' ? 'คนขับ' : 'Driver', sortable: true, stickyLeft: true },
      { key: 'vehicle', label: lang === 'th' ? 'ยานพาหนะ' : 'Vehicle', sortable: true },
      { key: 'date', label: lang === 'th' ? 'วันที่' : 'Date', sortable: true },
      {
        key: 'cntDrvHours',
        label: lang === 'th' ? 'ขับต่อเนื่อง' : 'Cnt Drv',
        sortable: true,
        render: (v) => {
          const hours = Number(v);
          return (
            <span className={hours > maxCnt ? 'font-semibold text-red-600 dark:text-red-400' : ''}>{formatHours(hours)}</span>
          );
        },
      },
      {
        key: 'restHours',
        label: lang === 'th' ? 'ชั่วโมงพัก' : 'Rest Hr',
        sortable: true,
        render: (v) => {
          const hours = Number(v);
          if (hours === 0) return <span className="text-zinc-400">—</span>;
          return (
            <span className={hours < minRest ? 'font-semibold text-red-600 dark:text-red-400' : ''}>{formatHours(hours)}</span>
          );
        },
      },
      {
        key: 'workingHours',
        label: lang === 'th' ? 'ชม.ทำงาน' : 'Working Hr',
        sortable: true,
        render: (v) => {
          const hours = Number(v);
          if (hours === 0) return <span className="text-zinc-400">—</span>;
          return (
            <span className={hours > maxWork ? 'font-semibold text-red-600 dark:text-red-400' : ''}>{formatHours(hours)}</span>
          );
        },
      },
      {
        key: 'type',
        label: lang === 'th' ? 'ประเภท' : 'Violation',
        sortable: true,
        render: (v) => {
          if (v === 'cnt_drv') {
            return (
              <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950 dark:text-red-400">
                Cnt Drv &gt; {maxCnt}h
              </span>
            );
          }
          if (v === 'rest_hr') {
            return (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                Rest &lt; {minRest}h
              </span>
            );
          }
          return (
            <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
              Work &gt; {maxWork}h
            </span>
          );
        },
      },
    ];
  }, [lang, driveMaxHours, restMinHours, workingMaxHours]);

  // --- Vehicle table columns ---
  const vehicleTableColumns = useMemo<Column<VehicleAggregate>[]>(() => [
    { key: 'vehicle', label: lang === 'th' ? 'ยานพาหนะ' : 'Vehicle', sortable: true, stickyLeft: true },
    { key: 'tripCount', label: lang === 'th' ? 'ทริป' : 'Trips', sortable: true },
    { key: 'totalDistanceKm', label: lang === 'th' ? 'ระยะทาง' : 'Distance', sortable: true, render: (v) => formatDistance(Number(v)) },
    { key: 'totalCntDrvDurationHours', label: lang === 'th' ? 'ระยะเวลา' : 'Duration', sortable: true, render: (v) => formatHours(Number(v)) },
    { key: 'driverCount', label: lang === 'th' ? 'คนขับ' : 'Drivers', sortable: true },
  ], [lang]);

  const exportData = useMemo(() => aggregates.map((r) => ({
    Driver: r.driver,
    Trips: r.tripCount,
    'Duration (h)': r.totalCntDrvDurationHours.toFixed(2),
    'Distance (km)': r.totalDistanceKm.toFixed(1),
    'Avg Distance/Trip (km)': r.avgDistancePerTrip.toFixed(1),
    'Avg Duration/Trip (h)': r.avgDurationPerTrip.toFixed(2),
  })), [aggregates]);

  // DataTable columns
  const tableColumns = useMemo<Column<DriverAggregate>[]>(() => [
    { key: 'driver', label: lang === 'th' ? 'คนขับ' : 'Driver', sortable: true, stickyLeft: true },
    { key: 'tripCount', label: lang === 'th' ? 'ทริป' : 'Trips', sortable: true },
    {
      key: 'totalDistanceKm',
      label: lang === 'th' ? 'ระยะทาง' : 'Distance',
      sortable: true,
      render: (v) => formatDistance(Number(v)),
    },
    {
      key: 'totalCntDrvDurationHours',
      label: lang === 'th' ? 'ระยะเวลา' : 'Duration',
      sortable: true,
      render: (v) => formatHours(Number(v)),
    },
    {
      key: 'avgDistancePerTrip',
      label: lang === 'th' ? 'เฉลี่ยระยะทาง/ทริป' : 'Avg Dist/Trip',
      sortable: true,
      render: (v) => formatDistance(Number(v)),
    },
    {
      key: 'avgDurationPerTrip',
      label: lang === 'th' ? 'เฉลี่ยเวลา/ทริป' : 'Avg Dur/Trip',
      sortable: true,
      render: (v) => formatHours(Number(v)),
    },
    {
      key: 'monthlyDistances',
      label: lang === 'th' ? 'แนวโน้มรายเดือน' : 'Monthly Trend',
      sortable: false,
      render: (v) => {
        const data = v as number[];
        return <Sparkline data={data} width={80} height={24} />;
      },
    },
  ], [lang]);

  if (loading) {
    return (
      <DashboardShell title={dashboardName} subtitle={lang === 'th' ? 'แดชบอร์ดการขับขี่' : 'Driving dashboard'} lang={lang} lastUpdated={lastUpdated} notes={dashboardNotes}>
        <LoadingState
          lang={lang}
          message={lang === 'th' ? 'กำลังโหลด…' : 'Loading driving dashboard'}
          detail="Fetching driving data."
        />
      </DashboardShell>
    );
  }

  if (error) {
    return (
      <DashboardShell title={dashboardName} subtitle={lang === 'th' ? 'แดชบอร์ดการขับขี่' : 'Driving dashboard'} lang={lang} lastUpdated={lastUpdated} notes={dashboardNotes}>
        <LoadingState lang={lang} error={error} onRetry={refresh} />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title={dashboardName}
      subtitle={lang === 'th' ? 'แดชบอร์ดการขับขี่' : 'Driving dashboard'}
      lang={lang}
      lastUpdated={lastUpdated}
      notes={dashboardNotes}
      isStale={lastUpdated ? nowTick - lastUpdated.getTime() > 5 * 60 * 1000 : false}
      activeFilterCount={activeFilterCount}
      dashboardId={dashboardId}
      isAdmin={isAdmin}
      actions={
        <ExportButton
          data={exportData}
          fullSheetExport={{ rows, filteredRows: filteredRows.map((r) => r.sourceRow), columns: sheetColumns }}
          dashboardName={dashboardName}
          dateRange={dateRange}
          filename={`${dashboardName}-driving`}
          settingsStorageKey={`driving-${dashboardId}`}
          lang={lang}
          fullSheetHint={
            lang === 'th'
              ? 'ใช้ตัวกรองเดียวกับตารางนี้ แต่ส่งออกแถวดิบจากชีตหนึ่งแถวต่อทริป/เหตุการณ์ ไม่ใช่หนึ่งแถวต่อแถวสรุปคนขับ — รวมทุกคอลัมน์ในชีต'
              : 'Same filters as this table, but exports raw spreadsheet rows (one row per trip/event), not one row per aggregated driver summary. Includes every sheet column.'
          }
          columns={[
            { key: 'Driver', label: lang === 'th' ? 'คนขับ' : 'Driver' },
            { key: 'Trips', label: lang === 'th' ? 'ทริป' : 'Trips' },
            { key: 'Duration (h)', label: lang === 'th' ? 'ระยะเวลา (ชม.)' : 'Duration (h)' },
            { key: 'Distance (km)', label: lang === 'th' ? 'ระยะทาง (กม.)' : 'Distance (km)' },
            { key: 'Avg Distance/Trip (km)', label: lang === 'th' ? 'เฉลี่ยระยะทาง/ทริป (กม.)' : 'Avg distance/trip (km)' },
            { key: 'Avg Duration/Trip (h)', label: lang === 'th' ? 'เฉลี่ยเวลา/ทริป (ชม.)' : 'Avg duration/trip (h)' },
          ]}
          label={lang === 'th' ? 'ส่งออก CSV' : 'Export CSV'}
        />
      }
    >

      <nav className="mb-6 -mt-2 flex gap-2 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">
        {subPages.map((p) => (
          <Link
            key={p.slug}
            href={tabHref(p.slug)}
            replace
            className={[
              'shrink-0 border-b-2 px-3 py-2 text-sm font-medium',
              p.slug === activeSubPage.slug
                ? 'border-red-500 text-red-600 dark:text-red-400'
                : 'border-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
            ].join(' ')}
          >
            {p.label}
          </Link>
        ))}
      </nav>

      {activeSubPage.kind === 'overview' && (
        <>

      {/* Filters */}
      <FilterBar>
        <InlineMonthPicker
          value={selectedMonth}
          onChange={(v) => {
            setSelectedMonth(v as string);
            setDayFilters([]);
          }}
          lang={lang}
        />
        {selectedMonth && (
          <InlineDayPicker
            monthKey={selectedMonth}
            value={dayFilters}
            onChange={(v) => setDayFilters(v as string[])}
            multi
            lang={lang}
          />
        )}
        <MultiSelect
          label={lang === 'th' ? 'คนขับ' : 'drivers'}
          options={driverOptions}
          selected={driverFilters}
          onChange={setDriverFilters}
          lang={lang}
        />
        <MultiSelect
          label={lang === 'th' ? 'ยานพาหนะ' : 'vehicles'}
          options={vehicleOptions}
          selected={vehicleFilters}
          onChange={setVehicleFilters}
          lang={lang}
        />
        {(selectedMonth || dayFilters.length > 0 || driverFilters.length > 0 || vehicleFilters.length > 0) && (
          <button
            type="button"
            onClick={() => { setSelectedMonth(''); setDayFilters([]); setDriverFilters([]); setVehicleFilters([]); }}
            className="ml-auto text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            {lang === 'th' ? 'รีเซ็ต' : 'Reset'}
          </button>
        )}
      </FilterBar>

      {/* ═══════════════ DRIVING SAFETY ═══════════════ */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-red-400/50 to-transparent dark:via-red-600/30" />
        <svg width="6" height="6" viewBox="0 0 6 6" className="shrink-0 text-red-400/50" aria-hidden="true"><polygon points="3,0 6,3 3,6 0,3" fill="currentColor" /></svg>
        <h2 className="text-xs font-bold uppercase tracking-widest text-red-600 dark:text-red-400">
          {lang === 'th' ? 'ความปลอดภัยการขับขี่' : 'Driving safety'}
        </h2>
        <svg width="6" height="6" viewBox="0 0 6 6" className="shrink-0 text-red-400/50" aria-hidden="true"><polygon points="3,0 6,3 3,6 0,3" fill="currentColor" /></svg>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-red-400/50 to-transparent dark:via-red-600/30" />
      </div>

      {/* Driving safety score — prominent block */}
      <ScoreBlock
        score={complianceScore}
        label={lang === 'th' ? 'คะแนนความปลอดภัยการขับขี่' : 'Driving safety score'}
        tooltip={lang === 'th'
          ? `คะแนน (0–100): คำนวณจากการฝ่าฝืนต่อทริป — ขับต่อเนื่องเกิน ${driveMaxHours} ชม. พักต่ำกว่า ${restMinHours} ชม. ชม.ทำงานเกิน ${workingMaxHours} ชม. (ตามที่ตั้งในแอดมิน)`
          : `Score (0–100): Violations per trip vs your admin thresholds — cnt drv > ${driveMaxHours}h, rest < ${restMinHours}h, working > ${workingMaxHours}h.`}
        detail={`${cntDrvViolations.length + restHrViolations.length + workingHrViolations.length} ${lang === 'th' ? 'การฝ่าฝืน' : 'violations'} · ${filteredRows.length} ${lang === 'th' ? 'ทริป' : 'trips'}`}
      />

      {/* Safety KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label={lang === 'th' ? 'ชม.ขับต่อเนื่องรวม' : 'Total Cnt Drv Hr'}
          value={formatHours(kpis.totalCntDrvDurationHours)}
          accentColor="#DC2626"
        >
          {kpiTrend && (
            <TrendIndicator
              current={kpiTrend.durSecond}
              previous={kpiTrend.durFirst}
              invertColor
              suffix={lang === 'th' ? 'vs ช่วงก่อน' : 'vs prior'}
            />
          )}
        </KpiCard>
        <KpiCard
          label={lang === 'th' ? 'เฉลี่ย ชม.ขับ/ทริป' : 'Avg Cnt Drv / trip'}
          value={formatHours(kpis.avgCntDrvPerTrip)}
          accentColor="#B91C1C"
        />
        <KpiCard
          label={lang === 'th' ? `ขับต่อเนื่อง > ${driveMaxHours} ชม.` : `Cnt Drv > ${driveMaxHours} hrs`}
          value={cntDrvViolations.length}
          accentColor={cntDrvViolations.length > 0 ? '#ef4444' : '#10b981'}
        />
        <KpiCard
          label={lang === 'th' ? `พักผ่อน < ${restMinHours} ชม.` : `Rest < ${restMinHours} hrs`}
          value={restHrViolations.length}
          accentColor={restHrViolations.length > 0 ? '#f59e0b' : '#10b981'}
        />
        <KpiCard
          label={lang === 'th' ? `ชม.ทำงาน > ${workingMaxHours} ชม.` : `Working > ${workingMaxHours} hrs`}
          value={workingHrViolations.length}
          accentColor={workingHrViolations.length > 0 ? '#8b5cf6' : '#10b981'}
        />
      </div>

      {/* Hero: Cnt Drv Hr vs Distance by driver (dual-axis) */}
      <section className={dashboardSectionClass}>
        <h2 className={heading2}>{lang === 'th' ? 'ชม.ขับต่อเนื่อง vs ระยะทาง (ตามคนขับ)' : 'Cnt Drv Hr vs Distance (by driver)'}</h2>
        <p className={`mt-1 ${textSecondary}`}>{lang === 'th' ? 'เรียงตามชั่วโมงขับต่อเนื่องสูงสุด — แท่ง = ชม.ขับ, เส้น = ระยะทาง' : 'Sorted by highest continuous driving hours — bars = drv hours, line = distance.'}</p>
        {driversByCntDrv.length === 0 ? (
          <div className="mt-4"><EmptyState title="No driver data" /></div>
        ) : (
          <TrendChart
            className="mt-4"
            mode="dual-axis"
            height={300}
            data={driversByCntDrv.map((d) => ({
              label: d.driver,
              values: {
                [lang === 'th' ? 'ชม.ขับต่อเนื่อง' : 'Cnt Drv Hr']: Math.round(d.totalCntDrvDurationHours * 100) / 100,
                [lang === 'th' ? 'ระยะทาง (km)' : 'Distance (km)']: Math.round(d.totalDistanceKm * 10) / 10,
              },
            }))}
            ariaLabel={lang === 'th' ? 'ชม.ขับต่อเนื่อง vs ระยะทาง' : 'Continuous driving hours vs distance by driver'}
            xAxisCategoryMode
          />
        )}
      </section>

      {/* 2-col: Rest vs Cnt Drv bar chart | Driving Hours donut */}
      <div className="grid gap-6 lg:grid-cols-5">
        <section className={`${dashboardSectionClass} lg:col-span-3`}>
          <h2 className={heading2}>{lang === 'th' ? 'ชม.พัก vs ชม.ขับ (ตามคนขับ)' : 'Rest Hr vs Cnt Drv Hr (by driver)'}</h2>
          <p className={`mt-1 ${textSecondary}`}>{lang === 'th' ? 'เปรียบเทียบชั่วโมงพักผ่อนและขับต่อเนื่อง' : 'Compare rest hours against continuous driving hours per driver.'}</p>
          {restVsCntDrvByDriver.length === 0 ? (
            <div className="mt-4"><EmptyState title="No data" /></div>
          ) : (
            <TrendChart
              className="mt-4"
              mode="bar"
              height={300}
              data={restVsCntDrvByDriver.map((d) => ({
                label: d.driver,
                values: {
                  [lang === 'th' ? 'ชม.ขับต่อเนื่อง' : 'Cnt Drv Hr']: Math.round(d.totalCntDrvHours * 100) / 100,
                  [lang === 'th' ? 'ชม.พักผ่อน' : 'Rest Hr']: Math.round(d.totalRestHours * 100) / 100,
                },
              }))}
              ariaLabel={lang === 'th' ? 'ชม.พัก vs ชม.ขับ' : 'Rest hours vs continuous driving hours by driver'}
              xAxisCategoryMode
            />
          )}
        </section>

        <section className={`${dashboardSectionClass} lg:col-span-2`}>
          <h2 className={heading2}>{lang === 'th' ? 'สัดส่วนชม.ขับ' : 'Driving hours share'}</h2>
          <p className={`mt-1 ${textSecondary}`}>{lang === 'th' ? 'คนขับที่มีชม.ขับต่อเนื่องมากที่สุด' : 'Who drives the most hours.'}</p>
          <div className="mt-4">
            {drvHoursDonut.length === 0 ? (
              <EmptyState title={lang === 'th' ? 'ไม่มีข้อมูล' : 'No data'} />
            ) : (
              <DonutChart
                data={drvHoursDonut}
                title={lang === 'th' ? 'ชม.ขับ' : 'Drv Hr'}
                centerLabel="hr"
                size={160}
                ariaLabel={lang === 'th' ? 'สัดส่วนชม.ขับตามคนขับ' : 'Driving hours distribution by driver'}
              />
            )}
          </div>
        </section>
      </div>

      {/* Violation tables — single column: avoids uneven column heights when one table is huge */}
      <div className="flex flex-col gap-8">
        <section className={`min-w-0 ${dashboardSectionClass}`}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="inline-flex h-7 shrink-0 items-center justify-center rounded-full bg-red-100 px-2 text-xs font-bold tabular-nums text-red-700 dark:bg-red-900 dark:text-red-300">{cntDrvViolations.length}</span>
            <h2 className={`min-w-0 ${heading2}`}>
              {lang === 'th'
                ? `ขับต่อเนื่อง > ${driveMaxHours} ชม.`
                : `Cnt Drv > ${driveMaxHours} hrs`}
            </h2>
          </div>
          <div className="mt-4">
            {cntDrvViolations.length === 0 ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                {lang === 'th' ? 'ไม่พบการฝ่าฝืน' : 'No violations found'}
              </div>
            ) : (
              <DataTable
                columns={violationTableColumns.filter((c) => c.key !== 'type')}
                data={cntDrvViolations}
                defaultSort={{ key: 'cntDrvHours', direction: 'desc' }}
                pageSize={8}
                ariaLabel={
                  lang === 'th'
                    ? `รายงานขับต่อเนื่องเกิน ${driveMaxHours} ชม.`
                    : `Continuous driving over ${driveMaxHours} hours report`
                }
              />
            )}
          </div>
        </section>

        <section className={`min-w-0 ${dashboardSectionClass}`}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="inline-flex h-7 shrink-0 items-center justify-center rounded-full bg-amber-100 px-2 text-xs font-bold tabular-nums text-amber-700 dark:bg-amber-900 dark:text-amber-300">{restHrViolations.length}</span>
            <h2 className={`min-w-0 ${heading2}`}>
              {lang === 'th'
                ? `พักผ่อน < ${restMinHours} ชม.`
                : `Rest < ${restMinHours} hrs`}
            </h2>
          </div>
          <div className="mt-4">
            {restHrViolations.length === 0 ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                {lang === 'th' ? 'ไม่พบการฝ่าฝืน' : 'No violations found'}
              </div>
            ) : (
              <DataTable
                columns={violationTableColumns.filter((c) => c.key !== 'type')}
                data={restHrViolations}
                defaultSort={{ key: 'restHours', direction: 'asc' }}
                pageSize={8}
                ariaLabel={
                  lang === 'th'
                    ? `รายงานพักผ่อนน้อยกว่า ${restMinHours} ชม.`
                    : `Rest hours under ${restMinHours} hours report`
                }
              />
            )}
          </div>
        </section>

        <section className={`min-w-0 ${dashboardSectionClass}`}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="inline-flex h-7 shrink-0 items-center justify-center rounded-full bg-violet-100 px-2 text-xs font-bold tabular-nums text-violet-700 dark:bg-violet-900 dark:text-violet-300">{workingHrViolations.length}</span>
            <h2 className={`min-w-0 ${heading2}`}>
              {lang === 'th'
                ? `ชม.ทำงาน > ${workingMaxHours} ชม.`
                : `Working > ${workingMaxHours} hrs`}
            </h2>
          </div>
          <div className="mt-4">
            {workingHrViolations.length === 0 ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                {lang === 'th' ? 'ไม่พบการฝ่าฝืน' : 'No violations found'}
              </div>
            ) : (
              <DataTable
                columns={violationTableColumns.filter((c) => c.key !== 'type')}
                data={workingHrViolations}
                defaultSort={{ key: 'workingHours', direction: 'desc' }}
                pageSize={8}
                ariaLabel={
                  lang === 'th'
                    ? `รายงานชั่วโมงทำงานเกิน ${workingMaxHours} ชม.`
                    : `Working hours over ${workingMaxHours} hours report`
                }
              />
            )}
          </div>
        </section>
      </div>

      {/* ═══════════════ FLEET OVERVIEW ═══════════════ */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-300 to-transparent dark:via-zinc-700/50" />
        <svg width="6" height="6" viewBox="0 0 6 6" className="shrink-0 text-zinc-300 dark:text-zinc-600" aria-hidden="true"><polygon points="3,0 6,3 3,6 0,3" fill="currentColor" /></svg>
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          {lang === 'th' ? 'ภาพรวมกองยานพาหนะ' : 'Fleet Overview'}
        </h2>
        <svg width="6" height="6" viewBox="0 0 6 6" className="shrink-0 text-zinc-300 dark:text-zinc-600" aria-hidden="true"><polygon points="3,0 6,3 3,6 0,3" fill="currentColor" /></svg>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-300 to-transparent dark:via-zinc-700/50" />
      </div>

      {/* Fleet KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={lang === 'th' ? 'ทริปทั้งหมด' : 'Total trips'}
          value={kpis.totalTrips}
        >
          {kpiTrend && (
            <TrendIndicator
              current={kpiTrend.tripsSecond}
              previous={kpiTrend.tripsFirst}
              invertColor
              suffix={lang === 'th' ? 'vs ช่วงก่อน' : 'vs prior'}
            />
          )}
        </KpiCard>
        <KpiCard
          label={lang === 'th' ? 'ระยะทางรวม' : 'Total distance'}
          value={formatDistance(kpis.totalDistanceKm)}
        >
          {kpiTrend && (
            <TrendIndicator
              current={kpiTrend.distSecond}
              previous={kpiTrend.distFirst}
              invertColor
              suffix={lang === 'th' ? 'vs ช่วงก่อน' : 'vs prior'}
            />
          )}
        </KpiCard>
        <KpiCard
          label={lang === 'th' ? 'คนขับ' : 'Drivers'}
          value={fleetCounts.uniqueDrivers}
        />
        <KpiCard
          label={lang === 'th' ? 'ยานพาหนะ' : 'Vehicles'}
          value={fleetCounts.uniqueVehicles}
        />
      </div>

      {/* Monthly Trend — dual-axis */}
      <section className={dashboardSectionClass}>
        <h2 className={heading2}>{lang === 'th' ? 'แนวโน้มรายเดือน' : 'Monthly trend'}</h2>
        <p className={`mt-1 ${textSecondary}`}>{lang === 'th' ? 'ระยะทาง (แท่ง) และจำนวนทริป (เส้น) — 8 เดือนล่าสุด' : 'Distance (bars) and trip count (line) — last 8 months.'}</p>
        {monthlyTrend.length === 0 ? (
          <div className="mt-4"><EmptyState title="No dated trip data" /></div>
        ) : (
          <TrendChart
            className="mt-4"
            mode="dual-axis"
            height={260}
            data={monthlyTrend.map((p) => ({
              label: p.monthLabel,
              values: {
                [lang === 'th' ? 'ระยะทาง (km)' : 'Distance (km)']: Math.round(p.totalDistanceKm * 10) / 10,
                [lang === 'th' ? 'ทริป' : 'Trips']: p.tripCount,
              },
            }))}
            ariaLabel={lang === 'th' ? 'แนวโน้มรายเดือน' : 'Monthly distance and trip count trend'}
          />
        )}
      </section>

      {/* 2-col: Trip donut + Distance by vehicle donut */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className={dashboardSectionClass}>
          <h2 className={heading2}>{lang === 'th' ? 'สัดส่วนทริปตามคนขับ' : 'Trip share by driver'}</h2>
          <div className="mt-4">
            {tripsByDriverDonut.length === 0 ? (
              <EmptyState title={lang === 'th' ? 'ไม่มีข้อมูล' : 'No data'} />
            ) : (
              <DonutChart
                data={tripsByDriverDonut}
                title={lang === 'th' ? 'ทริป' : 'Trips'}
                centerLabel={lang === 'th' ? 'ทริป' : 'trips'}
                size={140}
                ariaLabel={lang === 'th' ? 'สัดส่วนทริปตามคนขับ' : 'Trip distribution by driver'}
              />
            )}
          </div>
        </section>

        <section className={dashboardSectionClass}>
          <h2 className={heading2}>{lang === 'th' ? 'ระยะทางตามยานพาหนะ' : 'Distance by vehicle'}</h2>
          <div className="mt-4">
            {distByVehicleDonut.length === 0 ? (
              <EmptyState title={lang === 'th' ? 'ไม่มีข้อมูล' : 'No data'} />
            ) : (
              <DonutChart
                data={distByVehicleDonut}
                title={lang === 'th' ? 'ระยะทาง (km)' : 'Distance (km)'}
                centerLabel="km"
                size={140}
                ariaLabel={lang === 'th' ? 'ระยะทางตามยานพาหนะ' : 'Distance by vehicle'}
              />
            )}
          </div>
        </section>
      </div>

      {/* Activity Heatmap + Top drivers by hours */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className={dashboardSectionClass}>
          <h2 className={heading2}>{lang === 'th' ? 'ช่วงเวลาการขับขี่' : 'Driving activity heatmap'}</h2>
          <p className={`mt-1 ${textSecondary}`}>{lang === 'th'
              ? 'รวมทุกสัปดาห์และทุกเดือนในช่วงที่เลือก — แสดงจำนวนทริปตามวันในสัปดาห์และชั่วโมงในวัน'
              : 'Aggregated across all weeks and months in the selected period — shows trip count by day of week and hour of day.'}</p>
          <div className="mt-4">
            {heatmapDates.length === 0 ? (
              <EmptyState title={lang === 'th' ? 'ไม่มีข้อมูลวันที่' : 'No dated trip data'} />
            ) : (
              <AlertHeatmap dates={heatmapDates} />
            )}
          </div>
        </section>
        <section className={dashboardSectionClass}>
          <h2 className={heading2}>{lang === 'th' ? 'คนขับที่มีชั่วโมงมากสุด' : 'Top drivers by hours'}</h2>
          <p className={`mt-1 ${textSecondary}`}>{lang === 'th' ? 'รวมชั่วโมงขับต่อเนื่อง' : 'Total continuous driving hours.'}</p>
          <div className="mt-4">
            {topDriversByHours.length === 0 ? (
              <EmptyState title={lang === 'th' ? 'ไม่มีข้อมูล' : 'No data'} />
            ) : (
              <HorizontalBarChart
                data={topDriversByHours}
                maxItems={5}
                colors={CHART_COLORS}
                ariaLabel={lang === 'th' ? 'คนขับที่มีชั่วโมงขับมากสุด' : 'Top drivers by driving hours'}
              />
            )}
          </div>
        </section>
      </div>

      {/* Driver Statistics Table */}
      <section className={dashboardSectionClass}>
        <h2 className={heading2}>{lang === 'th' ? 'ตารางสถิติคนขับ' : 'Driver statistics'}</h2>
        <div className="mt-4">
          <DataTable
            columns={tableColumns}
            data={aggregates}
            defaultSort={{ key: 'totalCntDrvDurationHours', direction: 'desc' }}
            pageSize={15}
            ariaLabel={lang === 'th' ? 'ตารางสถิติคนขับ' : 'Driver statistics table'}
          />
        </div>
      </section>

      {/* Vehicle Statistics Table */}
      {vehicleAggregates.length > 0 && (
        <section className={dashboardSectionClass}>
          <h2 className={heading2}>{lang === 'th' ? 'ตารางสถิติยานพาหนะ' : 'Vehicle statistics'}</h2>
          <div className="mt-4">
            <DataTable
              columns={vehicleTableColumns}
              data={vehicleAggregates}
              defaultSort={{ key: 'totalDistanceKm', direction: 'desc' }}
              pageSize={15}
              ariaLabel={lang === 'th' ? 'ตารางสถิติยานพาหนะ' : 'Vehicle statistics table'}
            />
          </div>
        </section>
      )}
        </>
      )}

      {activeSubPage.kind === 'drive_hrs' && (
        <ThresholdSubPage
          metric="drive_hrs"
          threshold={activeSubPage.threshold}
          thresholdLabel={activeSubPage.label}
          violations={driveHrsViolations}
          lang={lang}
        />
      )}
      {activeSubPage.kind === 'rest_hrs' && (
        <ThresholdSubPage
          metric="rest_hrs"
          threshold={activeSubPage.threshold}
          thresholdLabel={activeSubPage.label}
          violations={restHrsViolations}
          lang={lang}
        />
      )}
    </DashboardShell>
  );
}

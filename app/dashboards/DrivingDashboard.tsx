'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import LoadingState from './LoadingState';
import useGoogleSheet from './useGoogleSheet';
import { loadStoredFilters, saveStoredFilters } from './filterStorage';
import { findValue, normalizeLabel, parseDate, previousMonthKey, toDayKey, toDisplayString } from './dashboardDataUtils';
import { saveDashboardScore } from './scoreCache';
import {
  computeDrivingScore,
  METRIC_WEIGHTS,
  SEVERITY_PENALTY_PER_DAY_MULTIPLIER,
} from './drivingScoring';
import { getDashboardCopy, type DashboardLang } from 'app/dashboard/i18n-copy';
import KpiCard from 'app/ui/KpiCard';
import ScoreBlock from 'app/ui/ScoreBlock';
import ExportButton from 'app/ui/ExportButton';
import EmptyState from 'app/ui/EmptyState';
import TrendChart from 'app/ui/TrendChart';
import HorizontalBarChart from 'app/ui/HorizontalBarChart';
import { DataTable, type Column } from 'app/ui/DataTable';
import TrendIndicator from 'app/ui/TrendIndicator';
import InlineMonthPicker from 'app/ui/InlineMonthPicker';
import InlineDayPicker from 'app/ui/InlineDayPicker';
import MultiSelect from 'app/ui/MultiSelect';
import FilterBar from 'app/ui/FilterBar';
import DonutChart from 'app/ui/DonutChart';
import AlertHeatmap from 'app/ui/AlertHeatmap';
import {
  heading2, textSecondary, CHART_COLORS, inputBase, selectBase,
} from 'app/ui/design-tokens';
import { normalizeDrivingThresholds, thresholdEntryValue, type DrivingThresholds } from './drivingThresholds';
import { deriveSubPages, subPageBySlug } from './drivingSubPages';
import ThresholdSubPage from './ThresholdSubPage';
import {
  buildCntDrvHoursViolations,
  buildRestHoursViolations,
} from './violationBuilders';
import {
  isCompletedShift,
  mapCntDrvSheetRows,
  mapShiftSheetRows,
  type DrivingCntDrvRow,
  type DrivingShiftRow,
} from './drivingSheetRows';
import SendWarningButton from './SendWarningButton';
import DrivingThresholdInlineEditor from './DrivingThresholdInlineEditor';
import { formatDurationDisplay, hoursToHms } from './drivingDurationFormat';
import {
  buildTripExportRows,
  buildTripTableColumns,
  buildTripTableRows,
  filterTripSourceRows,
  type SheetTripRow,
} from './drivingTripTable';

const TRIP_TABLE_PAGE_SIZE_OPTIONS: Array<{ value: number | 'all'; label: string }> = [
  { value: 15, label: '15' },
  { value: 25, label: '25' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
  { value: 'all', label: 'All' },
];

type DashboardProps = {
  dashboardId: string;
  dashboardName: string;
  sheetId: string;
  sheetGid: string;
  sheetGidCntDrv?: string | null;
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
  dashboardRowId?: number;
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

const formatHours = (hours: number) => hoursToHms(hours);
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
  sheetGidCntDrv = null,
  dashboardNotes,
  organizationName,
  lang = 'en',
  drivingThresholds: drivingThresholdsProp,
  lineChannels = [],
  defaultLineChannelId = null,
  warnings = [],
  isAdmin = false,
  dashboardRowId,
}: DashboardProps) {
  const [thresholds, setThresholds] = useState<DrivingThresholds>(() =>
    normalizeDrivingThresholds(drivingThresholdsProp),
  );
  useEffect(() => {
    setThresholds(normalizeDrivingThresholds(drivingThresholdsProp));
  }, [drivingThresholdsProp]);
  const copy = useMemo(() => getDashboardCopy(lang), [lang]);
  const subPages = useMemo(
    () => deriveSubPages(thresholds, lang, copy.drivingV2),
    [thresholds, lang, copy],
  );
  const searchParams = useSearchParams();
  const router = useRouter();
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
  const jumpToFirstThresholdTab = useCallback(
    (nextThresholds: DrivingThresholds) => {
      const nextPages = deriveSubPages(nextThresholds, lang, copy.drivingV2);
      const target = nextPages.find((p) => p.kind !== 'overview');
      if (!target) return;
      const usp = new URLSearchParams(searchParams.toString());
      usp.set('tab', target.slug);
      router.replace(`${pathname}?${usp.toString()}`);
    },
    [copy.drivingV2, lang, pathname, router, searchParams],
  );
  const restMinHours = thresholds.restHours[0]
    ? thresholdEntryValue(thresholds.restHours[0]) : 0;
  const cntDrvMaxHours = thresholds.cntDrvHours[0]
    ? thresholdEntryValue(thresholds.cntDrvHours[0]) : Infinity;
  const hasCntDrvSheet = Boolean(sheetGidCntDrv);
  const shiftSheet = useGoogleSheet({ sheetId, gid: sheetGid });
  const cntDrvSheet = useGoogleSheet({
    sheetId,
    gid: sheetGidCntDrv ?? '0',
    enabled: hasCntDrvSheet,
  });
  const {
    rows,
    columns: sheetColumns,
    loading: shiftLoading,
    error: shiftError,
    lastUpdated: shiftLastUpdated,
    refresh: refreshShift,
  } = shiftSheet;
  const {
    rows: cntDrvRawRows,
    columns: cntDrvSheetColumns,
    loading: cntDrvLoading,
    error: cntDrvError,
    lastUpdated: cntDrvLastUpdated,
    refresh: refreshCntDrv,
  } = cntDrvSheet;
  const loading = shiftLoading || (hasCntDrvSheet && cntDrvLoading);
  const error = shiftError ?? (hasCntDrvSheet ? cntDrvError : null);
  const lastUpdated = [shiftLastUpdated, cntDrvLastUpdated]
    .filter((v): v is Date => v instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const refresh = useCallback(() => {
    refreshShift();
    if (hasCntDrvSheet) refreshCntDrv();
  }, [hasCntDrvSheet, refreshCntDrv, refreshShift]);
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const [driverFilters, setDriverFilters] = useState<string[]>([]);
  const [vehicleFilters, setVehicleFilters] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [dayFilters, setDayFilters] = useState<string[]>([]);
  const [tripSearch, setTripSearch] = useState('');
  const [tripPageSize, setTripPageSize] = useState<number | 'all'>(25);

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
      tripSearch?: string;
      tripPageSize?: number | 'all';
    }>(storageKey);
    if (!stored) return;
    didSetDefaultMonth.current = true;
    const frame = requestAnimationFrame(() => {
      if (typeof stored.selectedMonth === 'string') setSelectedMonth(stored.selectedMonth);
      if (Array.isArray(stored.dayFilters)) setDayFilters(stored.dayFilters.filter((v) => typeof v === 'string'));
      if (Array.isArray(stored.driverFilters)) setDriverFilters(stored.driverFilters.filter((v) => typeof v === 'string'));
      if (Array.isArray(stored.vehicleFilters)) setVehicleFilters(stored.vehicleFilters.filter((v) => typeof v === 'string'));
      if (typeof stored.tripSearch === 'string') setTripSearch(stored.tripSearch);
      if (stored.tripPageSize === 'all' || typeof stored.tripPageSize === 'number') {
        setTripPageSize(stored.tripPageSize);
      }
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
      tripSearch,
      tripPageSize,
    });
  }, [storageKey, selectedMonth, dayFilters, driverFilters, vehicleFilters, tripSearch, tripPageSize]);

  const shiftRows = useMemo(
    () => mapShiftSheetRows(rows, normalizedOrganizationName),
    [rows, normalizedOrganizationName],
  );
  const cntDrvRows = useMemo(
    () => (hasCntDrvSheet ? mapCntDrvSheetRows(cntDrvRawRows, normalizedOrganizationName) : []),
    [cntDrvRawRows, hasCntDrvSheet, normalizedOrganizationName],
  );

  const applyRowFilters = useCallback(
    <T extends { driver: string; vehicle: string; date: Date | null }>(source: T[]) =>
      source.filter((row) => {
        if (driverFilters.length > 0 && !driverFilters.includes(row.driver)) return false;
        if (vehicleFilters.length > 0 && !vehicleFilters.includes(row.vehicle)) return false;
        if (selectedMonth) {
          if (!row.date) return false;
          if (getMonthKey(row.date) !== selectedMonth) return false;
        }
        if (dayFilters.length > 0 && row.date && !dayFilters.includes(toDayKey(row.date))) {
          return false;
        }
        return true;
      }),
    [dayFilters, driverFilters, selectedMonth, vehicleFilters],
  );

  const filteredShiftRows = useMemo(
    () => applyRowFilters(shiftRows),
    [applyRowFilters, shiftRows],
  );
  const completedShiftRows = useMemo(
    () => filteredShiftRows.filter(isCompletedShift),
    [filteredShiftRows],
  );
  const filteredCntDrvRows = useMemo(
    () => applyRowFilters(cntDrvRows),
    [applyRowFilters, cntDrvRows],
  );

  const driverOptions = useMemo(() => {
    const names = new Set<string>();
    shiftRows.forEach((r) => { if (r.driver !== '—') names.add(r.driver); });
    cntDrvRows.forEach((r) => { if (r.driver !== '—') names.add(r.driver); });
    return Array.from(names).sort();
  }, [cntDrvRows, shiftRows]);
  const vehicleOptions = useMemo(() => {
    const ids = new Set<string>();
    shiftRows.forEach((r) => { if (r.vehicle !== '—') ids.add(r.vehicle); });
    cntDrvRows.forEach((r) => { if (r.vehicle !== '—') ids.add(r.vehicle); });
    return Array.from(ids).sort();
  }, [cntDrvRows, shiftRows]);

  const warningsMap = useMemo(() => {
    const m = new Map<string, { sentAt: Date; channelName: string }>();
    for (const w of warnings ?? []) m.set(w.violationKey, { sentAt: w.sentAt, channelName: w.channelName });
    return m;
  }, [warnings]);

  const driveHrsViolations = useMemo(() => {
    if (activeSubPage.kind !== 'drive_hrs') return [];
    if (!hasCntDrvSheet) return [];
    const violations = buildCntDrvHoursViolations(
      filteredCntDrvRows,
      { threshold: activeSubPage.threshold, label: activeSubPage.label },
      warningsMap,
      'drive_hrs',
    );
    if (dayFilters.length === 0) return violations;
    return violations.filter((v) => dayFilters.includes(v.dayKey));
  }, [activeSubPage, filteredCntDrvRows, hasCntDrvSheet, warningsMap, dayFilters]);

  const restHrsViolations = useMemo(() => {
    if (activeSubPage.kind !== 'rest_hrs') return [];
    return buildRestHoursViolations(
      filteredShiftRows,
      { threshold: activeSubPage.threshold, label: activeSubPage.label },
      warningsMap,
    );
  }, [activeSubPage, filteredShiftRows, warningsMap]);

  const cntDrvHrsViolations = useMemo(() => {
    if (activeSubPage.kind !== 'cnt_drv_hrs') return [];
    return buildCntDrvHoursViolations(
      filteredCntDrvRows,
      { threshold: activeSubPage.threshold, label: activeSubPage.label },
      warningsMap,
    );
  }, [activeSubPage, filteredCntDrvRows, warningsMap]);

  // Active filter count for DashboardShell badge
  const activeFilterCount = useMemo(
    () => [
      driverFilters.length > 0,
      vehicleFilters.length > 0,
      selectedMonth,
      dayFilters.length > 0,
      tripSearch.trim().length > 0,
    ].filter(Boolean).length,
    [dayFilters.length, driverFilters.length, selectedMonth, tripSearch, vehicleFilters.length],
  );

  // Date range string for ExportButton
  const dateRange = useMemo(() => selectedMonth || undefined, [selectedMonth]);

  // All months in filtered data (sorted)
  const allMonthKeys = useMemo(() => {
    const keys = new Set<string>();
    filteredShiftRows.forEach((row) => { if (row.date) keys.add(getMonthKey(row.date)); });
    filteredCntDrvRows.forEach((row) => { if (row.date) keys.add(getMonthKey(row.date)); });
    return Array.from(keys).sort();
  }, [filteredCntDrvRows, filteredShiftRows]);

  // All months in raw data (for default month when no filter)
  const allMonthsFromData = useMemo(() => {
    const keys = new Set<string>();
    shiftRows.forEach((row) => { if (row.date) keys.add(getMonthKey(row.date)); });
    cntDrvRows.forEach((row) => { if (row.date) keys.add(getMonthKey(row.date)); });
    return Array.from(keys).sort();
  }, [cntDrvRows, shiftRows]);

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
    filteredShiftRows.forEach((row) => {
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
  }, [allMonthKeys, filteredShiftRows]);

  // KPI trend: split filteredRows by date into first/second half
  const kpiTrend = useMemo(() => {
    const dated = filteredShiftRows.filter((r) => r.date).sort((a, b) => a.date!.getTime() - b.date!.getTime());
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
  }, [filteredShiftRows]);

  const kpis = useMemo(() => {
    const totalTrips = filteredShiftRows.length;
    const totalDistanceKm = filteredShiftRows.reduce((s, r) => s + r.distanceKm, 0);
    const totalDriveHours = filteredShiftRows.reduce((s, r) => s + r.driveHours, 0);
    const totalCntDrvDurationHours = filteredCntDrvRows.reduce((s, r) => s + r.cntDrvHours, 0);
    const totalRestHours = filteredShiftRows.reduce((s, r) => s + r.restHours, 0);
    const cntDrvTrips = filteredCntDrvRows.length;
    return {
      totalTrips,
      totalDistanceKm,
      totalDriveHours,
      totalCntDrvDurationHours,
      totalRestHours,
      avgDistancePerTrip: totalTrips > 0 ? totalDistanceKm / totalTrips : 0,
      avgCntDrvPerTrip: cntDrvTrips > 0 ? totalCntDrvDurationHours / cntDrvTrips : 0,
      avgRestPerTrip: totalTrips > 0 ? totalRestHours / totalTrips : 0,
    };
  }, [filteredCntDrvRows, filteredShiftRows]);

  const monthlyTrend = useMemo<MonthlyTrendPoint[]>(() => {
    const map = new Map<string, MonthlyTrendPoint>();
    filteredShiftRows.forEach((row) => {
      if (!row.date) return;
      const mk = getMonthKey(row.date);
      const c = map.get(mk) ?? { monthKey: mk, monthLabel: getMonthLabel(mk), totalDistanceKm: 0, totalCntDrvDurationHours: 0, tripCount: 0 };
      c.totalDistanceKm += row.distanceKm;
      c.totalCntDrvDurationHours += row.driveHours;
      c.tripCount += 1;
      map.set(mk, c);
    });
    return Array.from(map.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey)).slice(-8);
  }, [filteredShiftRows]);

  // --- Fleet counts ---
  const fleetCounts = useMemo(() => {
    const drivers = new Set<string>();
    const vehicles = new Set<string>();
    filteredShiftRows.forEach((r) => {
      if (r.driver !== '—') drivers.add(r.driver);
      if (r.vehicle !== '—') vehicles.add(r.vehicle);
    });
    filteredCntDrvRows.forEach((r) => {
      if (r.driver !== '—') drivers.add(r.driver);
      if (r.vehicle !== '—') vehicles.add(r.vehicle);
    });
    return { uniqueDrivers: drivers.size, uniqueVehicles: vehicles.size };
  }, [filteredCntDrvRows, filteredShiftRows]);

  // --- Vehicle aggregates ---
  type VehicleAggregate = { vehicle: string; tripCount: number; totalDistanceKm: number; totalCntDrvDurationHours: number; driverCount: number };
  const vehicleAggregates = useMemo<VehicleAggregate[]>(() => {
    const map = new Map<string, { vehicle: string; tripCount: number; totalDistanceKm: number; totalCntDrvDurationHours: number; drivers: Set<string> }>();
    filteredShiftRows.forEach((row) => {
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
  }, [filteredShiftRows]);

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
  const heatmapDates = useMemo(
    () => filteredShiftRows.filter((r) => r.date).map((r) => r.date!),
    [filteredShiftRows],
  );

  const cntDrvByDriver = useMemo(() => {
    const map = new Map<string, { driver: string; totalCntDrvHours: number; tripCount: number }>();
    filteredCntDrvRows.forEach((row) => {
      if (row.driver === '—') return;
      const c = map.get(row.driver) ?? { driver: row.driver, totalCntDrvHours: 0, tripCount: 0 };
      c.totalCntDrvHours += row.cntDrvHours;
      c.tripCount += 1;
      map.set(row.driver, c);
    });
    return Array.from(map.values());
  }, [filteredCntDrvRows]);

  // --- Top 5 drivers by total driving hours (for heatmap companion) ---
  const topDriversByHours = useMemo(() => {
    return [...cntDrvByDriver]
      .sort((a, b) => b.totalCntDrvHours - a.totalCntDrvHours)
      .slice(0, 5)
      .map((a) => ({ label: a.driver, value: Math.round(a.totalCntDrvHours * 10) / 10 }));
  }, [cntDrvByDriver]);

  // --- Violation reports ---
  type ViolationRow = {
    driver: string;
    vehicle: string;
    date: string;
    cntDrvHours: number;
    restHours: number;
    type: 'cnt_drv' | 'rest_hr';
  };
  const violations = useMemo<ViolationRow[]>(() => {
    const result: ViolationRow[] = [];
    filteredCntDrvRows.forEach((row) => {
      const dateStr = row.date ? row.date.toLocaleDateString('en-GB') : '—';
      if (row.cntDrvHours > cntDrvMaxHours) {
        result.push({
          driver: row.driver,
          vehicle: row.vehicle,
          date: dateStr,
          cntDrvHours: row.cntDrvHours,
          restHours: 0,
          type: 'cnt_drv',
        });
      }
    });
    filteredShiftRows.forEach((row) => {
      const dateStr = row.date ? row.date.toLocaleDateString('en-GB') : '—';
      if (row.restHours > 0 && row.restHours < restMinHours) {
        result.push({
          driver: row.driver,
          vehicle: row.vehicle,
          date: dateStr,
          cntDrvHours: row.driveHours,
          restHours: row.restHours,
          type: 'rest_hr',
        });
      }
    });
    const typeOrder = { cnt_drv: 0, rest_hr: 1 } as const;
    return result.sort((a, b) => {
      if (a.type !== b.type) return typeOrder[a.type] - typeOrder[b.type];
      return a.driver.localeCompare(b.driver);
    });
  }, [filteredCntDrvRows, filteredShiftRows, cntDrvMaxHours, restMinHours]);

  const cntDrvViolations = useMemo(() => violations.filter((v) => v.type === 'cnt_drv'), [violations]);
  const restHrViolations = useMemo(() => violations.filter((v) => v.type === 'rest_hr'), [violations]);

  // --- Driving safety score (cached for main dashboard listing) ---
  const drivingScore = useMemo(
    () => computeDrivingScore(filteredShiftRows, thresholds),
    [filteredShiftRows, thresholds],
  );

  useEffect(() => {
    if (loading) return;
    saveDashboardScore(
      dashboardId,
      drivingScore.score,
      drivingScore.perMetric.drive + drivingScore.perMetric.rest,
    );
  }, [
    dashboardId,
    loading,
    drivingScore.score,
    drivingScore.perMetric.drive,
    drivingScore.perMetric.rest,
  ]);

  // --- Per-driver sorted by cnt drv hours (for requested bar+line chart) ---
  const driversByCntDrv = useMemo(
    () => [...cntDrvByDriver]
      .sort((a, b) => b.totalCntDrvHours - a.totalCntDrvHours)
      .slice(0, 10)
      .map((d) => ({
        driver: d.driver,
        tripCount: d.tripCount,
        totalDistanceKm: 0,
        totalCntDrvDurationHours: d.totalCntDrvHours,
        avgDistancePerTrip: 0,
        avgDurationPerTrip: d.tripCount > 0 ? d.totalCntDrvHours / d.tripCount : 0,
        monthlyDistances: [] as number[],
      })),
    [cntDrvByDriver],
  );

  // --- Per-driver rest hours vs cnt drv hours ---
  const restVsCntDrvByDriver = useMemo(() => {
    const map = new Map<string, { driver: string; totalRestHours: number; totalCntDrvHours: number; tripCount: number }>();
    filteredShiftRows.forEach((row) => {
      if (row.driver === '—') return;
      const c = map.get(row.driver) ?? { driver: row.driver, totalRestHours: 0, totalCntDrvHours: 0, tripCount: 0 };
      c.totalRestHours += row.restHours;
      c.tripCount += 1;
      map.set(row.driver, c);
    });
    cntDrvByDriver.forEach((row) => {
      const c = map.get(row.driver) ?? { driver: row.driver, totalRestHours: 0, totalCntDrvHours: 0, tripCount: 0 };
      c.totalCntDrvHours = row.totalCntDrvHours;
      map.set(row.driver, c);
    });
    return Array.from(map.values()).sort((a, b) => b.totalCntDrvHours - a.totalCntDrvHours).slice(0, 10);
  }, [cntDrvByDriver, filteredShiftRows]);

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
    const maxCnt = cntDrvMaxHours;
    const minRest = restMinHours;
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
            <span className={hours > maxCnt ? 'font-semibold text-red-600 dark:text-red-400' : 'tabular-nums'}>
              {formatDurationDisplay(null, hours)}
            </span>
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
            <span className={hours < minRest ? 'font-semibold text-red-600 dark:text-red-400' : 'tabular-nums'}>
              {formatDurationDisplay(null, hours)}
            </span>
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
          return null;
        },
      },
    ];
  }, [lang, cntDrvMaxHours, restMinHours]);

  const tripTableColumnMeta = useMemo(
    () => (hasCntDrvSheet ? cntDrvSheetColumns : sheetColumns),
    [cntDrvSheetColumns, hasCntDrvSheet, sheetColumns],
  );

  const tripTableSourceRows = useMemo(
    () => (hasCntDrvSheet
      ? filteredCntDrvRows.map((r) => r.sourceRow)
      : completedShiftRows.map((r) => r.sourceRow)),
    [completedShiftRows, filteredCntDrvRows, hasCntDrvSheet],
  );

  const filteredTripSourceRows = useMemo(
    () => filterTripSourceRows(tripTableSourceRows, tripSearch, tripTableColumnMeta),
    [tripTableColumnMeta, tripSearch, tripTableSourceRows],
  );

  const fullSheetExportFilteredRows = useMemo(
    () => [
      ...filterTripSourceRows(
        completedShiftRows.map((r) => r.sourceRow),
        tripSearch,
        sheetColumns,
      ),
      ...filterTripSourceRows(
        filteredCntDrvRows.map((r) => r.sourceRow),
        tripSearch,
        cntDrvSheetColumns,
      ),
    ],
    [completedShiftRows, cntDrvSheetColumns, filteredCntDrvRows, tripSearch, sheetColumns],
  );

  const exportData = useMemo(
    () => buildTripExportRows(filteredTripSourceRows, tripTableColumnMeta),
    [filteredTripSourceRows, tripTableColumnMeta],
  );

  const tripTableData = useMemo(
    () => buildTripTableRows(filteredTripSourceRows, tripTableColumnMeta),
    [filteredTripSourceRows, tripTableColumnMeta],
  );

  const tripTableColumns = useMemo(
    () => buildTripTableColumns(tripTableColumnMeta),
    [tripTableColumnMeta],
  );

  const tripTableDefaultSortKey = useMemo(() => {
    const loginCol = tripTableColumnMeta.find((c) =>
      ['login time', 'start time', 'datetime'].includes(c.label.trim().toLowerCase()),
    );
    return loginCol?.fieldKey ?? tripTableColumnMeta[0]?.fieldKey ?? '_id';
  }, [tripTableColumnMeta]);

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
        <>
          <ExportButton
            data={exportData}
            fullSheetExport={{
              rows,
              filteredRows: fullSheetExportFilteredRows,
              columns: [...sheetColumns, ...cntDrvSheetColumns.filter(
                (c) => !sheetColumns.some((s) => s.fieldKey === c.fieldKey),
              )],
            }}
            dashboardName={dashboardName}
            dateRange={dateRange}
            filename={`${dashboardName}-driving`}
            settingsStorageKey={`driving-${dashboardId}`}
            lang={lang}
            fullSheetHint={
              lang === 'th'
                ? 'ใช้ตัวกรองเดียวกับตารางนี้ แต่ส่งออกทุกคอลัมน์จากชีตดิบ (รวมคอลัมน์ที่ซ่อนในตาราง)'
                : 'Same filters as this table, but exports every raw spreadsheet column (including columns hidden in the table).'
            }
            columns={tripTableColumnMeta.map((col) => ({ key: col.label, label: col.label }))}
            label={lang === 'th' ? 'ส่งออก CSV' : 'Export CSV'}
          />
          {isAdmin && dashboardRowId ? (
            <DrivingThresholdInlineEditor
              dashboardRowId={dashboardRowId}
              dashboardPublicId={dashboardId}
              initialThresholds={thresholds}
              lang={lang}
              onSaved={(next) => {
                setThresholds(next);
                jumpToFirstThresholdTab(next);
              }}
            />
          ) : null}
        </>
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

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <ScoreBlock
            score={drivingScore.score}
            label={lang === 'th'
              ? `คะแนนความปลอดภัยการขับขี่ · เกรด ${drivingScore.grade}`
              : `Driving safety score · Grade ${drivingScore.grade}`}
            detail={`${drivingScore.totalDays} ${lang === 'th' ? 'วัน-คนขับ' : 'driver-days'} · ${drivingScore.perMetric.drive + drivingScore.perMetric.rest} ${lang === 'th' ? 'severity points' : 'severity points'}`}
          />
        </div>
        <section className={`lg:col-span-3 ${dashboardSectionClass}`}>
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {lang === 'th' ? 'วิธีคำนวณคะแนน' : 'How score is calculated'}
          </h3>
          <p className={`mt-1 text-xs ${textSecondary}`}>
            {lang === 'th'
              ? `เริ่มที่ 100 คะแนน แล้วหักตามความรุนแรงเฉลี่ยต่อวันของคนขับ (driver-day)`
              : 'Starts at 100, then subtracts penalties from average severity per driver-day.'}
          </p>
          <div className="mt-2 grid gap-2 text-xs text-zinc-600 dark:text-zinc-300 sm:grid-cols-2">
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/70">
              {lang === 'th'
                ? `Drive Hours: ต่ำกว่า/เท่ากับ threshold = 0, เกินบางช่วง = 1, เกิน threshold สูงสุด = 3 (น้ำหนัก ${METRIC_WEIGHTS.driveHours})`
                : `Drive Hours: <= threshold = 0, between thresholds = 1, above highest threshold = 3 (weight ${METRIC_WEIGHTS.driveHours})`}
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/70">
              {lang === 'th'
                ? `Rest Hours: สูงกว่า/เท่ากับ threshold = 0, ต่ำกว่าบางช่วง = 1, ต่ำกว่า threshold ต่ำสุด = 3 (น้ำหนัก ${METRIC_WEIGHTS.restHours})`
                : `Rest Hours: >= threshold = 0, between thresholds = 1, below lowest threshold = 3 (weight ${METRIC_WEIGHTS.restHours})`}
            </div>
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {lang === 'th'
              ? `สูตร: Score = 100 - (average weighted severity × ${SEVERITY_PENALTY_PER_DAY_MULTIPLIER}) จากนั้น clamp 0–100`
              : `Formula: Score = 100 - (average weighted severity × ${SEVERITY_PENALTY_PER_DAY_MULTIPLIER}), then clamped to 0–100.`}
          </p>
        </section>
      </div>

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
          label={lang === 'th' ? `ขับต่อเนื่อง > ${cntDrvMaxHours} ชม.` : `Cnt Drv > ${cntDrvMaxHours} hrs`}
          value={cntDrvViolations.length}
          accentColor={cntDrvViolations.length > 0 ? '#ef4444' : '#10b981'}
        />
        <KpiCard
          label={lang === 'th' ? `พักผ่อน < ${restMinHours} ชม.` : `Rest < ${restMinHours} hrs`}
          value={restHrViolations.length}
          accentColor={restHrViolations.length > 0 ? '#f59e0b' : '#10b981'}
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

      {/* Trip data table — one row per trip, spreadsheet columns */}
      <section className={dashboardSectionClass}>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h2 className={heading2}>{lang === 'th' ? 'ข้อมูลทริป' : 'Trip data'}</h2>
            <p className={`mt-1 ${textSecondary}`}>
              {lang === 'th'
                ? `${tripTableData.length} แถว · คลิกหัวคอลัมน์เพื่อเรียงลำดับ`
                : `${tripTableData.length} rows · click column headers to sort`}
            </p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
            <span>{lang === 'th' ? 'แสดง' : 'Show'}</span>
            <select
              value={String(tripPageSize)}
              onChange={(e) => {
                const raw = e.target.value;
                setTripPageSize(raw === 'all' ? 'all' : Number(raw));
              }}
              className={`${selectBase} w-auto py-1.5 text-sm`}
              aria-label={lang === 'th' ? 'จำนวนรายการต่อหน้า' : 'Rows per page'}
            >
              {TRIP_TABLE_PAGE_SIZE_OPTIONS.map((s) => (
                <option key={String(s.value)} value={String(s.value)}>
                  {s.value === 'all' ? (lang === 'th' ? 'ทั้งหมด' : 'All') : s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className={`mt-2 ${textSecondary}`}>
          {hasCntDrvSheet
            ? (lang === 'th'
              ? 'หนึ่งแถวต่อช่วงขับต่อเนื่อง — ใช้คอลัมน์ Cnt Drv Hr จากชีต ชั่วโมงแสดงเป็น ชม:นาที:วินาที'
              : 'One row per continuous drive segment — uses the Cnt Drv Hr column from the spreadsheet; hours shown as H:MM:SS.')
            : (lang === 'th'
              ? 'หนึ่งแถวต่อทริปที่สถานะ Completed — ชื่อคอลัมน์ตรงกับชีต ชั่วโมงแสดงเป็น ชม:นาที:วินาที'
              : 'One row per completed trip — column names match the spreadsheet; hours shown as H:MM:SS.')}
        </p>

        <FilterBar className="mt-4">
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
              onClick={() => {
                setSelectedMonth('');
                setDayFilters([]);
                setDriverFilters([]);
                setVehicleFilters([]);
              }}
              className="ml-auto text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              {lang === 'th' ? 'รีเซ็ต' : 'Reset'}
            </button>
          )}
        </FilterBar>

        <div className="mt-3">
          <label className="block">
            <span className="sr-only">{lang === 'th' ? 'ค้นหาในตารางทริป' : 'Search trip table'}</span>
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                value={tripSearch}
                onChange={(e) => setTripSearch(e.target.value)}
                placeholder={
                  lang === 'th'
                    ? 'ค้นหาคนขับ, เลขรถ, สถานที่, เวลา...'
                    : 'Search driver, vehicle, location, time…'
                }
                className={`${inputBase} pl-9`}
              />
            </div>
          </label>
          {tripSearch.trim() ? (
            <button
              type="button"
              onClick={() => setTripSearch('')}
              className="mt-2 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              {lang === 'th' ? 'ล้างการค้นหา' : 'Clear search'}
            </button>
          ) : null}
        </div>

        <div className="mt-4 min-w-0 overflow-hidden rounded-lg border border-zinc-200/80 dark:border-zinc-800">
          {tripTableData.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
              {lang === 'th' ? 'ไม่พบแถวที่ตรงกับตัวกรอง' : 'No rows match the current filters'}
            </div>
          ) : (
            <DataTable<SheetTripRow>
              columns={tripTableColumns}
              data={tripTableData}
              defaultSort={{ key: tripTableDefaultSortKey, direction: 'desc' }}
              pageSize={tripPageSize === 'all' ? undefined : tripPageSize}
              ariaLabel={lang === 'th' ? 'ตารางข้อมูลทริป' : 'Trip data table'}
            />
          )}
        </div>
      </section>
        </>
      )}

      {activeSubPage.kind === 'drive_hrs' && (
        <ThresholdSubPage
          metric="drive_hrs"
          threshold={activeSubPage.threshold}
          thresholdLabel={activeSubPage.label}
          violations={driveHrsViolations}
          lang={lang}
          renderWarnAction={(row) => (
            <SendWarningButton
              row={row}
              dashboardPublicId={dashboardId}
              channels={lineChannels ?? []}
              defaultChannelId={defaultLineChannelId ?? null}
              lang={lang}
            />
          )}
        />
      )}
      {activeSubPage.kind === 'rest_hrs' && (
        <ThresholdSubPage
          metric="rest_hrs"
          threshold={activeSubPage.threshold}
          thresholdLabel={activeSubPage.label}
          violations={restHrsViolations}
          lang={lang}
          renderWarnAction={(row) => (
            <SendWarningButton
              row={row}
              dashboardPublicId={dashboardId}
              channels={lineChannels ?? []}
              defaultChannelId={defaultLineChannelId ?? null}
              lang={lang}
            />
          )}
        />
      )}
      {activeSubPage.kind === 'cnt_drv_hrs' && (
        <ThresholdSubPage
          metric="cnt_drv_hrs"
          threshold={activeSubPage.threshold}
          thresholdLabel={activeSubPage.label}
          violations={cntDrvHrsViolations}
          lang={lang}
          renderWarnAction={(row) => (
            <SendWarningButton
              row={row}
              dashboardPublicId={dashboardId}
              channels={lineChannels ?? []}
              defaultChannelId={defaultLineChannelId ?? null}
              lang={lang}
            />
          )}
        />
      )}
    </DashboardShell>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import useGoogleSheet from './useGoogleSheet';
import { formatDateTimeGB } from './dateFormat';
import { loadStoredFilters, saveStoredFilters } from './filterStorage';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import LoadingState from './LoadingState';
import { getDashboardCopy, type DashboardLang } from 'app/dashboard/i18n-copy';
import {
  ALLOWED_ALERT_TYPES,
  ALLOWED_REMARK_TARGETS,
  computeDriverSafetyScore,
  findValue,
  hasRemark,
  isExcludedAlertRemark,
  normalizeLabel,
  parseDate,
  toDayKey,
  toDisplayString,
  toMonthKey,
  toMonthLabel,
  withDerivedRemark,
} from './dashboardDataUtils';

// V2 components
import TrendChart from 'app/ui/TrendChart';
import { DataTable, type Column } from 'app/ui/DataTable';
import KpiCard from 'app/ui/KpiCard';
import ExportButton from 'app/ui/ExportButton';
import AlertHeatmap from 'app/ui/AlertHeatmap';
import DonutChart from 'app/ui/DonutChart';
import SafetyScore from 'app/ui/SafetyScore';
import InlineMonthPicker from 'app/ui/InlineMonthPicker';
import MultiSelect from 'app/ui/MultiSelect';
import {
  heading2,
  textSecondary,
  badgeDefault,
  badgeWarning,
  badgeDanger,
  badgeInfo,
  CHART_COLORS,
} from 'app/ui/design-tokens';
import FilterBar from 'app/ui/FilterBar';

// Sub-components
import AlertTimeline, { type TimelineEntry } from './AlertTimeline';
import VideoEvidence, { type VideoEntry } from './VideoEvidence';
import DriverSummaryCards from './DriverSummaryCards';

type DashboardProps = {
  dashboardId: string;
  dashboardName: string;
  sheetId: string;
  sheetGid: string;
  dashboardNotes?: string | null;
  organizationName?: string | null;
  lang?: DashboardLang;
};

type AlertRow = {
  id: string;
  vehicle: string;
  driver: string;
  alertType: string;
  time: string;
  speed: string;
  remarks: string;
  fleet: string;
  videoUrl: string;
  monthKey: string | null;
  monthLabel: string;
  dateValue: unknown;
  parsedDate: Date | null;
};

type DetailFilterState = {
  monthFilters: string[];
  fleetFilters: string[];
  remarkFilters: string[];
  vehicleFilters: string[];
  driverFilters: string[];
  trendRemarkFilter: string;
  showExcluded: boolean;
};

const toDateLabel = (value: unknown) => {
  if (!value) return '—';
  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return formatDateTimeGB(parsed);
};

const hasVideoLink = (videoUrl: string) => Boolean(videoUrl && videoUrl !== '—');

// Badge color for remark types
const getRemarkBadgeClass = (remark: string): string => {
  const lower = normalizeLabel(remark);
  if (lower.includes('fatigue') || lower.includes('yawning'))
    return badgeDanger;
  if (
    lower.includes('overspeed') ||
    lower.includes('harsh') ||
    lower.includes('forward collision')
  )
    return badgeWarning;
  if (lower.includes('distraction') || lower.includes('seatbelt'))
    return badgeInfo;
  return badgeDefault;
};

export default function DetailDashboard({
  dashboardId,
  dashboardName,
  sheetId,
  sheetGid,
  dashboardNotes,
  organizationName,
  lang = 'en',
}: DashboardProps) {
  const copy = getDashboardCopy(lang);
  const { rows, loading, error, lastUpdated, refresh } = useGoogleSheet({ sheetId, gid: sheetGid });
  const normalizedOrganizationName = useMemo(
    () => (organizationName ? normalizeLabel(organizationName) : null),
    [organizationName],
  );
  const currentMonthKey = useMemo(() => toMonthKey(new Date()), []);
  const [filters, setFilters] = useState<DetailFilterState>({
    monthFilters: [],
    fleetFilters: [],
    remarkFilters: [],
    vehicleFilters: [],
    driverFilters: [],
    trendRemarkFilter: 'all',
    showExcluded: false,
  });
  const { monthFilters, fleetFilters, remarkFilters, vehicleFilters, driverFilters, trendRemarkFilter, showExcluded } = filters;
  const didSetDefaultMonth = useRef(false);
  const storageKey = useMemo(() => dashboardId, [dashboardId]);

  // Persist / restore filters
  useEffect(() => {
    const stored = loadStoredFilters<DetailFilterState>(storageKey);
    if (!stored) return;
    didSetDefaultMonth.current = true;
    setFilters((prev) => ({
      ...prev,
      monthFilters: Array.isArray(stored.monthFilters) ? stored.monthFilters.filter((v) => typeof v === 'string') : prev.monthFilters,
      fleetFilters: Array.isArray(stored.fleetFilters) ? stored.fleetFilters.filter((v) => typeof v === 'string') : prev.fleetFilters,
      remarkFilters: Array.isArray(stored.remarkFilters) ? stored.remarkFilters.filter((v) => typeof v === 'string') : prev.remarkFilters,
      vehicleFilters: Array.isArray(stored.vehicleFilters) ? stored.vehicleFilters.filter((v) => typeof v === 'string') : prev.vehicleFilters,
      driverFilters: Array.isArray(stored.driverFilters) ? stored.driverFilters.filter((v) => typeof v === 'string') : prev.driverFilters,
      trendRemarkFilter: typeof stored.trendRemarkFilter === 'string' ? stored.trendRemarkFilter : prev.trendRemarkFilter,
      showExcluded: typeof stored.showExcluded === 'boolean' ? stored.showExcluded : prev.showExcluded,
    }));
  }, [storageKey]);

  useEffect(() => {
    saveStoredFilters(storageKey, filters);
  }, [filters, storageKey]);

  const resetFilters = () => {
    setFilters({
      monthFilters: [],
      fleetFilters: [],
      remarkFilters: [],
      vehicleFilters: [],
      driverFilters: [],
      trendRemarkFilter: 'all',
      showExcluded: false,
    });
  };

  const hasActiveFilters =
    monthFilters.length > 0 ||
    fleetFilters.length > 0 ||
    remarkFilters.length > 0 ||
    vehicleFilters.length > 0 ||
    driverFilters.length > 0 ||
    showExcluded;

  const allowedAlertTypes = useMemo(() => ALLOWED_ALERT_TYPES, []);
  const allowedRemarkTargets = useMemo(() => ALLOWED_REMARK_TARGETS, []);

  // ── Data pipeline: alertRows -> baseFilteredRows -> filteredAlerts ──
  const alertRows = useMemo<AlertRow[]>(() => {
    const mappedRows = rows.map((row, index) => {
      const timeValue = findValue(row, ['Alert Date Time', 'Track Time', 'Date']);
      const parsedDate = parseDate(timeValue);
      const monthKey = parsedDate ? toMonthKey(parsedDate) : null;
      const monthLabel = parsedDate ? toMonthLabel(parsedDate) : 'Unknown month';
      return {
        id: `${index}-${findValue(row, ['Vehicle No']) ?? 'vehicle'}`,
        vehicle: toDisplayString(findValue(row, ['Vehicle No', 'Vehicle No TH'])),
        driver: toDisplayString(findValue(row, ['Driver Name'])),
        alertType: toDisplayString(findValue(row, ['Alert Type'])),
        time: toDateLabel(timeValue),
        speed: toDisplayString(findValue(row, ['Speed'])),
        remarks: withDerivedRemark(
          toDisplayString(findValue(row, ['Alert Type'])),
          toDisplayString(findValue(row, ['Remarks'])),
        ),
        fleet: toDisplayString(findValue(row, ['Fleet'])),
        videoUrl: toDisplayString(findValue(row, ['videoURL', 'Videoit'])),
        monthKey,
        monthLabel,
        dateValue: timeValue,
        parsedDate,
      };
    });
    const remarkRows = mappedRows.filter((row) => {
      if (!hasRemark(row.remarks)) return false;
      if (!showExcluded && isExcludedAlertRemark(row.remarks)) return false;
      return true;
    });
    if (!normalizedOrganizationName) {
      return remarkRows;
    }
    return remarkRows.filter((row) => normalizeLabel(row.fleet) === normalizedOrganizationName);
  }, [normalizedOrganizationName, rows, showExcluded]);

  // ── Filter option lists ──
  const fleetOptions = useMemo(() => {
    const unique = new Set<string>();
    alertRows.forEach((row) => {
      if (row.fleet && row.fleet !== '—') unique.add(row.fleet);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [alertRows]);

  const remarkOptions = useMemo(() => {
    const normalizedTargets = allowedRemarkTargets.map((label) => normalizeLabel(label));
    const matching = new Set<string>();
    alertRows.forEach((row) => {
      if (!row.remarks || row.remarks === '—') return;
      const normalizedValue = normalizeLabel(row.remarks);
      normalizedTargets.forEach((target, index) => {
        if (normalizedValue.includes(target)) {
          matching.add(allowedRemarkTargets[index]);
        }
      });
    });
    return Array.from(matching).sort((a, b) => a.localeCompare(b));
  }, [alertRows, allowedRemarkTargets]);

  const vehicleOptions = useMemo(() => {
    const unique = new Set<string>();
    alertRows.forEach((row) => {
      if (row.vehicle && row.vehicle !== '—') unique.add(row.vehicle);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [alertRows]);

  const driverOptions = useMemo(() => {
    const unique = new Set<string>();
    alertRows.forEach((row) => {
      if (row.driver && row.driver !== '—') unique.add(row.driver);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [alertRows]);

  const monthOptions = useMemo(() => {
    const unique = new Map<string, string>();
    alertRows.forEach((row) => {
      if (row.monthKey && row.monthLabel) {
        unique.set(row.monthKey, row.monthLabel);
      }
    });
    return Array.from(unique.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [alertRows]);

  useEffect(() => {
    if (didSetDefaultMonth.current) return;
    if (monthOptions.length === 0) return;
    if (monthFilters.length > 0) {
      didSetDefaultMonth.current = true;
      return;
    }
    didSetDefaultMonth.current = true;
    if (monthOptions.some((option) => option.key === currentMonthKey)) {
      setFilters((f) => ({ ...f, monthFilters: [currentMonthKey] }));
    }
  }, [currentMonthKey, monthFilters, monthOptions]);

  const baseFilteredRows = useMemo(() => {
    const normalizedAllowedAlertTypes = allowedAlertTypes.map((alert) => normalizeLabel(alert));
    const normalizedFleetFilters = fleetFilters.map((fleet) => normalizeLabel(fleet));
    const normalizedRemarkFilters = remarkFilters.map((remark) => normalizeLabel(remark));
    const normalizedVehicleFilters = vehicleFilters.map((vehicle) => normalizeLabel(vehicle));
    const normalizedDriverFilters = driverFilters.map((driver) => normalizeLabel(driver));
    return alertRows.filter((row) => {
      if (!row.alertType || row.alertType === '—') return false;
      const normalizedAlertType = normalizeLabel(row.alertType);
      if (!normalizedAllowedAlertTypes.includes(normalizedAlertType)) return false;
      if (normalizedFleetFilters.length > 0) {
        const normalizedFleet = normalizeLabel(row.fleet);
        if (!normalizedFleetFilters.includes(normalizedFleet)) return false;
      }
      if (normalizedRemarkFilters.length > 0) {
        const normalizedRemark = normalizeLabel(row.remarks);
        if (!normalizedRemarkFilters.includes(normalizedRemark)) return false;
      }
      if (normalizedVehicleFilters.length > 0) {
        const normalizedVehicle = normalizeLabel(row.vehicle);
        if (!normalizedVehicleFilters.includes(normalizedVehicle)) return false;
      }
      if (normalizedDriverFilters.length > 0) {
        const normalizedDriver = normalizeLabel(row.driver);
        if (!normalizedDriverFilters.includes(normalizedDriver)) return false;
      }
      return true;
    });
  }, [alertRows, allowedAlertTypes, fleetFilters, remarkFilters, vehicleFilters, driverFilters]);

  const filteredAlerts = useMemo(() => {
    if (monthFilters.length === 0) return baseFilteredRows;
    return baseFilteredRows.filter((row) => row.monthKey && monthFilters.includes(row.monthKey));
  }, [baseFilteredRows, monthFilters]);

  // ── Trend remark filter options ──
  const availableTrendRemarkOptions = useMemo(() => {
    const normalizedTargets = allowedRemarkTargets.map((label) => normalizeLabel(label));
    const matching = new Set<string>();
    filteredAlerts.forEach((row) => {
      if (!row.remarks || row.remarks === '—') return;
      const normalizedValue = normalizeLabel(row.remarks);
      normalizedTargets.forEach((target, index) => {
        if (normalizedValue.includes(target)) {
          matching.add(allowedRemarkTargets[index]);
        }
      });
    });
    return [
      { label: lang === 'th' ? 'การแจ้งเตือนทุกประเภท' : 'All alert types', value: 'all' },
      ...Array.from(matching)
        .sort((a, b) => a.localeCompare(b))
        .map((option) => ({ label: option, value: option })),
    ];
  }, [allowedRemarkTargets, filteredAlerts, lang]);

  useEffect(() => {
    if (trendRemarkFilter === 'all') return;
    if (availableTrendRemarkOptions.some((option) => option.value === trendRemarkFilter)) return;
    setFilters((f) => ({ ...f, trendRemarkFilter: 'all' }));
  }, [availableTrendRemarkOptions, trendRemarkFilter]);

  // ── Trend chart data (TrendDatum[]) ──
  const trendChartData = useMemo(() => {
    const counts = new Map<string, { key: string; date: Date; count: number }>();
    filteredAlerts.forEach((row) => {
      if (!row.parsedDate) return;
      if (trendRemarkFilter !== 'all') {
        const normalizedRemark = normalizeLabel(row.remarks);
        const normalizedFilter = normalizeLabel(trendRemarkFilter);
        if (!normalizedRemark.includes(normalizedFilter)) return;
      }
      const dayKey = toDayKey(row.parsedDate);
      const existing = counts.get(dayKey);
      if (existing) {
        existing.count += 1;
      } else {
        const dayDate = new Date(row.parsedDate.getFullYear(), row.parsedDate.getMonth(), row.parsedDate.getDate());
        counts.set(dayKey, { key: dayKey, date: dayDate, count: 1 });
      }
    });
    return Array.from(counts.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((item) => ({
        label: item.date.toLocaleDateString('en-GB'),
        value: item.count,
      }));
  }, [filteredAlerts, trendRemarkFilter]);

  // ── Heatmap dates ──
  const heatmapDates = useMemo(
    () => filteredAlerts.filter((row) => row.parsedDate).map((row) => row.parsedDate as Date),
    [filteredAlerts],
  );

  // ── Video evidence entries ──
  const videoEntries = useMemo<VideoEntry[]>(() => {
    return filteredAlerts
      .filter((row) => hasVideoLink(row.videoUrl) && row.parsedDate)
      .map((row) => ({
        url: row.videoUrl,
        vehicle: row.vehicle,
        driver: row.driver,
        timestamp: row.parsedDate as Date,
        speed: row.speed,
        alertType: row.remarks,
      }));
  }, [filteredAlerts]);

  // ── Timeline entries ──
  const timelineEntries = useMemo<TimelineEntry[]>(() => {
    return filteredAlerts
      .filter((row) => row.parsedDate)
      .map((row) => ({
        timestamp: row.parsedDate as Date,
        vehicle: row.vehicle,
        driver: row.driver,
        alertType: row.remarks,
        speed: row.speed,
      }));
  }, [filteredAlerts]);

  // ── KPI data ──
  const uniqueVehicles = useMemo(() => {
    const s = new Set<string>();
    filteredAlerts.forEach((r) => {
      if (r.vehicle && r.vehicle !== '—') s.add(r.vehicle);
    });
    return s.size;
  }, [filteredAlerts]);

  const uniqueDrivers = useMemo(() => {
    const s = new Set<string>();
    filteredAlerts.forEach((r) => {
      if (r.driver && r.driver !== '—') s.add(r.driver);
    });
    return s.size;
  }, [filteredAlerts]);

  // Compute previous month alert count for trend
  const previousMonthAlertCount = useMemo(() => {
    if (monthFilters.length !== 1) return 0;
    const currentKey = monthFilters[0];
    const [year, month] = currentKey.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevKey = toMonthKey(prevDate);
    return baseFilteredRows.filter((row) => row.monthKey === prevKey).length;
  }, [baseFilteredRows, monthFilters]);

  // ── Driver summary (only when exactly 1 driver filtered) ──
  const driverSummary = useMemo(() => {
    if (driverFilters.length !== 1) return null;
    const driverName = driverFilters[0];
    const driverAlerts = filteredAlerts.filter(
      (r) => normalizeLabel(r.driver) === normalizeLabel(driverName),
    );
    const totalAlerts = driverAlerts.length;

    // Most common remark type
    const typeCounts = new Map<string, number>();
    driverAlerts.forEach((r) => {
      typeCounts.set(r.remarks, (typeCounts.get(r.remarks) ?? 0) + 1);
    });
    let mostCommonType = '';
    let maxCount = 0;
    typeCounts.forEach((count, type) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonType = type;
      }
    });

    // Active days
    const daySet = new Set<string>();
    driverAlerts.forEach((r) => {
      if (r.parsedDate) daySet.add(toDayKey(r.parsedDate));
    });
    const activeDays = daySet.size;

    const safetyScore = computeDriverSafetyScore(totalAlerts, activeDays);

    return { driverName, totalAlerts, mostCommonType, safetyScore, activeDays };
  }, [driverFilters, filteredAlerts]);

  // ── Fleet comparison data (bar chart) ──
  const fleetComparisonData = useMemo(() => {
    if (fleetFilters.length > 0 || organizationName) return null;
    const fleetCounts = new Map<string, number>();
    filteredAlerts.forEach((r) => {
      if (r.fleet && r.fleet !== '—') {
        fleetCounts.set(r.fleet, (fleetCounts.get(r.fleet) ?? 0) + 1);
      }
    });
    if (fleetCounts.size <= 1) return null;
    return Array.from(fleetCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));
  }, [filteredAlerts, fleetFilters.length, organizationName]);

  // ── Alert type donut data ──
  const alertTypeDonut = useMemo(() => {
    const counts = new Map<string, number>();
    filteredAlerts.forEach((r) => {
      if (r.remarks && r.remarks !== '—') {
        counts.set(r.remarks, (counts.get(r.remarks) ?? 0) + 1);
      }
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));
  }, [filteredAlerts]);

  // ── Top vehicles by alert count ──
  const topVehicles = useMemo(() => {
    const counts = new Map<string, number>();
    filteredAlerts.forEach((r) => {
      if (r.vehicle && r.vehicle !== '—') {
        counts.set(r.vehicle, (counts.get(r.vehicle) ?? 0) + 1);
      }
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, value]) => ({ label, value }));
  }, [filteredAlerts]);

  // ── Top drivers by alert count ──
  const topDrivers = useMemo(() => {
    const counts = new Map<string, number>();
    filteredAlerts.forEach((r) => {
      if (r.driver && r.driver !== '—') {
        counts.set(r.driver, (counts.get(r.driver) ?? 0) + 1);
      }
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, value]) => ({ label, value }));
  }, [filteredAlerts]);

  // ── Safety score ──
  const safetyScore = useMemo(() => {
    const daySet = new Set<string>();
    filteredAlerts.forEach((r) => {
      if (r.parsedDate) daySet.add(toDayKey(r.parsedDate));
    });
    const dayCount = daySet.size;
    if (uniqueVehicles === 0 || dayCount === 0) return 100;
    const alertsPerVehiclePerDay = filteredAlerts.length / uniqueVehicles / dayCount;
    const penalty = Math.min(70, alertsPerVehiclePerDay * 70);
    return Math.round(Math.max(0, 100 - penalty));
  }, [filteredAlerts, uniqueVehicles]);

  // ── Alerts with video count ──
  const videoCount = useMemo(
    () => filteredAlerts.filter((r) => hasVideoLink(r.videoUrl)).length,
    [filteredAlerts],
  );

  // ── Speed analysis ──
  const avgSpeed = useMemo(() => {
    const speeds: number[] = [];
    filteredAlerts.forEach((r) => {
      const n = parseFloat(r.speed);
      if (!isNaN(n) && n > 0) speeds.push(n);
    });
    if (speeds.length === 0) return 0;
    return Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length);
  }, [filteredAlerts]);

  // ── DataTable columns ──
  const tableColumns = useMemo<Column<AlertRow>[]>(
    () => [
      {
        key: 'time',
        label: lang === 'th' ? 'วันเวลาแจ้งเตือน' : 'Alert time',
        sortable: true,
        render: (_v, row) => (
          <span className="text-zinc-600 dark:text-zinc-300">{row.time}</span>
        ),
      },
      {
        key: 'vehicle',
        label: lang === 'th' ? 'รถ' : 'Vehicle',
        sortable: true,
        render: (_v, row) => (
          <span className="font-semibold text-zinc-900 dark:text-white">{row.vehicle}</span>
        ),
      },
      {
        key: 'driver',
        label: lang === 'th' ? 'คนขับ' : 'Driver',
        sortable: true,
      },
      {
        key: 'speed',
        label: lang === 'th' ? 'ความเร็ว' : 'Speed',
        sortable: true,
      },
      {
        key: 'fleet',
        label: lang === 'th' ? 'ฟลีท' : 'Fleet',
        sortable: true,
      },
      {
        key: 'remarks',
        label: lang === 'th' ? 'ประเภทการแจ้งเตือน' : 'Alert type',
        sortable: true,
        render: (_v, row) => (
          <span className={getRemarkBadgeClass(row.remarks)}>{row.remarks}</span>
        ),
      },
      {
        key: 'videoUrl',
        label: lang === 'th' ? 'วิดีโอ' : 'Video',
        sortable: false,
        render: (_v, row) =>
          hasVideoLink(row.videoUrl) ? (
            <a
              href={row.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-red-600 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300"
            >
              {lang === 'th' ? 'ดู' : 'Watch'}
            </a>
          ) : (
            <span className="text-zinc-400">—</span>
          ),
      },
    ],
    [lang],
  );

  // ── Export data ──
  const exportData = useMemo(
    () =>
      filteredAlerts.map((r) => ({
        time: r.time,
        vehicle: r.vehicle,
        driver: r.driver,
        speed: r.speed,
        fleet: r.fleet,
        remarks: r.remarks,
        videoUrl: r.videoUrl,
      })),
    [filteredAlerts],
  );

  // Date range string for export filename
  const dateRangeLabel = useMemo(() => {
    if (monthFilters.length === 0) return undefined;
    return monthFilters.sort().join('_');
  }, [monthFilters]);

  // Active filter count for DashboardShell
  const activeFilterCount =
    monthFilters.length +
    fleetFilters.length +
    remarkFilters.length +
    vehicleFilters.length +
    driverFilters.length +
    (showExcluded ? 1 : 0);

  // Check if data might be stale (lastUpdated > 10 minutes ago)
  const isStale = useMemo(() => {
    if (!lastUpdated) return false;
    return Date.now() - lastUpdated.getTime() > 10 * 60 * 1000;
  }, [lastUpdated]);

  return (
    <DashboardShell
      title={dashboardName}
      subtitle={lang === 'th' ? 'แดชบอร์ดรายละเอียด' : 'Detail dashboard'}
      lang={lang}
      lastUpdated={lastUpdated}
      notes={dashboardNotes}
      isStale={isStale}
      activeFilterCount={activeFilterCount}
      actions={
        <ExportButton
          data={exportData}
          dashboardName="DetailDashboard"
          dateRange={dateRangeLabel}
          columns={[
            { key: 'time', label: 'Alert Time' },
            { key: 'vehicle', label: 'Vehicle' },
            { key: 'driver', label: 'Driver' },
            { key: 'speed', label: 'Speed' },
            { key: 'fleet', label: 'Fleet' },
            { key: 'remarks', label: 'Alert Type' },
            { key: 'videoUrl', label: 'Video URL' },
          ]}
          label={lang === 'th' ? 'ส่งออก CSV' : 'Export CSV'}
        />
      }
    >
      {loading ? (
        <LoadingState
          lang={lang}
          message={lang === 'th' ? 'กำลังโหลดการแจ้งเตือนแบบละเอียด...' : 'Loading detailed alerts...'}
          detail={lang === 'th' ? 'กำลังสร้างไทม์ไลน์การแจ้งเตือนล่าสุด' : 'Building the latest alert timeline.'}
          fallbackDetail={copy.loadingDetail}
          error={error ?? undefined}
          onRetry={error ? refresh : undefined}
        />
      ) : error ? (
        <LoadingState
          lang={lang}
          error={error}
          onRetry={refresh}
        />
      ) : (
        <>
          {/* ── Filters ── */}
          <FilterBar>
            <InlineMonthPicker value={filters.monthFilters} onChange={(v) => setFilters(f => ({ ...f, monthFilters: v as string[] }))} multi lang={lang} />
            {!organizationName && (
              <MultiSelect label={lang === 'th' ? 'กลุ่มรถ' : 'fleets'} options={fleetOptions} selected={filters.fleetFilters} onChange={(v) => setFilters(f => ({ ...f, fleetFilters: v }))} lang={lang} />
            )}
            <MultiSelect label={lang === 'th' ? 'ประเภท' : 'types'} options={remarkOptions} selected={filters.remarkFilters} onChange={(v) => setFilters(f => ({ ...f, remarkFilters: v }))} lang={lang} />
            <MultiSelect label={lang === 'th' ? 'ยานพาหนะ' : 'vehicles'} options={vehicleOptions} selected={filters.vehicleFilters} onChange={(v) => setFilters(f => ({ ...f, vehicleFilters: v }))} lang={lang} />
            <MultiSelect label={lang === 'th' ? 'คนขับ' : 'drivers'} options={driverOptions} selected={filters.driverFilters} onChange={(v) => setFilters(f => ({ ...f, driverFilters: v }))} lang={lang} />
            <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <input type="checkbox" checked={filters.showExcluded} onChange={(e) => setFilters(f => ({ ...f, showExcluded: e.target.checked }))} className="rounded border-zinc-300" />
              {lang === 'th' ? 'แสดงที่ยกเว้น' : 'Show excluded'}
            </label>
            {hasActiveFilters && (
              <button type="button" onClick={resetFilters} className="ml-auto text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">{lang === 'th' ? 'รีเซ็ต' : 'Reset'}</button>
            )}
          </FilterBar>

          {/* ── KPI Row with Safety Score ── */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className={`${dashboardSectionClass} flex flex-col items-center justify-center`}>
              <SafetyScore
                score={safetyScore}
                size={100}
                tooltip={lang === 'th' ? 'คะแนนความปลอดภัยตามจำนวนการแจ้งเตือนต่อคันต่อวัน' : 'Safety score based on alerts per vehicle per day'}
              />
            </div>
            <KpiCard
              label={lang === 'th' ? 'การแจ้งเตือนทั้งหมด' : 'Total alerts'}
              value={filteredAlerts.length}
              trend={
                previousMonthAlertCount > 0
                  ? {
                      value:
                        Math.round(
                          ((filteredAlerts.length - previousMonthAlertCount) /
                            previousMonthAlertCount) *
                            1000,
                        ) / 10,
                      label: lang === 'th' ? 'เทียบเดือนก่อน' : 'vs last month',
                    }
                  : undefined
              }
            />
            <KpiCard
              label={lang === 'th' ? 'รถที่ไม่ซ้ำ' : 'Unique vehicles'}
              value={uniqueVehicles}
            />
            <KpiCard
              label={lang === 'th' ? 'คนขับที่ไม่ซ้ำ' : 'Unique drivers'}
              value={uniqueDrivers}
            />
            <KpiCard
              label={lang === 'th' ? 'ความเร็วเฉลี่ย' : 'Avg speed'}
              value={avgSpeed > 0 ? `${avgSpeed} km/h` : '—'}
              subtitle={videoCount > 0 ? `${videoCount} ${lang === 'th' ? 'วิดีโอ' : 'videos'}` : undefined}
            />
          </section>

          {/* ── Section divider: Alert Analysis ── */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-red-400/50 to-transparent dark:via-red-600/30" />
            <svg width="6" height="6" viewBox="0 0 6 6" className="shrink-0 text-red-400/50" aria-hidden="true"><polygon points="3,0 6,3 3,6 0,3" fill="currentColor" /></svg>
            <span className="text-xs font-semibold uppercase tracking-widest text-red-600 dark:text-red-400">
              {lang === 'th' ? 'วิเคราะห์การแจ้งเตือน' : 'Alert Analysis'}
            </span>
            <svg width="6" height="6" viewBox="0 0 6 6" className="shrink-0 text-red-400/50" aria-hidden="true"><polygon points="3,0 6,3 3,6 0,3" fill="currentColor" /></svg>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-red-400/50 to-transparent dark:via-red-600/30" />
          </div>

          {/* ── Daily trend + Alert type donut (3:2 split) ── */}
          <div className="grid gap-4 lg:grid-cols-5">
            <section className={`lg:col-span-3 ${dashboardSectionClass}`}>
              <div className="flex items-center justify-between gap-4">
                <h2 className={heading2}>
                  {lang === 'th' ? 'แนวโน้มการแจ้งเตือนรายวัน' : 'Daily alert trend'}
                </h2>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                <span className="uppercase tracking-[0.2em] text-zinc-500">
                  {lang === 'th' ? 'แสดง' : 'Show'}
                </span>
                {availableTrendRemarkOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFilters(f => ({ ...f, trendRemarkFilter: option.value }))}
                    className={[
                      'rounded-full px-2.5 py-1 text-xs font-medium transition',
                      trendRemarkFilter === option.value
                        ? 'bg-red-600 text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700',
                    ].join(' ')}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="mt-4">
                {trendChartData.length === 0 ? (
                  <p className={textSecondary}>
                    {lang === 'th'
                      ? 'ไม่มีกิจกรรมการแจ้งเตือนสำหรับตัวกรองที่เลือก'
                      : 'No alert activity for the selected filters.'}
                  </p>
                ) : (
                  <TrendChart
                    data={trendChartData}
                    mode="line"
                    height={260}
                    colors={CHART_COLORS}
                    ariaLabel={lang === 'th' ? 'แนวโน้มการแจ้งเตือนรายวัน' : 'Daily alert trend'}
                  />
                )}
              </div>
            </section>
            <section className={`lg:col-span-2 ${dashboardSectionClass}`}>
              <h2 className={heading2}>
                {lang === 'th' ? 'สัดส่วนประเภทการแจ้งเตือน' : 'Alert type breakdown'}
              </h2>
              <div className="mt-4">
                <DonutChart
                  data={alertTypeDonut}
                  centerLabel={lang === 'th' ? 'ทั้งหมด' : 'total'}
                  ariaLabel={lang === 'th' ? 'สัดส่วนประเภทการแจ้งเตือน' : 'Alert type breakdown'}
                />
              </div>
            </section>
          </div>

          {/* ── Heatmap + Top vehicles (2:2 split) ── */}
          <div className="grid gap-4 lg:grid-cols-2">
            {heatmapDates.length > 0 && (
              <section className={dashboardSectionClass}>
                <h2 className={heading2}>
                  {lang === 'th' ? 'แผนที่ความร้อน' : 'Alert heatmap'}
                </h2>
                <p className={`mt-1 ${textSecondary}`}>
                  {lang === 'th'
                    ? 'การกระจายตามวันในสัปดาห์และชั่วโมง'
                    : 'Distribution by day of week and hour.'}
                </p>
                <div className="mt-4">
                  <AlertHeatmap dates={heatmapDates} />
                </div>
              </section>
            )}
            {topVehicles.length > 0 && (
              <section className={dashboardSectionClass}>
                <h2 className={heading2}>
                  {lang === 'th' ? 'ยานพาหนะ 10 อันดับแรก' : 'Top 10 vehicles'}
                </h2>
                <p className={`mt-1 ${textSecondary}`}>
                  {lang === 'th' ? 'เรียงตามจำนวนการแจ้งเตือน' : 'Ranked by alert count.'}
                </p>
                <div className="mt-4">
                  <TrendChart
                    data={topVehicles}
                    mode="bar"
                    height={260}
                    colors={CHART_COLORS}
                    ariaLabel={lang === 'th' ? 'ยานพาหนะ 10 อันดับแรก' : 'Top 10 vehicles by alerts'}
                  />
                </div>
              </section>
            )}
          </div>

          {/* ── Section divider: Driver Intelligence ── */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-300 to-transparent dark:via-zinc-700/50" />
            <svg width="6" height="6" viewBox="0 0 6 6" className="shrink-0 text-zinc-300 dark:text-zinc-600" aria-hidden="true"><polygon points="3,0 6,3 3,6 0,3" fill="currentColor" /></svg>
            <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              {lang === 'th' ? 'ข้อมูลคนขับ' : 'Driver Intelligence'}
            </span>
            <svg width="6" height="6" viewBox="0 0 6 6" className="shrink-0 text-zinc-300 dark:text-zinc-600" aria-hidden="true"><polygon points="3,0 6,3 3,6 0,3" fill="currentColor" /></svg>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-300 to-transparent dark:via-zinc-700/50" />
          </div>

          {/* ── Top drivers bar chart ── */}
          {topDrivers.length > 0 && (
            <section className={dashboardSectionClass}>
              <h2 className={heading2}>
                {lang === 'th' ? 'คนขับ 10 อันดับแรก' : 'Top 10 drivers by alerts'}
              </h2>
              <p className={`mt-1 ${textSecondary}`}>
                {lang === 'th' ? 'คนขับที่มีการแจ้งเตือนมากที่สุด' : 'Drivers with the most alerts in the filtered period.'}
              </p>
              <div className="mt-4">
                <TrendChart
                  data={topDrivers}
                  mode="bar"
                  height={280}
                  colors={CHART_COLORS}
                  ariaLabel={lang === 'th' ? 'คนขับ 10 อันดับแรก' : 'Top 10 drivers by alerts'}
                />
              </div>
            </section>
          )}

          {/* ── Driver Summary (when exactly 1 driver filtered) ── */}
          {driverSummary ? (
            <section className={dashboardSectionClass}>
              <DriverSummaryCards
                driverName={driverSummary.driverName}
                totalAlerts={driverSummary.totalAlerts}
                mostCommonType={driverSummary.mostCommonType}
                safetyScore={driverSummary.safetyScore}
                activeDays={driverSummary.activeDays}
                lang={lang}
              />
            </section>
          ) : null}

          {/* ── Fleet Comparison (bar chart — only when no fleet filter) ── */}
          {fleetComparisonData ? (
            <section className={dashboardSectionClass}>
              <h2 className={heading2}>
                {lang === 'th' ? 'เปรียบเทียบฟลีท' : 'Fleet comparison'}
              </h2>
              <p className={`mt-1 ${textSecondary}`}>
                {lang === 'th'
                  ? 'จำนวนการแจ้งเตือนเปรียบเทียบระหว่างฟลีท'
                  : 'Alert count comparison across fleets.'}
              </p>
              <div className="mt-4">
                <TrendChart
                  data={fleetComparisonData}
                  mode="bar"
                  height={280}
                  colors={CHART_COLORS}
                  ariaLabel={lang === 'th' ? 'เปรียบเทียบฟลีท' : 'Fleet comparison'}
                />
              </div>
            </section>
          ) : null}

          {/* ── Section divider: Evidence & Timeline ── */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-300 to-transparent dark:via-zinc-700/50" />
            <svg width="6" height="6" viewBox="0 0 6 6" className="shrink-0 text-zinc-300 dark:text-zinc-600" aria-hidden="true"><polygon points="3,0 6,3 3,6 0,3" fill="currentColor" /></svg>
            <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              {lang === 'th' ? 'หลักฐานและไทม์ไลน์' : 'Evidence & Timeline'}
            </span>
            <svg width="6" height="6" viewBox="0 0 6 6" className="shrink-0 text-zinc-300 dark:text-zinc-600" aria-hidden="true"><polygon points="3,0 6,3 3,6 0,3" fill="currentColor" /></svg>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-300 to-transparent dark:via-zinc-700/50" />
          </div>

          {/* ── Alert Timeline ── */}
          <AlertTimeline entries={timelineEntries} maxEntries={30} lang={lang} />

          {/* ── Video Evidence ── */}
          <VideoEvidence entries={videoEntries} maxPerType={10} lang={lang} />

          {/* ── Section divider: Full Data ── */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-300 to-transparent dark:via-zinc-700/50" />
            <svg width="6" height="6" viewBox="0 0 6 6" className="shrink-0 text-zinc-300 dark:text-zinc-600" aria-hidden="true"><polygon points="3,0 6,3 3,6 0,3" fill="currentColor" /></svg>
            <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              {lang === 'th' ? 'ข้อมูลทั้งหมด' : 'Full Data'}
            </span>
            <svg width="6" height="6" viewBox="0 0 6 6" className="shrink-0 text-zinc-300 dark:text-zinc-600" aria-hidden="true"><polygon points="3,0 6,3 3,6 0,3" fill="currentColor" /></svg>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-300 to-transparent dark:via-zinc-700/50" />
          </div>

          {/* ── Data Table ── */}
          <section className={dashboardSectionClass}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className={heading2}>
                {lang === 'th' ? 'ตารางการแจ้งเตือน' : 'Alert records'}
              </h2>
              <span className={textSecondary}>
                {filteredAlerts.length === 0
                  ? (lang === 'th' ? 'ไม่มีการแจ้งเตือนที่จะแสดง' : 'No alerts to show.')
                  : `${filteredAlerts.length} ${lang === 'th' ? 'รายการ' : 'records'}`}
              </span>
            </div>
            <div className="mt-4">
              <DataTable
                columns={tableColumns}
                data={filteredAlerts}
                defaultSort={{ key: 'time', direction: 'desc' }}
                pageSize={20}
                ariaLabel={lang === 'th' ? 'ตารางการแจ้งเตือน' : 'Alerts table'}
              />
            </div>
          </section>
        </>
      )}
    </DashboardShell>
  );
}

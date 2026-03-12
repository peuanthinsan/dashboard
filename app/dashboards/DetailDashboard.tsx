'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import useGoogleSheet from './useGoogleSheet';
import { formatDateTimeGB } from './dateFormat';
import { loadStoredFilters, saveStoredFilters } from './filterStorage';
import { FilterChip } from './FilterChip';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import FilterGroup from './FilterGroup';
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
import {
  heading2,
  textSecondary,
  inputBase,
  cardSection,
  badgeDefault,
  badgeWarning,
  badgeDanger,
  badgeInfo,
  CHART_COLORS,
} from 'app/ui/design-tokens';

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
  const [monthSearch, setMonthSearch] = useState('');
  const [monthFilters, setMonthFilters] = useState<string[]>([]);
  const [fleetSearch, setFleetSearch] = useState('');
  const [fleetFilters, setFleetFilters] = useState<string[]>([]);
  const [remarkSearch, setRemarkSearch] = useState('');
  const [remarkFilters, setRemarkFilters] = useState<string[]>([]);
  const [trendRemarkFilter, setTrendRemarkFilter] = useState('all');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [vehicleFilters, setVehicleFilters] = useState<string[]>([]);
  const [driverSearch, setDriverSearch] = useState('');
  const [driverFilters, setDriverFilters] = useState<string[]>([]);
  const [showExcluded, setShowExcluded] = useState(false);
  const didSetDefaultMonth = useRef(false);
  const storageKey = useMemo(() => dashboardId, [dashboardId]);

  // Persist / restore filters
  useEffect(() => {
    const stored = loadStoredFilters<DetailFilterState>(storageKey);
    if (!stored) return;
    didSetDefaultMonth.current = true;
    if (Array.isArray(stored.monthFilters)) {
      setMonthFilters(stored.monthFilters.filter((value) => typeof value === 'string'));
    }
    if (Array.isArray(stored.fleetFilters)) {
      setFleetFilters(stored.fleetFilters.filter((value) => typeof value === 'string'));
    }
    if (Array.isArray(stored.remarkFilters)) {
      setRemarkFilters(stored.remarkFilters.filter((value) => typeof value === 'string'));
    }
    if (Array.isArray(stored.vehicleFilters)) {
      setVehicleFilters(stored.vehicleFilters.filter((value) => typeof value === 'string'));
    }
    if (Array.isArray(stored.driverFilters)) {
      setDriverFilters(stored.driverFilters.filter((value) => typeof value === 'string'));
    }
    if (typeof stored.trendRemarkFilter === 'string') {
      setTrendRemarkFilter(stored.trendRemarkFilter);
    }
    if (typeof stored.showExcluded === 'boolean') {
      setShowExcluded(stored.showExcluded);
    }
  }, [storageKey]);

  useEffect(() => {
    saveStoredFilters(storageKey, {
      monthFilters,
      fleetFilters,
      remarkFilters,
      vehicleFilters,
      driverFilters,
      trendRemarkFilter,
      showExcluded,
    });
  }, [
    driverFilters,
    fleetFilters,
    monthFilters,
    remarkFilters,
    showExcluded,
    storageKey,
    trendRemarkFilter,
    vehicleFilters,
  ]);

  const handleSearchAdd = <T,>(
    searchValue: string,
    findMatch: (trimmed: string) => T | undefined,
    onMatch: (match: T) => void,
    clearSearch: () => void,
  ) => {
    const trimmed = searchValue.trim();
    if (!trimmed) return;
    const matched = findMatch(trimmed);
    if (!matched) return;
    onMatch(matched);
    clearSearch();
  };

  const resetFilters = () => {
    setMonthSearch('');
    setMonthFilters([]);
    setFleetSearch('');
    setFleetFilters([]);
    setRemarkSearch('');
    setRemarkFilters([]);
    setVehicleSearch('');
    setVehicleFilters([]);
    setDriverSearch('');
    setDriverFilters([]);
    setShowExcluded(false);
  };

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

  const filteredFleetOptions = useMemo(() => {
    const trimmedSearch = fleetSearch.trim();
    if (!trimmedSearch) return fleetOptions;
    const normalizedSearch = normalizeLabel(trimmedSearch);
    return fleetOptions.filter((option) => normalizeLabel(option).includes(normalizedSearch));
  }, [fleetOptions, fleetSearch]);

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

  const filteredRemarkOptions = useMemo(() => {
    const trimmedSearch = remarkSearch.trim();
    if (!trimmedSearch) return remarkOptions;
    const normalizedSearch = normalizeLabel(trimmedSearch);
    return remarkOptions.filter((option) => normalizeLabel(option).includes(normalizedSearch));
  }, [remarkOptions, remarkSearch]);

  const vehicleOptions = useMemo(() => {
    const unique = new Set<string>();
    alertRows.forEach((row) => {
      if (row.vehicle && row.vehicle !== '—') unique.add(row.vehicle);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [alertRows]);

  const filteredVehicleOptions = useMemo(() => {
    const trimmedSearch = vehicleSearch.trim();
    if (!trimmedSearch) return vehicleOptions;
    const normalizedSearch = normalizeLabel(trimmedSearch);
    return vehicleOptions.filter((option) => normalizeLabel(option).includes(normalizedSearch));
  }, [vehicleOptions, vehicleSearch]);

  const driverOptions = useMemo(() => {
    const unique = new Set<string>();
    alertRows.forEach((row) => {
      if (row.driver && row.driver !== '—') unique.add(row.driver);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [alertRows]);

  const filteredDriverOptions = useMemo(() => {
    const trimmedSearch = driverSearch.trim();
    if (!trimmedSearch) return driverOptions;
    const normalizedSearch = normalizeLabel(trimmedSearch);
    return driverOptions.filter((option) => normalizeLabel(option).includes(normalizedSearch));
  }, [driverOptions, driverSearch]);

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

  const filteredMonthOptions = useMemo(() => {
    const trimmedSearch = monthSearch.trim();
    if (!trimmedSearch) return monthOptions;
    const normalizedSearch = normalizeLabel(trimmedSearch);
    return monthOptions.filter((option) => normalizeLabel(option.label).includes(normalizedSearch));
  }, [monthOptions, monthSearch]);

  useEffect(() => {
    if (didSetDefaultMonth.current) return;
    if (monthOptions.length === 0) return;
    if (monthFilters.length > 0) {
      didSetDefaultMonth.current = true;
      return;
    }
    didSetDefaultMonth.current = true;
    if (monthOptions.some((option) => option.key === currentMonthKey)) {
      setMonthFilters([currentMonthKey]);
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
    setTrendRemarkFilter('all');
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
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
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
          {/* ── KPI Row ── */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              label={lang === 'th' ? 'ตัวกรองที่ใช้' : 'Filtered alerts'}
              value={filteredAlerts.length}
              subtitle={
                baseFilteredRows.length !== filteredAlerts.length
                  ? `${lang === 'th' ? 'จากทั้งหมด' : 'of'} ${baseFilteredRows.length} ${lang === 'th' ? 'รายการ' : 'total'}`
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
          </section>

          {/* ── Filters ── */}
          <section className={dashboardSectionClass}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className={heading2}>{lang === 'th' ? 'ตัวกรอง' : 'Filters'}</h2>
                <p className={`mt-1 ${textSecondary}`}>
                  {lang === 'th' ? 'กรองการแจ้งเตือนตามประเภทการแจ้งเตือน เดือน ฟลีท หรือรถ' : 'Narrow alerts by alert type, month, fleet, or vehicle.'}
                </p>
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="text-sm font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                {lang === 'th' ? 'รีเซ็ตตัวกรอง' : 'Reset filters'}
              </button>
            </div>
            <div className="mt-4 space-y-3 text-xs text-zinc-600 dark:text-zinc-300">
              {/* Month filter */}
              <FilterGroup
                label={lang === 'th' ? 'กรองเดือน' : 'Filter months'}
                lang={lang}
                onClear={() => setMonthFilters([])}
                count={monthFilters.length}
              >
                <div className="flex flex-wrap gap-2">
                  {monthFilters.map((monthKey) => {
                    const monthLabel = monthOptions.find((option) => option.key === monthKey)?.label ?? monthKey;
                    return (
                      <FilterChip
                        key={monthKey}
                        active
                        onClick={() => setMonthFilters((current) => current.filter((value) => value !== monthKey))}
                      >
                        {monthLabel} &times;
                      </FilterChip>
                    );
                  })}
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <input
                    list="month-options"
                    value={monthSearch}
                    onChange={(event) => setMonthSearch(event.target.value)}
                    placeholder={monthOptions.length === 0 ? (lang === 'th' ? 'ไม่มีเดือนให้เลือก' : 'No months available') : (lang === 'th' ? 'ค้นหาเดือน' : 'Search months')}
                    className={`${inputBase} sm:min-w-[220px] sm:w-auto`}
                  />
                  <datalist id="month-options">
                    {filteredMonthOptions.map((option) => (
                      <option key={option.key} value={option.label} />
                    ))}
                  </datalist>
                  <button
                    type="button"
                    onClick={() =>
                      handleSearchAdd(
                        monthSearch,
                        (trimmed) =>
                          monthOptions.find(
                            (option) =>
                              option.key === trimmed || normalizeLabel(option.label) === normalizeLabel(trimmed),
                          ),
                        (matched) =>
                          setMonthFilters((current) =>
                            current.includes(matched.key) ? current : [...current, matched.key],
                          ),
                        () => setMonthSearch(''),
                      )
                    }
                    className="rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-1 text-xs text-zinc-700 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-zinc-500"
                  >
                    {lang === 'th' ? 'เพิ่ม' : 'Add'}
                  </button>
                </div>
              </FilterGroup>

              {/* Fleet filter (hidden when scoped to organization) */}
              {organizationName ? null : (
                <FilterGroup
                  label={lang === 'th' ? 'กรองฟลีท' : 'Filter fleets'}
                  lang={lang}
                  onClear={() => setFleetFilters([])}
                  count={fleetFilters.length}
                >
                  <div className="flex flex-wrap gap-2">
                    {fleetFilters.map((fleet) => (
                      <FilterChip
                        key={fleet}
                        active
                        onClick={() => setFleetFilters((current) => current.filter((value) => value !== fleet))}
                      >
                        {fleet} &times;
                      </FilterChip>
                    ))}
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <input
                      list="fleet-options"
                      value={fleetSearch}
                      onChange={(event) => setFleetSearch(event.target.value)}
                      placeholder={fleetOptions.length === 0 ? (lang === 'th' ? 'ไม่มีฟลีทให้เลือก' : 'No fleets available') : (lang === 'th' ? 'ค้นหาฟลีท' : 'Search fleets')}
                      className={`${inputBase} sm:min-w-[220px] sm:w-auto`}
                    />
                    <datalist id="fleet-options">
                      {filteredFleetOptions.map((option) => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                    <button
                      type="button"
                      onClick={() =>
                        handleSearchAdd(
                          fleetSearch,
                          (trimmed) => fleetOptions.find((option) => normalizeLabel(option) === normalizeLabel(trimmed)),
                          (matched) =>
                            setFleetFilters((current) => (current.includes(matched) ? current : [...current, matched])),
                          () => setFleetSearch(''),
                        )
                      }
                      className="rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-1 text-xs text-zinc-700 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-zinc-500"
                    >
                      {lang === 'th' ? 'เพิ่ม' : 'Add'}
                    </button>
                  </div>
                </FilterGroup>
              )}

              {/* Alert type filter */}
              <FilterGroup
                label={lang === 'th' ? 'กรองประเภทการแจ้งเตือน' : 'Filter alert types'}
                lang={lang}
                onClear={() => setRemarkFilters([])}
                count={remarkFilters.length}
              >
                <div className="flex flex-wrap gap-2">
                  {remarkFilters.map((remark) => (
                    <FilterChip
                      key={remark}
                      active
                      onClick={() => setRemarkFilters((current) => current.filter((value) => value !== remark))}
                    >
                      {remark} &times;
                    </FilterChip>
                  ))}
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <input
                    list="remark-options"
                    value={remarkSearch}
                    onChange={(event) => setRemarkSearch(event.target.value)}
                    placeholder={remarkOptions.length === 0 ? (lang === 'th' ? 'ไม่มีประเภทการแจ้งเตือนให้เลือก' : 'No alert types available') : (lang === 'th' ? 'ค้นหาประเภทการแจ้งเตือน' : 'Search alert types')}
                    className={`${inputBase} sm:min-w-[220px] sm:w-auto`}
                  />
                  <datalist id="remark-options">
                    {filteredRemarkOptions.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                  <button
                    type="button"
                    onClick={() =>
                      handleSearchAdd(
                        remarkSearch,
                        (trimmed) =>
                          remarkOptions.find((option) => normalizeLabel(option) === normalizeLabel(trimmed)),
                        (matched) =>
                          setRemarkFilters((current) => (current.includes(matched) ? current : [...current, matched])),
                        () => setRemarkSearch(''),
                      )
                    }
                    className="rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-1 text-xs text-zinc-700 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-zinc-500"
                  >
                    {lang === 'th' ? 'เพิ่ม' : 'Add'}
                  </button>
                </div>
              </FilterGroup>

              {/* Vehicle filter */}
              <FilterGroup
                label={lang === 'th' ? 'กรองรถ' : 'Filter vehicles'}
                lang={lang}
                onClear={() => setVehicleFilters([])}
                count={vehicleFilters.length}
              >
                <div className="flex flex-wrap gap-2">
                  {vehicleFilters.map((vehicle) => (
                    <FilterChip
                      key={vehicle}
                      active
                      onClick={() => setVehicleFilters((current) => current.filter((value) => value !== vehicle))}
                    >
                      {vehicle} &times;
                    </FilterChip>
                  ))}
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <input
                    list="vehicle-options"
                    value={vehicleSearch}
                    onChange={(event) => setVehicleSearch(event.target.value)}
                    placeholder={vehicleOptions.length === 0 ? (lang === 'th' ? 'ไม่มีรถให้เลือก' : 'No vehicles available') : (lang === 'th' ? 'ค้นหารถ' : 'Search vehicles')}
                    className={`${inputBase} sm:min-w-[220px] sm:w-auto`}
                  />
                  <datalist id="vehicle-options">
                    {filteredVehicleOptions.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                  <button
                    type="button"
                    onClick={() =>
                      handleSearchAdd(
                        vehicleSearch,
                        (trimmed) =>
                          vehicleOptions.find((option) => normalizeLabel(option) === normalizeLabel(trimmed)),
                        (matched) =>
                          setVehicleFilters((current) => (current.includes(matched) ? current : [...current, matched])),
                        () => setVehicleSearch(''),
                      )
                    }
                    className="rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-1 text-xs text-zinc-700 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-zinc-500"
                  >
                    {lang === 'th' ? 'เพิ่ม' : 'Add'}
                  </button>
                </div>
              </FilterGroup>

              {/* Driver filter */}
              {driverOptions.length > 0 ? (
                <FilterGroup
                  label={lang === 'th' ? 'กรองคนขับ' : 'Filter drivers'}
                  lang={lang}
                  onClear={() => setDriverFilters([])}
                  count={driverFilters.length}
                >
                  <div className="flex flex-wrap gap-2">
                    {driverFilters.map((driver) => (
                      <FilterChip
                        key={driver}
                        active
                        onClick={() => setDriverFilters((current) => current.filter((value) => value !== driver))}
                      >
                        {driver} &times;
                      </FilterChip>
                    ))}
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <input
                      list="driver-options"
                      value={driverSearch}
                      onChange={(event) => setDriverSearch(event.target.value)}
                      placeholder={driverOptions.length === 0 ? (lang === 'th' ? 'ไม่มีคนขับให้เลือก' : 'No drivers available') : (lang === 'th' ? 'ค้นหาคนขับ' : 'Search drivers')}
                      className={`${inputBase} sm:min-w-[220px] sm:w-auto`}
                    />
                    <datalist id="driver-options">
                      {filteredDriverOptions.map((option) => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                    <button
                      type="button"
                      onClick={() =>
                        handleSearchAdd(
                          driverSearch,
                          (trimmed) =>
                            driverOptions.find((option) => normalizeLabel(option) === normalizeLabel(trimmed)),
                          (matched) =>
                            setDriverFilters((current) => (current.includes(matched) ? current : [...current, matched])),
                          () => setDriverSearch(''),
                        )
                      }
                      className="rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-1 text-xs text-zinc-700 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-zinc-500"
                    >
                      {lang === 'th' ? 'เพิ่ม' : 'Add'}
                    </button>
                  </div>
                </FilterGroup>
              ) : null}

              {/* Options / excluded toggle */}
              <FilterGroup
                label={lang === 'th' ? 'ตัวกรองเพิ่มเติม' : 'Options'}
                lang={lang}
              >
                <FilterChip
                  active={showExcluded}
                  onClick={() => setShowExcluded((prev) => !prev)}
                >
                  {lang === 'th' ? 'แสดงการแจ้งเตือนที่ซ่อน' : 'Show excluded alerts'}
                </FilterChip>
              </FilterGroup>
            </div>
          </section>

          {/* ── Daily alert trend (TrendChart) ── */}
          <section className={dashboardSectionClass}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className={heading2}>
                  {lang === 'th' ? 'แนวโน้มการแจ้งเตือนรายวัน' : 'Daily alert trend'}
                </h2>
                <p className={`mt-1 ${textSecondary}`}>
                  {lang === 'th' ? 'ยอดรวมรายวันของชุดการแจ้งเตือนที่กรอง' : 'Daily totals for the filtered alert set.'}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
              <span className="uppercase tracking-[0.2em] text-zinc-500">
                {lang === 'th' ? 'แสดง' : 'Show'}
              </span>
              {availableTrendRemarkOptions.map((option) => (
                <FilterChip
                  key={option.value}
                  active={trendRemarkFilter === option.value}
                  onClick={() => setTrendRemarkFilter(option.value)}
                >
                  {option.label}
                </FilterChip>
              ))}
            </div>
            <div className="mt-4">
              {trendChartData.length === 0 ? (
                <p className={textSecondary}>
                  {lang === 'th'
                    ? 'ไม่มีกิจกรรมการแจ้งเตือนสำหรับตัวกรองที่เลือก'
                    : 'No alert activity available for the selected filters.'}
                </p>
              ) : (
                <TrendChart
                  data={trendChartData}
                  mode="line"
                  height={300}
                  colors={CHART_COLORS}
                  ariaLabel={lang === 'th' ? 'แนวโน้มการแจ้งเตือนรายวัน' : 'Daily alert trend'}
                />
              )}
            </div>
          </section>

          {/* ── Heatmap ── */}
          {heatmapDates.length > 0 ? (
            <section className={dashboardSectionClass}>
              <h2 className={heading2}>
                {lang === 'th' ? 'แผนที่ความร้อนของการแจ้งเตือน' : 'Alert heatmap'}
              </h2>
              <p className={`mt-1 ${textSecondary}`}>
                {lang === 'th'
                  ? 'การกระจายตัวของการแจ้งเตือนตามวันในสัปดาห์และชั่วโมง'
                  : 'Alert distribution by day of week and hour.'}
              </p>
              <div className="mt-4">
                <AlertHeatmap dates={heatmapDates} />
              </div>
            </section>
          ) : null}

          {/* ── Alert Timeline ── */}
          <AlertTimeline entries={timelineEntries} maxEntries={30} lang={lang} />

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
                  height={300}
                  colors={CHART_COLORS}
                  ariaLabel={lang === 'th' ? 'เปรียบเทียบฟลีท' : 'Fleet comparison'}
                />
              </div>
            </section>
          ) : null}

          {/* ── Video Evidence ── */}
          <VideoEvidence entries={videoEntries} maxPerType={10} lang={lang} />

          {/* ── Data Table ── */}
          <section className={dashboardSectionClass}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className={heading2}>
                {lang === 'th' ? 'ตารางการแจ้งเตือน' : 'Alerts'}
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
                ariaLabel={lang === 'th' ? 'ตารางการแจ้งเตือน' : 'Alerts table'}
              />
            </div>
          </section>
        </>
      )}
    </DashboardShell>
  );
}

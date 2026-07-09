'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import useGoogleSheet from './useGoogleSheet';
import { formatDateTimeGB } from './dateFormat';
import { loadStoredFilters, saveStoredFilters } from './filterStorage';
import { saveDashboardScore } from './scoreCache';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import LoadingState from './LoadingState';
import { getDashboardCopy, type DashboardLang } from 'app/dashboard/i18n-copy';
import {
  ALLOWED_ALERT_TYPES,
  ALLOWED_REMARK_TARGETS,
  computeDriverSafetyScore,
  computeSafetyScore,
  findValue,
  hasRemark,
  isExcludedAlertRemark,
  normalizeLabel,
  parseDate,
  remarkMatchesAllowedTarget,
  toDayKey,
  toDisplayString,
  toMonthKey,
  toMonthLabel,
  previousMonthKey,
  withDerivedRemark,
  applyAlertRules,
  colorForRemark,
  computeAlertKey,
  resolveScopeFleetNames,
  scopeFleetSet,
  ALERT_TIME_ALIASES,
  type AlertRule,
} from './dashboardDataUtils';

// V2 components
import TrendChart from 'app/ui/TrendChart';
import HorizontalBarChart from 'app/ui/HorizontalBarChart';
import { DataTable, type Column } from 'app/ui/DataTable';
import KpiCard from 'app/ui/KpiCard';
import ExportButton from 'app/ui/ExportButton';
import AlertHeatmap from 'app/ui/AlertHeatmap';
import DonutChart from 'app/ui/DonutChart';
import InlineMonthPicker from 'app/ui/InlineMonthPicker';
import InlineDayPicker from 'app/ui/InlineDayPicker';
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
import AlertDriverNameCell from './AlertDriverNameCell';
import { saveAlertDriverNamesBulk } from './alertDriverActions';

type DashboardProps = {
  dashboardId: string;
  dashboardName: string;
  sheetId: string;
  sheetGid: string;
  dashboardNotes?: string | null;
  organizationName?: string | null;
  organizationNames?: string[] | null;
  lang?: DashboardLang;
  allowedAlertTypes?: string[] | null;
  allowedRemarks?: string[] | null;
  alertRules?: AlertRule[] | null;
  /** When true, show the raw "Alert Type" column from the sheet alongside the mapped remark. */
  isAdmin?: boolean;
  /** Manual driver-name overrides keyed by alert key (loaded server-side from Postgres). */
  driverOverrides?: Record<string, string>;
};

type AlertRow = {
  id: string;
  /** Stable content-derived key used for manual driver-name overrides. */
  alertKey: string;
  /** 1-based row number in the Google Sheet (header = row 1). */
  sheetRowNumber: number;
  sourceRow: Record<string, unknown>;
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
  dayFilters: string[];
  fleetFilters: string[];
  remarkFilters: string[];
  vehicleFilters: string[];
  driverFilters: string[];
  trendRemarkFilter: string;
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
  organizationNames,
  lang = 'en',
  allowedAlertTypes: allowedAlertTypesProp,
  allowedRemarks: allowedRemarksProp,
  alertRules: alertRulesProp,
  isAdmin = false,
  driverOverrides,
}: DashboardProps) {
  const copy = getDashboardCopy(lang);
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const scopeNames = useMemo(
    () => resolveScopeFleetNames(organizationName, organizationNames),
    [organizationName, organizationNames],
  );
  const scopeSet = useMemo(
    () => scopeFleetSet(organizationName, organizationNames),
    [organizationName, organizationNames],
  );
  const defaultMonthKey = useMemo(() => previousMonthKey(), []);
  const [filters, setFilters] = useState<DetailFilterState>({
    monthFilters: [],
    dayFilters: [],
    fleetFilters: scopeNames,
    remarkFilters: [],
    vehicleFilters: [],
    driverFilters: [],
    trendRemarkFilter: 'all',
  });
  const { monthFilters, dayFilters, fleetFilters, remarkFilters, vehicleFilters, driverFilters, trendRemarkFilter } = filters;
  const { rows, columns: sheetColumns, loading, error, lastUpdated, refresh, availableMonths } = useGoogleSheet({
    sheetId,
    gid: sheetGid,
    monthKeys: monthFilters,
    loadMonthCatalog: true,
  });
  // Manual driver-name overrides; seeded from the server, updated optimistically on save.
  const [overrides, setOverrides] = useState<Record<string, string>>(() => driverOverrides ?? {});
  const handleDriverSaved = useCallback((alertKey: string, driverName: string) => {
    setOverrides((prev) => {
      if (!driverName) {
        const next = { ...prev };
        delete next[alertKey];
        return next;
      }
      return { ...prev, [alertKey]: driverName };
    });
  }, []);

  // ── Bulk driver-name editing (row selection + apply-to-all bar) ──
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [bulkDraft, setBulkDraft] = useState('');
  const [isBulkPending, startBulkTransition] = useTransition();
  const [bulkError, setBulkError] = useState(false);
  const toggleSelected = useCallback((alertKey: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(alertKey)) next.delete(alertKey);
      else next.add(alertKey);
      return next;
    });
  }, []);

  const didSetDefaultMonth = useRef(false);
  const storageKey = useMemo(() => dashboardId, [dashboardId]);

  // Persist / restore filters
  useEffect(() => {
    const stored = loadStoredFilters<DetailFilterState>(storageKey);
    if (!stored) return;
    const frame = requestAnimationFrame(() => {
      const storedMonths = Array.isArray(stored.monthFilters)
        ? stored.monthFilters.filter((v) => typeof v === 'string')
        : [];
      if (storedMonths.length > 0) didSetDefaultMonth.current = true;
      setFilters((prev) => ({
        ...prev,
        monthFilters: storedMonths.length > 0 ? storedMonths : prev.monthFilters,
        dayFilters: Array.isArray(stored.dayFilters) ? stored.dayFilters.filter((v) => typeof v === 'string') : prev.dayFilters,
        fleetFilters: (Array.isArray(stored.fleetFilters) && stored.fleetFilters.length > 0) ? stored.fleetFilters.filter((v) => typeof v === 'string') : (scopeNames.length > 0 ? scopeNames : prev.fleetFilters),
        remarkFilters: Array.isArray(stored.remarkFilters) ? stored.remarkFilters.filter((v) => typeof v === 'string') : prev.remarkFilters,
        vehicleFilters: Array.isArray(stored.vehicleFilters) ? stored.vehicleFilters.filter((v) => typeof v === 'string') : prev.vehicleFilters,
        driverFilters: Array.isArray(stored.driverFilters) ? stored.driverFilters.filter((v) => typeof v === 'string') : prev.driverFilters,
        trendRemarkFilter: typeof stored.trendRemarkFilter === 'string' ? stored.trendRemarkFilter : prev.trendRemarkFilter,
      }));
    });
    return () => cancelAnimationFrame(frame);
  }, [storageKey]);

  useEffect(() => {
    saveStoredFilters(storageKey, filters);
  }, [filters, storageKey]);

  const resetFilters = () => {
    setFilters({
      monthFilters: defaultMonthKey ? [defaultMonthKey] : [],
      dayFilters: [],
      fleetFilters: scopeNames,
      remarkFilters: [],
      vehicleFilters: [],
      driverFilters: [],
      trendRemarkFilter: 'all',
    });
  };

  const hasActiveFilters =
    monthFilters.length > 0 ||
    dayFilters.length > 0 ||
    fleetFilters.length > 0 ||
    remarkFilters.length > 0 ||
    vehicleFilters.length > 0 ||
    driverFilters.length > 0;

  // null = allow everything; filter only when admin explicitly sets an allow-list.
  const allowedAlertTypes = useMemo<string[] | null>(
    () => (allowedAlertTypesProp && allowedAlertTypesProp.length > 0 ? allowedAlertTypesProp : null),
    [allowedAlertTypesProp],
  );
  const allowedRemarkTargets = useMemo<string[] | null>(
    () => (allowedRemarksProp && allowedRemarksProp.length > 0 ? allowedRemarksProp : null),
    [allowedRemarksProp],
  );

  // ── Data pipeline: alertRows -> baseFilteredRows -> filteredAlerts ──
  const alertRows = useMemo<AlertRow[]>(() => {
    const rules = alertRulesProp ?? [];
    const mappedRows = rows.map((row, index) => {
      const timeValue = findValue(row, ALERT_TIME_ALIASES);
      const parsedDate = parseDate(timeValue);
      const monthKey = parsedDate ? toMonthKey(parsedDate) : null;
      const monthLabel = parsedDate ? toMonthLabel(parsedDate) : 'Unknown month';
      const alertType = toDisplayString(findValue(row, ['Alert Type']));
      const derived = withDerivedRemark(alertType, toDisplayString(findValue(row, ['Remarks'])));
      const speed = Number(findValue(row, ['Speed', 'Max Speed']) ?? 0) || 0;
      const remarks = applyAlertRules(alertType, derived, speed, rules);
      const vehicle = toDisplayString(findValue(row, ['Vehicle No', 'Vehicle No TH']));
      const alertKey = computeAlertKey({
        vehicle,
        timeRaw: String(timeValue ?? ''),
        alertType,
      });
      return {
        id: `${index}-${findValue(row, ['Vehicle No']) ?? 'vehicle'}`,
        alertKey,
        sheetRowNumber: index + 2,
        sourceRow: row,
        vehicle,
        driver: overrides[alertKey] ?? toDisplayString(findValue(row, ['Driver Name'])),
        alertType,
        time: toDateLabel(timeValue),
        speed: toDisplayString(findValue(row, ['Speed'])),
        remarks,
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
      if (isExcludedAlertRemark(row.remarks)) return false;
      // Hard fleet scope: drop rows outside the dashboard's fleet set.
      if (scopeSet.size > 0 && !scopeSet.has(normalizeLabel(row.fleet))) return false;
      return true;
    });
    return remarkRows;
  }, [alertRulesProp, overrides, rows, scopeSet]);

  // ── Filter option lists ──
  const fleetOptions = useMemo(() => {
    const unique = new Set<string>();
    alertRows.forEach((row) => {
      if (row.fleet && row.fleet !== '—') unique.add(row.fleet);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [alertRows]);

  const remarkOptions = useMemo(() => {
    // When no allow-list is set, surface every unique remark seen in the data.
    if (!allowedRemarkTargets) {
      const uniq = new Set<string>();
      alertRows.forEach((row) => {
        if (row.remarks && row.remarks !== '—') uniq.add(row.remarks);
      });
      return Array.from(uniq).sort((a, b) => a.localeCompare(b));
    }
    const normalizedTargets = allowedRemarkTargets.map((label) => normalizeLabel(label));
    const matching = new Set<string>();
    alertRows.forEach((row) => {
      if (!row.remarks || row.remarks === '—') return;
      const normalizedValue = normalizeLabel(row.remarks);
      normalizedTargets.forEach((target, index) => {
        if (remarkMatchesAllowedTarget(normalizedValue, target)) {
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
    if (availableMonths.length > 0) {
      return availableMonths.map((m) => ({ key: m.key, label: m.label }));
    }
    const unique = new Map<string, string>();
    alertRows.forEach((row) => {
      if (row.monthKey && row.monthLabel) {
        unique.set(row.monthKey, row.monthLabel);
      }
    });
    return Array.from(unique.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [alertRows, availableMonths]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (didSetDefaultMonth.current) return;
      if (monthOptions.length === 0) return;
      if (monthFilters.length > 0) {
        didSetDefaultMonth.current = true;
        return;
      }
      didSetDefaultMonth.current = true;
      const next = monthOptions.some((option) => option.key === defaultMonthKey)
        ? defaultMonthKey
        : monthOptions[0]!.key;
      setFilters((f) => ({ ...f, monthFilters: [next] }));
    });
    return () => cancelAnimationFrame(frame);
  }, [defaultMonthKey, monthFilters, monthOptions]);

  const baseFilteredRows = useMemo(() => {
    const normalizedAllowedAlertTypes = allowedAlertTypes?.map((alert) => normalizeLabel(alert)) ?? null;
    const normalizedAllowedRemarks = allowedRemarkTargets?.map((r) => normalizeLabel(r)) ?? null;
    const normalizedFleetFilters = fleetFilters.map((fleet) => normalizeLabel(fleet));
    const normalizedRemarkFilters = remarkFilters.map((remark) => normalizeLabel(remark));
    const normalizedVehicleFilters = vehicleFilters.map((vehicle) => normalizeLabel(vehicle));
    const normalizedDriverFilters = driverFilters.map((driver) => normalizeLabel(driver));
    return alertRows.filter((row) => {
      if (!row.alertType || row.alertType === '—') return false;
      const normalizedAlertType = normalizeLabel(row.alertType);
      if (normalizedAllowedAlertTypes && !normalizedAllowedAlertTypes.includes(normalizedAlertType)) return false;
      if (normalizedAllowedRemarks && normalizedAllowedRemarks.length > 0) {
        const nRemark = normalizeLabel(row.remarks);
        const matchesRemark = normalizedAllowedRemarks.some((r) => remarkMatchesAllowedTarget(nRemark, r));
        if (!matchesRemark) return false;
      }
      if (normalizedFleetFilters.length > 0) {
        const normalizedFleet = normalizeLabel(row.fleet);
        if (!normalizedFleetFilters.includes(normalizedFleet)) return false;
      }
      if (normalizedRemarkFilters.length > 0) {
        const normalizedRemark = normalizeLabel(row.remarks);
        const matchesFilter = normalizedRemarkFilters.some((f) =>
          remarkMatchesAllowedTarget(normalizedRemark, f),
        );
        if (!matchesFilter) return false;
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
  }, [alertRows, allowedAlertTypes, allowedRemarkTargets, fleetFilters, remarkFilters, vehicleFilters, driverFilters]);

  const filteredAlerts = useMemo(() => {
    let rows = baseFilteredRows;
    if (monthFilters.length > 0) {
      rows = rows.filter((row) => row.monthKey && monthFilters.includes(row.monthKey));
    }
    if (dayFilters.length > 0) {
      rows = rows.filter((row) => row.parsedDate && dayFilters.includes(toDayKey(row.parsedDate)));
    }
    return rows;
  }, [baseFilteredRows, dayFilters, monthFilters]);

  // Selection restricted to rows that are currently visible under the active
  // filters, so bulk edits never touch rows the user can't see.
  const selectedVisibleKeys = useMemo(() => {
    const keys = new Set<string>();
    filteredAlerts.forEach((row) => {
      if (selectedKeys.has(row.alertKey)) keys.add(row.alertKey);
    });
    return Array.from(keys);
  }, [filteredAlerts, selectedKeys]);

  const applyBulkDriverName = useCallback(
    (rawName: string) => {
      const driverName = rawName.trim();
      const keys = selectedVisibleKeys;
      if (keys.length === 0 || isBulkPending) return;
      setBulkError(false);
      startBulkTransition(async () => {
        try {
          // Server action caps each request at 500 keys.
          for (let i = 0; i < keys.length; i += 500) {
            const chunk = keys.slice(i, i + 500);
            const result = await saveAlertDriverNamesBulk({
              dashboardPublicId: dashboardId,
              alertKeys: chunk,
              driverName,
            });
            if (!result.ok) {
              setBulkError(true);
              return;
            }
          }
          setOverrides((prev) => {
            const next = { ...prev };
            keys.forEach((key) => {
              if (driverName) next[key] = driverName;
              else delete next[key];
            });
            return next;
          });
          setSelectedKeys(new Set());
          setBulkDraft('');
        } catch {
          setBulkError(true);
        }
      });
    },
    [dashboardId, isBulkPending, selectedVisibleKeys],
  );

  // ── Trend remark filter options ──
  const availableTrendRemarkOptions = useMemo(() => {
    const matching = new Set<string>();
    if (!allowedRemarkTargets) {
      filteredAlerts.forEach((row) => {
        if (row.remarks && row.remarks !== '—') matching.add(row.remarks);
      });
    } else {
      const normalizedTargets = allowedRemarkTargets.map((label) => normalizeLabel(label));
      filteredAlerts.forEach((row) => {
        if (!row.remarks || row.remarks === '—') return;
        const normalizedValue = normalizeLabel(row.remarks);
        normalizedTargets.forEach((target, index) => {
          if (normalizedValue.includes(target)) {
            matching.add(allowedRemarkTargets[index]);
          }
        });
      });
    }
    return [
      { label: lang === 'th' ? 'การแจ้งเตือนทุกประเภท' : 'All alert types', value: 'all' },
      ...Array.from(matching)
        .sort((a, b) => a.localeCompare(b))
        .map((option) => ({ label: option, value: option })),
    ];
  }, [allowedRemarkTargets, filteredAlerts, lang]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (trendRemarkFilter === 'all') return;
      if (availableTrendRemarkOptions.some((option) => option.value === trendRemarkFilter)) return;
      setFilters((f) => ({ ...f, trendRemarkFilter: 'all' }));
    });
    return () => cancelAnimationFrame(frame);
  }, [availableTrendRemarkOptions, trendRemarkFilter]);

  // ── Trend chart data (TrendDatum[]) ──
  const trendChartData = useMemo(() => {
    const counts = new Map<string, { key: string; date: Date; count: number }>();
    filteredAlerts.forEach((row) => {
      if (!row.parsedDate) return;
      if (trendRemarkFilter !== 'all') {
        const normalizedRemark = normalizeLabel(row.remarks);
        const normalizedFilter = normalizeLabel(trendRemarkFilter);
        if (!remarkMatchesAllowedTarget(normalizedRemark, normalizedFilter)) return;
      }
      const dayKey = toDayKey(row.parsedDate);
      const existing = counts.get(dayKey);
      if (existing) {
        existing.count += 1;
      } else {
        const dayDate = new Date(Date.UTC(row.parsedDate.getUTCFullYear(), row.parsedDate.getUTCMonth(), row.parsedDate.getUTCDate()));
        counts.set(dayKey, { key: dayKey, date: dayDate, count: 1 });
      }
    });
    return Array.from(counts.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((item) => ({
        label: item.date.toLocaleDateString('en-GB', { timeZone: 'UTC' }),
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

  const dayCountForScore = useMemo(() => {
    const days = new Set<string>();
    filteredAlerts.forEach((r) => {
      if (r.parsedDate) days.add(toDayKey(r.parsedDate));
    });
    return Math.max(1, days.size);
  }, [filteredAlerts]);

  const overallSafetyScore = useMemo(
    () => computeSafetyScore(filteredAlerts.length, Math.max(1, uniqueVehicles), dayCountForScore),
    [filteredAlerts.length, uniqueVehicles, dayCountForScore],
  );

  useEffect(() => {
    if (loading) return;
    saveDashboardScore(dashboardId, overallSafetyScore, filteredAlerts.length);
  }, [dashboardId, loading, overallSafetyScore, filteredAlerts.length]);

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

    // If no dates parsed, we can't compute a meaningful score — don't show a misleading 100.
    const safetyScore = activeDays > 0 ? computeDriverSafetyScore(totalAlerts, activeDays) : null;

    return { driverName, totalAlerts, mostCommonType, safetyScore, activeDays };
  }, [driverFilters, filteredAlerts]);

  // ── Fleet comparison data (bar chart) ──
  const fleetComparisonData = useMemo(() => {
    if (fleetFilters.length > 0) return null;
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

  // Color map so downstream components (video chips, timeline badges) share
  // colors with the donut chart — keyed by normalized label and stable across
  // dashboards via colorForRemark.
  const alertTypeColorMap = useMemo(() => {
    const map = new Map<string, string>();
    alertTypeDonut.forEach((item) => {
      map.set(normalizeLabel(item.label), colorForRemark(item.label));
    });
    return map;
  }, [alertTypeDonut]);

  // ── Top vehicles by alert count (top 5 for compact display) ──
  const topVehicles = useMemo(() => {
    const counts = new Map<string, number>();
    filteredAlerts.forEach((r) => {
      if (r.vehicle && r.vehicle !== '—') {
        counts.set(r.vehicle, (counts.get(r.vehicle) ?? 0) + 1);
      }
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, value]) => ({ label, value }));
  }, [filteredAlerts]);

  // ── Top drivers by alert count (top 5 for compact display) ──
  const topDrivers = useMemo(() => {
    const counts = new Map<string, number>();
    filteredAlerts.forEach((r) => {
      if (r.driver && r.driver !== '—') {
        counts.set(r.driver, (counts.get(r.driver) ?? 0) + 1);
      }
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, value]) => ({ label, value }));
  }, [filteredAlerts]);

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
        key: 'select',
        label: '',
        sortable: false,
        render: (_v, row) => (
          <input
            type="checkbox"
            checked={selectedKeys.has(row.alertKey)}
            onChange={() => toggleSelected(row.alertKey)}
            aria-label={lang === 'th' ? 'เลือกแถวนี้' : 'Select this row'}
            className="h-4 w-4 cursor-pointer accent-red-600"
          />
        ),
      },
      {
        key: 'sheetRowNumber',
        label: lang === 'th' ? 'แถว' : 'Row #',
        sortable: true,
        render: (_v, row) => (
          <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{row.sheetRowNumber}</span>
        ),
      },
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
      ...(isAdmin
        ? [
            {
              key: 'alertType',
              label: lang === 'th' ? 'ประเภทดิบ (ผู้ดูแล)' : 'Raw alert type (admin)',
              sortable: true,
              render: (_v: unknown, row: AlertRow) => (
                <span
                  className="font-mono text-xs text-zinc-500 dark:text-zinc-400"
                  title={lang === 'th' ? 'ค่าดิบจากชีต ก่อนจัดหมวดหมู่' : 'Raw "Alert Type" column from the sheet, before rule mapping.'}
                >
                  {row.alertType}
                </span>
              ),
            } as Column<AlertRow>,
          ]
        : []),
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
      {
        key: 'manualDriver',
        label: lang === 'th' ? 'แก้ไขคนขับ' : 'Set driver',
        sortable: false,
        render: (_v, row) => (
          <AlertDriverNameCell
            dashboardPublicId={dashboardId}
            alertKey={row.alertKey}
            overrideName={overrides[row.alertKey] ?? ''}
            lang={lang}
            onSaved={handleDriverSaved}
          />
        ),
      },
    ],
    [lang, isAdmin, dashboardId, overrides, handleDriverSaved, selectedKeys, toggleSelected],
  );

  // ── Export data ──
  const exportData = useMemo(
    () =>
      filteredAlerts.map((r) => ({
        sheetRowNumber: r.sheetRowNumber,
        time: r.time,
        vehicle: r.vehicle,
        driver: r.driver,
        speed: r.speed,
        fleet: r.fleet,
        ...(isAdmin ? { rawAlertType: r.alertType } : {}),
        remarks: r.remarks,
        videoUrl: r.videoUrl,
      })),
    [filteredAlerts, isAdmin],
  );

  // Date range string for export filename
  const dateRangeLabel = useMemo(() => {
    if (monthFilters.length === 0) return undefined;
    return monthFilters.sort().join('_');
  }, [monthFilters]);

  const detailExportColumns = useMemo(
    () =>
      lang === 'th'
        ? [
            { key: 'sheetRowNumber', label: 'แถว' },
            { key: 'time', label: 'เวลาแจ้งเตือน' },
            { key: 'vehicle', label: 'ยานพาหนะ' },
            { key: 'driver', label: 'คนขับ' },
            { key: 'speed', label: 'ความเร็ว' },
            { key: 'fleet', label: 'กลุ่มรถ' },
            { key: 'remarks', label: 'ประเภทการแจ้งเตือน' },
            { key: 'videoUrl', label: 'ลิงก์วิดีโอ' },
          ]
        : [
            { key: 'sheetRowNumber', label: 'Row #' },
            { key: 'time', label: 'Alert Time' },
            { key: 'vehicle', label: 'Vehicle' },
            { key: 'driver', label: 'Driver' },
            { key: 'speed', label: 'Speed' },
            { key: 'fleet', label: 'Fleet' },
            { key: 'remarks', label: 'Alert Type' },
            { key: 'videoUrl', label: 'Video URL' },
          ],
    [lang],
  );

  // Active filter count for DashboardShell
  const activeFilterCount =
    monthFilters.length +
    dayFilters.length +
    fleetFilters.length +
    remarkFilters.length +
    vehicleFilters.length +
    driverFilters.length;

  const isStale = lastUpdated ? nowTick - lastUpdated.getTime() > 5 * 60 * 1000 : false;

  return (
    <DashboardShell
      title={dashboardName}
      subtitle={lang === 'th' ? 'แดชบอร์ดรายละเอียด' : 'Detail dashboard'}
      lang={lang}
      lastUpdated={lastUpdated}
      notes={dashboardNotes}
      isStale={isStale}
      activeFilterCount={activeFilterCount}
      dashboardId={dashboardId}
      isAdmin={isAdmin}
      actions={
        <ExportButton
          data={exportData}
          fullSheetExport={{ rows, filteredRows: filteredAlerts.map((r) => r.sourceRow), columns: sheetColumns }}
          dashboardName="DetailDashboard"
          dateRange={dateRangeLabel}
          settingsStorageKey={`detail-${dashboardId}`}
          lang={lang}
          columns={detailExportColumns}
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
            <InlineMonthPicker
              value={filters.monthFilters}
              onChange={(v) => {
                const arr = v as string[];
                setFilters((f) => ({ ...f, monthFilters: arr, dayFilters: arr.length === 1 ? f.dayFilters : [] }));
              }}
              multi
              lang={lang}
            />
            {monthFilters.length === 1 && (
              <InlineDayPicker
                monthKey={monthFilters[0]}
                value={filters.dayFilters}
                onChange={(v) => setFilters((f) => ({ ...f, dayFilters: v as string[] }))}
                multi
                lang={lang}
              />
            )}
            {fleetOptions.length > 1 && (
              <MultiSelect label={lang === 'th' ? 'กลุ่มรถ' : 'fleets'} options={fleetOptions} selected={filters.fleetFilters} onChange={(v) => setFilters(f => ({ ...f, fleetFilters: v }))} lang={lang} />
            )}
            <MultiSelect label={lang === 'th' ? 'ประเภท' : 'types'} options={remarkOptions} selected={filters.remarkFilters} onChange={(v) => setFilters(f => ({ ...f, remarkFilters: v }))} lang={lang} />
            <MultiSelect label={lang === 'th' ? 'ยานพาหนะ' : 'vehicles'} options={vehicleOptions} selected={filters.vehicleFilters} onChange={(v) => setFilters(f => ({ ...f, vehicleFilters: v }))} lang={lang} />
            <MultiSelect label={lang === 'th' ? 'คนขับ' : 'drivers'} options={driverOptions} selected={filters.driverFilters} onChange={(v) => setFilters(f => ({ ...f, driverFilters: v }))} lang={lang} />
            {hasActiveFilters && (
              <button type="button" onClick={resetFilters} className="ml-auto text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">{lang === 'th' ? 'รีเซ็ต' : 'Reset'}</button>
            )}
          </FilterBar>

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

          {/* ── Daily trend (full width) ── */}
          <section className={dashboardSectionClass}>
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
                  height={220}
                  colors={CHART_COLORS}
                  ariaLabel={lang === 'th' ? 'แนวโน้มการแจ้งเตือนรายวัน' : 'Daily alert trend'}
                />
              )}
            </div>
          </section>

          {/* ── Alert type donut + Heatmap (2:3 split) ── */}
          <div className="grid gap-4 lg:grid-cols-5">
            <section className={`lg:col-span-2 ${dashboardSectionClass}`}>
              <h2 className={heading2}>
                {lang === 'th' ? 'สัดส่วนประเภทการแจ้งเตือน' : 'Alert type breakdown'}
              </h2>
              <div className="mt-4">
                <DonutChart
                  data={alertTypeDonut}
                  centerLabel={lang === 'th' ? 'ทั้งหมด' : 'total'}
                  ariaLabel={lang === 'th' ? 'สัดส่วนประเภทการแจ้งเตือน' : 'Alert type breakdown'}
                  colorMap={alertTypeColorMap}
                />
              </div>
            </section>
            {heatmapDates.length > 0 && (
              <section className={`lg:col-span-3 ${dashboardSectionClass}`}>
                <h2 className={heading2}>
                  {lang === 'th' ? 'แผนที่ความร้อน' : 'Alert heatmap'}
                </h2>
                <p className={`mt-1 ${textSecondary}`}>
                  {lang === 'th'
                    ? 'รวมทุกสัปดาห์และทุกเดือนในช่วงที่เลือก — แสดงจำนวนครั้งตามวันในสัปดาห์และชั่วโมงในวัน'
                    : 'Aggregated across all weeks and months in the selected period — shows event count by day of week and hour of day.'}
                </p>
                <div className="mt-4">
                  <AlertHeatmap dates={heatmapDates} />
                </div>
              </section>
            )}
          </div>

          {/* ── Section divider: Rankings ── */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-300 to-transparent dark:via-zinc-700/50" />
            <svg width="6" height="6" viewBox="0 0 6 6" className="shrink-0 text-zinc-300 dark:text-zinc-600" aria-hidden="true"><polygon points="3,0 6,3 3,6 0,3" fill="currentColor" /></svg>
            <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              {lang === 'th' ? 'อันดับและข้อมูลเชิงลึก' : 'Rankings & Insights'}
            </span>
            <svg width="6" height="6" viewBox="0 0 6 6" className="shrink-0 text-zinc-300 dark:text-zinc-600" aria-hidden="true"><polygon points="3,0 6,3 3,6 0,3" fill="currentColor" /></svg>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-300 to-transparent dark:via-zinc-700/50" />
          </div>

          {/* ── Top vehicles + Top drivers (side-by-side horizontal bars) ── */}
          <div className="grid gap-4 lg:grid-cols-2">
            {topVehicles.length > 0 && (
              <section className={dashboardSectionClass}>
                <h2 className={heading2}>
                  {lang === 'th' ? 'ยานพาหนะ 5 อันดับแรก' : 'Top 5 vehicles'}
                </h2>
                <p className={`mt-1 ${textSecondary}`}>
                  {lang === 'th' ? 'เรียงตามจำนวนการแจ้งเตือน' : 'Ranked by alert count.'}
                </p>
                <div className="mt-4">
                  <HorizontalBarChart
                    data={topVehicles}
                    maxItems={5}
                    colors={CHART_COLORS}
                    ariaLabel={lang === 'th' ? 'ยานพาหนะ 5 อันดับแรก' : 'Top 5 vehicles by alerts'}
                  />
                </div>
              </section>
            )}
            {topDrivers.length > 0 && (
              <section className={dashboardSectionClass}>
                <h2 className={heading2}>
                  {lang === 'th' ? 'คนขับ 5 อันดับแรก' : 'Top 5 drivers'}
                </h2>
                <p className={`mt-1 ${textSecondary}`}>
                  {lang === 'th' ? 'คนขับที่มีการแจ้งเตือนมากที่สุด' : 'Drivers with the most alerts.'}
                </p>
                <div className="mt-4">
                  <HorizontalBarChart
                    data={topDrivers}
                    maxItems={5}
                    colors={CHART_COLORS}
                    ariaLabel={lang === 'th' ? 'คนขับ 5 อันดับแรก' : 'Top 5 drivers by alerts'}
                  />
                </div>
              </section>
            )}
          </div>

          {/* ── Fleet Comparison + Driver Summary ── */}
          {(fleetComparisonData || driverSummary) && (
            <div className="grid gap-4 lg:grid-cols-2">
              {fleetComparisonData && (
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
                    <HorizontalBarChart
                      data={fleetComparisonData}
                      maxItems={8}
                      colors={CHART_COLORS}
                      ariaLabel={lang === 'th' ? 'เปรียบเทียบฟลีท' : 'Fleet comparison'}
                    />
                  </div>
                </section>
              )}
              {driverSummary && (
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
              )}
            </div>
          )}

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
          <AlertTimeline entries={timelineEntries} maxEntries={30} lang={lang} colorMap={alertTypeColorMap} />

          {/* ── Video Evidence ── */}
          <VideoEvidence entries={videoEntries} maxPerType={10} lang={lang} colorMap={alertTypeColorMap} />

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
              <div className="flex items-center gap-3">
                {filteredAlerts.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedKeys((prev) => {
                        const allKeys = filteredAlerts.map((row) => row.alertKey);
                        const allSelected = allKeys.every((key) => prev.has(key));
                        return allSelected ? new Set<string>() : new Set(allKeys);
                      })
                    }
                    className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  >
                    {selectedVisibleKeys.length === filteredAlerts.length && filteredAlerts.length > 0
                      ? (lang === 'th' ? 'ยกเลิกเลือกทั้งหมด' : 'Deselect all')
                      : (lang === 'th' ? 'เลือกทั้งหมด' : 'Select all')}
                  </button>
                )}
                <span className={textSecondary}>
                  {filteredAlerts.length === 0
                    ? (lang === 'th' ? 'ไม่มีการแจ้งเตือนที่จะแสดง' : 'No alerts to show.')
                    : `${filteredAlerts.length} ${lang === 'th' ? 'รายการ' : 'records'}`}
                </span>
              </div>
            </div>
            {selectedVisibleKeys.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900/50 dark:bg-red-950/30">
                <span className="text-xs font-semibold text-red-700 dark:text-red-300">
                  {lang === 'th'
                    ? `เลือกแล้ว ${selectedVisibleKeys.length} รายการ`
                    : `${selectedVisibleKeys.length} selected`}
                </span>
                <input
                  type="text"
                  maxLength={128}
                  value={bulkDraft}
                  onChange={(e) => setBulkDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && bulkDraft.trim()) applyBulkDriverName(bulkDraft);
                  }}
                  placeholder={lang === 'th' ? 'ชื่อคนขับ' : 'Driver name'}
                  className="w-44 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => applyBulkDriverName(bulkDraft)}
                  disabled={isBulkPending || !bulkDraft.trim()}
                  className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                >
                  {isBulkPending
                    ? (lang === 'th' ? 'กำลังบันทึก…' : 'Saving…')
                    : (lang === 'th' ? 'ใช้กับที่เลือก' : 'Apply to selected')}
                </button>
                <button
                  type="button"
                  onClick={() => applyBulkDriverName('')}
                  disabled={isBulkPending}
                  title={lang === 'th' ? 'ลบชื่อคนขับที่ตั้งเองออกจากแถวที่เลือก' : 'Remove manual driver names from the selected rows'}
                  className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {lang === 'th' ? 'ล้างชื่อ' : 'Clear names'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedKeys(new Set())}
                  disabled={isBulkPending}
                  className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  {lang === 'th' ? 'ยกเลิกการเลือก' : 'Deselect'}
                </button>
                {bulkError && (
                  <span className="text-xs font-medium text-red-600 dark:text-red-400">
                    {lang === 'th' ? 'บันทึกไม่สำเร็จ' : 'Failed to save'}
                  </span>
                )}
              </div>
            )}
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

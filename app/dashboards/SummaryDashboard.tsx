'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useGoogleSheet from './useGoogleSheet';
import { loadStoredFilters, saveStoredFilters } from './filterStorage';
import {
  dateTimeRangeToMonthKeys,
  isCompleteDateTimeRange,
  isDateInDateTimeRange,
  monthKeyToDateTimeRange,
  resolveStoredDateTimeRange,
  type DateTimeRange,
} from './dateTimeRange';
import { saveDashboardScore } from './scoreCache';
import DateTimeRangePicker from 'app/ui/DateTimeRangePicker';
import MultiSelect from 'app/ui/MultiSelect';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import LoadingState from './LoadingState';
import {
  ALLOWED_ALERT_TYPES,
  ALLOWED_REMARK_TARGETS,
  computeDriverSafetyScore,
  computeSafetyScore,
  findValue,
  hasRemark,
  isExcludedAlertRemark,
  normalizeLabel,
  remarkMatchesAllowedTarget,
  parseDate,
  toDayKey,
  toDisplayString,
  toMonthKey,
  toMonthLabel,
  previousMonthKey,
  rejectFutureMonthKeys,
  resolveDefaultMonthKey,
  withDerivedRemark,
  applyAlertRules,
  colorForRemark,
  resolveScopeFleetNames,
  scopeFleetSet,
  ALERT_TIME_ALIASES,
  type AlertRule,
} from './dashboardDataUtils';
import { type DashboardLang } from 'app/dashboard/i18n-copy';
import KpiCard from 'app/ui/KpiCard';
import DonutChart from 'app/ui/DonutChart';
import SafetyScore from 'app/ui/SafetyScore';
import TrendIndicator from 'app/ui/TrendIndicator';
import AlertHeatmap from 'app/ui/AlertHeatmap';
import DriverLeaderboard from 'app/ui/DriverLeaderboard';
import ExportButton from 'app/ui/ExportButton';
import TrendChart from 'app/ui/TrendChart';
import { heading2, textSecondary, CHART_COLORS, SAFETY_THRESHOLDS } from 'app/ui/design-tokens';
import FilterBar from 'app/ui/FilterBar';

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
  isAdmin?: boolean;
};

const buildCounts = (rows: Record<string, unknown>[], labels: string[]) => {
  const totals = new Map<string, number>();
  rows.forEach((row) => {
    const value = findValue(row, labels);
    const key = value == null || value === '' ? 'Unspecified' : String(value).trim() || 'Unspecified';
    totals.set(key, (totals.get(key) ?? 0) + 1);
  });
  return Array.from(totals.entries())
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total);
};

/** YYYY-MM → previous calendar month key (UTC-digit math; no viewer-zone read). */
const priorMonthKeyOf = (monthKey: string): string | null => {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return null;
  return toMonthKey(new Date(Date.UTC(y, m - 2, 1)));
};

export default function SummaryDashboard({
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
}: DashboardProps) {
  const scopeNames = useMemo(
    () => resolveScopeFleetNames(organizationName, organizationNames),
    [organizationName, organizationNames],
  );
  const scopeSet = useMemo(
    () => scopeFleetSet(organizationName, organizationNames),
    [organizationName, organizationNames],
  );
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const defaultMonthKey = useMemo(() => previousMonthKey(), []);
  const [monthFilters, setMonthFilters] = useState<string[]>([]);
  const [dayFilters, setDayFilters] = useState<string[]>([]);
  const [dateTimeRange, setDateTimeRange] = useState<DateTimeRange>({ start: '', end: '' });
  // When exactly one month is selected, also fetch its prior month so the
  // "vs last month" KPI trend, highlight previous-counts, and the monthly
  // comparison cards compare against real data instead of an unfetched
  // month's implicit zero. currentRows still filters to monthFilters, so
  // KPIs and tables show only the selected month.
  const fetchMonthKeys = useMemo(() => {
    const rangeMonths = dateTimeRangeToMonthKeys(dateTimeRange);
    if (rangeMonths.length !== 1) return rangeMonths;
    const prior = priorMonthKeyOf(rangeMonths[0]!);
    return prior ? [rangeMonths[0]!, prior] : rangeMonths;
  }, [dateTimeRange]);
  const [fleetFilters, setFleetFilters] = useState<string[]>(() => scopeNames);
  const [vehicleFilters, setVehicleFilters] = useState<string[]>([]);
  const [driverFilters, setDriverFilters] = useState<string[]>([]);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const didSetDefaultMonth = useRef(false);
  const storageKey = useMemo(() => dashboardId, [dashboardId]);
  // Month-scoped fetch: selected months load in week chunks so large sheets
  // (PoonNok ~245k rows) still expose April/June. Empty selection = catalogue only.
  const { rows, columns: sheetColumns, loading, refreshing, progress, error, lastUpdated, refresh, availableMonths } = useGoogleSheet({
    sheetId,
    gid: sheetGid,
    monthKeys: fetchMonthKeys,
    loadMonthCatalog: true,
  });

  useEffect(() => {
    const stored = loadStoredFilters<{
      monthFilters: string[];
      dayFilters?: string[];
      fleetFilters: string[];
      dateTimeRange?: DateTimeRange;
      vehicleFilters?: string[];
      driverFilters?: string[];
      typeFilters?: string[];
    }>(storageKey);
    if (!stored) return;
    const frame = requestAnimationFrame(() => {
      const storedMonths = rejectFutureMonthKeys(
        Array.isArray(stored.monthFilters)
          ? stored.monthFilters.filter((v) => typeof v === 'string')
          : [],
      );
      const storedDays = Array.isArray(stored.dayFilters)
        ? stored.dayFilters.filter((v) => typeof v === 'string')
        : [];
      const storedRange = resolveStoredDateTimeRange(
        stored.dateTimeRange,
        storedMonths,
        storedDays,
      );
      // Empty / future-only stored months → let the default-month effect re-pick.
      if (isCompleteDateTimeRange(storedRange)) {
        didSetDefaultMonth.current = true;
        setDateTimeRange(storedRange);
        setMonthFilters(dateTimeRangeToMonthKeys(storedRange));
      }
      setDayFilters([]);
      if (Array.isArray(stored.fleetFilters) && stored.fleetFilters.length > 0) setFleetFilters(stored.fleetFilters.filter((v) => typeof v === 'string'));
      else setFleetFilters(scopeNames);
      if (Array.isArray(stored.vehicleFilters)) setVehicleFilters(stored.vehicleFilters.filter((v) => typeof v === 'string'));
      if (Array.isArray(stored.driverFilters)) setDriverFilters(stored.driverFilters.filter((v) => typeof v === 'string'));
      if (Array.isArray(stored.typeFilters)) setTypeFilters(stored.typeFilters.filter((v) => typeof v === 'string'));
    });
    return () => cancelAnimationFrame(frame);
  }, [storageKey]);

  useEffect(() => {
    saveStoredFilters(storageKey, { monthFilters, dayFilters, fleetFilters, vehicleFilters, driverFilters, typeFilters, dateTimeRange });
  }, [dateTimeRange, dayFilters, fleetFilters, vehicleFilters, driverFilters, typeFilters, monthFilters, storageKey]);

  const resetFilters = () => {
    const nextMonth =
      resolveDefaultMonthKey(
        availableMonths.map((m) => m.key),
        defaultMonthKey,
      ) ?? defaultMonthKey;
    setMonthFilters(nextMonth ? [nextMonth] : []);
    setDateTimeRange(nextMonth ? monthKeyToDateTimeRange(nextMonth) : { start: '', end: '' });
    setDayFilters([]);
    setFleetFilters(scopeNames);
    setVehicleFilters([]);
    setDriverFilters([]);
    setTypeFilters([]);
  };

  // null = no filter; only restrict when the admin explicitly configured an allow-list.
  const allowedAlertTypes = useMemo<string[] | null>(
    () => (allowedAlertTypesProp && allowedAlertTypesProp.length > 0 ? allowedAlertTypesProp : null),
    [allowedAlertTypesProp],
  );
  const allowedRemarkTargets = useMemo<string[] | null>(
    () => (allowedRemarksProp && allowedRemarksProp.length > 0 ? allowedRemarksProp : null),
    [allowedRemarksProp],
  );

  const alertRows = useMemo(() => {
    const rules = alertRulesProp ?? [];
    const mappedRows = rows.map((row) => {
      const alertType = toDisplayString(findValue(row, ['Alert Type']));
      const driver = toDisplayString(findValue(row, ['Driver Name']));
      const fleet = toDisplayString(findValue(row, ['Fleet']));
      const derived = withDerivedRemark(alertType, toDisplayString(findValue(row, ['Remarks'])));
      const speed = Number(findValue(row, ['Speed', 'Max Speed']) ?? 0) || 0;
      const remarks = applyAlertRules(alertType, derived, speed, rules);
      const vehicle = toDisplayString(findValue(row, ['Vehicle No', 'Vehicle No TH']));
      const dateValue = findValue(row, ALERT_TIME_ALIASES);
      const parsedDate = parseDate(dateValue);
      const monthKey = parsedDate ? toMonthKey(parsedDate) : null;
      const monthLabel = parsedDate ? toMonthLabel(parsedDate) : 'Unknown month';
      return { sourceRow: row, alertType, driver, fleet, remarks, vehicle, monthKey, monthLabel, dateValue, parsedDate };
    });
    const remarkRows = mappedRows.filter((row) => hasRemark(row.remarks) && !isExcludedAlertRemark(row.remarks));
    // Hard fleet scope: drop rows outside the dashboard's fleet set so options + KPIs stay limited.
    if (scopeSet.size === 0) return remarkRows;
    return remarkRows.filter((row) => scopeSet.has(normalizeLabel(row.fleet)));
  }, [alertRulesProp, rows, scopeSet]);

  // Filter options
  const fleetOptions = useMemo(() => {
    const unique = new Set<string>();
    alertRows.forEach((row) => { if (row.fleet && row.fleet !== '—') unique.add(row.fleet); });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [alertRows]);
  const vehicleOptions = useMemo(
    () => Array.from(new Set(alertRows.map((row) => row.vehicle).filter((value) => value && value !== '—'))).sort(),
    [alertRows],
  );
  const driverOptions = useMemo(
    () => Array.from(new Set(alertRows.map((row) => row.driver).filter((value) => value && value !== '—'))).sort(),
    [alertRows],
  );
  const typeOptions = useMemo(
    () => Array.from(new Set(alertRows.map((row) => row.alertType).filter((value) => value && value !== '—'))).sort(),
    [alertRows],
  );
  const monthOptions = useMemo(() => {
    // Prefer the sheet-wide catalog so months outside the current 25k window
    // (e.g. April on a 245k-row sheet) still appear in the picker.
    if (availableMonths.length > 0) {
      return availableMonths.map((m) => ({ key: m.key, label: m.label }));
    }
    const unique = new Map<string, string>();
    alertRows.forEach((row) => { if (row.monthKey && row.monthLabel) unique.set(row.monthKey, row.monthLabel); });
    return rejectFutureMonthKeys(Array.from(unique.keys()))
      .map((key) => ({ key, label: unique.get(key)! }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [alertRows, availableMonths]);
  // Months whose data is actually in `rows` (explicitly fetched, or present in
  // the legacy fallback window). Per-month aggregations must not read
  // unfetched catalogue months — those render as misleading zeros.
  const loadedMonthKeys = useMemo(() => {
    const keys = new Set(fetchMonthKeys);
    alertRows.forEach((row) => { if (row.monthKey) keys.add(row.monthKey); });
    return keys;
  }, [alertRows, fetchMonthKeys]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (didSetDefaultMonth.current) return;
      if (monthOptions.length === 0) return;
      if (monthFilters.length > 0) {
        didSetDefaultMonth.current = true;
        return;
      }
      didSetDefaultMonth.current = true;
      const next = resolveDefaultMonthKey(
        monthOptions.map((o) => o.key),
        defaultMonthKey,
      );
      if (next) {
        setMonthFilters([next]);
        setDateTimeRange(monthKeyToDateTimeRange(next));
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [defaultMonthKey, monthFilters, monthOptions]);

  // Filtered data — filter by allowed alert types, remarks, and fleet
  const baseFilteredRows = useMemo(() => {
    const nAllowed = allowedAlertTypes?.map((a) => normalizeLabel(a)) ?? null;
    const nAllowedRemarks = allowedRemarkTargets?.map((r) => normalizeLabel(r)) ?? null;
    const nFleet = fleetFilters.map((f) => normalizeLabel(f));
    const nVehicles = new Set(vehicleFilters.map(normalizeLabel));
    const nDrivers = new Set(driverFilters.map(normalizeLabel));
    const nTypes = new Set(typeFilters.map(normalizeLabel));
    return alertRows.filter((row) => {
      if (!row.alertType || row.alertType === '—') return false;
      if (nAllowed && !nAllowed.includes(normalizeLabel(row.alertType))) return false;
      if (nAllowedRemarks) {
        const nRemark = normalizeLabel(row.remarks);
        const matchesRemark = nAllowedRemarks.some((r) => remarkMatchesAllowedTarget(nRemark, r));
        if (!matchesRemark) return false;
      }
      if (nFleet.length > 0 && !nFleet.includes(normalizeLabel(row.fleet))) return false;
      if (nVehicles.size > 0 && !nVehicles.has(normalizeLabel(row.vehicle))) return false;
      if (nDrivers.size > 0 && !nDrivers.has(normalizeLabel(row.driver))) return false;
      if (nTypes.size > 0 && !nTypes.has(normalizeLabel(row.alertType))) return false;
      return true;
    });
  }, [alertRows, allowedAlertTypes, allowedRemarkTargets, fleetFilters, vehicleFilters, driverFilters, typeFilters]);

  const activeMonthKey = monthFilters.length === 1 ? monthFilters[0] : null;
  const activeMonthLabel = activeMonthKey
    ? monthOptions.find((o) => o.key === activeMonthKey)?.label ?? 'All months'
    : monthFilters.length > 1 ? 'Selected months' : 'All months';

  const currentRows = useMemo(() => {
    if (!isCompleteDateTimeRange(dateTimeRange)) return baseFilteredRows;
    return baseFilteredRows.filter((row) => isDateInDateTimeRange(row.parsedDate, dateTimeRange));
  }, [baseFilteredRows, dateTimeRange]);

  // NOTE: was `new Date(y, m - 2, 1)` (local construction) read back with the
  // UTC-convention toMonthKey — for viewers east of UTC (Bangkok!) that named
  // the month TWO back. priorMonthKeyOf builds with Date.UTC.
  const priorMonthKey = useMemo(
    () => (activeMonthKey ? priorMonthKeyOf(activeMonthKey) : null),
    [activeMonthKey],
  );

  const previousRows = useMemo(() => {
    if (!priorMonthKey) return [];
    return baseFilteredRows.filter((row) => row.monthKey === priorMonthKey);
  }, [baseFilteredRows, priorMonthKey]);

  const countMatches = useCallback(
    (targetLabel: string, field: 'remarks' | 'alertType', dataset: typeof currentRows) => {
      const nt = normalizeLabel(targetLabel);
      return dataset.reduce((total, row) => {
        const value = field === 'remarks' ? row.remarks : row.alertType;
        if (!value || value === '—') return total;
        const nv = normalizeLabel(value);
        return field === 'remarks' ? (nv.includes(nt) ? total + 1 : total) : (nv === nt ? total + 1 : total);
      }, 0);
    },
    [],
  );

  // KPI data
  const uniqueVehicles = useMemo(() => new Set(currentRows.map((r) => r.vehicle).filter((v) => v !== '—')).size, [currentRows]);
  const uniqueDrivers = useMemo(() => new Set(currentRows.map((r) => r.driver).filter((d) => d !== '—')).size, [currentRows]);
  const prevUniqueVehicles = useMemo(() => new Set(previousRows.map((r) => r.vehicle).filter((v) => v !== '—')).size, [previousRows]);

  // Day count for safety score
  const dayCount = useMemo(() => {
    const days = new Set<string>();
    currentRows.forEach((r) => { if (r.parsedDate) days.add(r.parsedDate.toISOString().slice(0, 10)); });
    return Math.max(1, days.size);
  }, [currentRows]);

  const safetyScore = useMemo(
    () => computeSafetyScore(currentRows.length, Math.max(1, uniqueVehicles), dayCount),
    [currentRows.length, uniqueVehicles, dayCount],
  );
  const prevDayCount = useMemo(() => {
    const days = new Set<string>();
    previousRows.forEach((r) => { if (r.parsedDate) days.add(r.parsedDate.toISOString().slice(0, 10)); });
    return Math.max(1, days.size);
  }, [previousRows]);
  const prevSafetyScore = useMemo(
    () => computeSafetyScore(previousRows.length, Math.max(1, prevUniqueVehicles), prevDayCount),
    [previousRows.length, prevUniqueVehicles, prevDayCount],
  );

  // Cache score for dashboards listing (matches current filter selection, including empty result)
  useEffect(() => {
    if (loading) return;
    saveDashboardScore(dashboardId, safetyScore, currentRows.length);
  }, [dashboardId, loading, safetyScore, currentRows.length]);

  // Heatmap dates
  const heatmapDates = useMemo(
    () => currentRows.map((r) => r.parsedDate).filter((d): d is Date => d !== null),
    [currentRows],
  );

  // Monthly trend data for TrendChart
  const monthlyTrendData = useMemo(() => {
    const monthsAsc = monthOptions
      .filter((m) => loadedMonthKeys.has(m.key))
      .sort((a, b) => a.key.localeCompare(b.key));
    return monthsAsc.map((month) => {
      const count = baseFilteredRows.filter((r) => r.monthKey === month.key).length;
      return { label: month.label, value: count };
    });
  }, [baseFilteredRows, loadedMonthKeys, monthOptions]);

  // Leaderboard data: prefer driver-grouping; fall back to vehicle-grouping when
  // the sheet has no driver names (common for camera-only feeds).
  const { leaderboardData, leaderboardGrouping } = useMemo(() => {
    const groupBy = (key: 'driver' | 'vehicle') => {
      const counts = new Map<string, number>();
      const days = new Map<string, Set<string>>();
      currentRows.forEach((r) => {
        const name = r[key];
        if (name === '—') return;
        counts.set(name, (counts.get(name) ?? 0) + 1);
        if (r.parsedDate) {
          const d = days.get(name) ?? new Set();
          d.add(r.parsedDate.toISOString().slice(0, 10));
          days.set(name, d);
        }
      });
      return Array.from(counts.entries()).map(([name, count]) => ({
        name,
        alertCount: count,
        score: computeDriverSafetyScore(count, Math.max(1, days.get(name)?.size ?? 1)),
      }));
    };
    const byDriver = groupBy('driver');
    if (byDriver.length > 0) return { leaderboardData: byDriver, leaderboardGrouping: 'driver' as const };
    return { leaderboardData: groupBy('vehicle'), leaderboardGrouping: 'vehicle' as const };
  }, [currentRows]);

  // Donut chart data — V2: alert type, vehicle, driver (replace fleet with driver)
  const remarkSummary = useMemo(() => buildCounts(currentRows, ['remarks']), [currentRows]);
  const vehicleSummary = useMemo(() => buildCounts(currentRows, ['vehicle']), [currentRows]);
  const driverSummary = useMemo(() => buildCounts(currentRows, ['driver']), [currentRows]);

  // Stable remark→color map: same label always gets the same color across every
  // dashboard component (donut, chip, highlight) regardless of frequency order.
  const remarkColorMap = useMemo(() => {
    const map = new Map<string, string>();
    remarkSummary.forEach((r) => {
      map.set(normalizeLabel(r.label), colorForRemark(r.label));
    });
    return map;
  }, [remarkSummary]);

  // Highlights
  // When no allow-list is configured, scaffold the highlight KPIs from the
  // standard remark set so the KPI strip still renders something sensible.
  const highlightLabels = useMemo(
    () => allowedRemarkTargets ?? [...ALLOWED_REMARK_TARGETS],
    [allowedRemarkTargets],
  );

  const highlightItems = useMemo(() => {
    type HighlightItem = { label: string; field: 'remarks' | 'alertType'; current: number; previous: number };
    const items: HighlightItem[] = highlightLabels.map((label) => ({
      label,
      field: 'remarks' as const,
      current: countMatches(label, 'remarks', currentRows),
      previous: countMatches(label, 'remarks', previousRows),
    }));
    return items.filter((item) => item.current > 0);
  }, [highlightLabels, countMatches, currentRows, previousRows]);

  // Monthly comparisons
  const monthlyComparisons = useMemo(() => {
    const monthsAsc = monthOptions
      .filter((m) => loadedMonthKeys.has(m.key))
      .sort((a, b) => a.key.localeCompare(b.key));
    const targets = highlightLabels.map((l) => ({ label: l, field: 'remarks' as const }));
    return targets
      .map((item) => {
        const monthRows = monthsAsc.map((month) => {
          const mRows = baseFilteredRows.filter((r) => r.monthKey === month.key);
          return { monthKey: month.key, monthLabel: month.label, total: countMatches(item.label, item.field, mRows) };
        }).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
        const total = monthRows.reduce((sum, r) => sum + r.total, 0);
        const color = remarkColorMap.get(normalizeLabel(item.label)) ?? CHART_COLORS[0];
        return { label: item.label, color, rows: monthRows, total };
      })
      .filter((c) => c.total > 0)
      .map((c) => ({ label: c.label, color: c.color, rows: c.rows }));
  }, [highlightLabels, baseFilteredRows, countMatches, loadedMonthKeys, monthOptions, remarkColorMap]);

  // Export data
  const exportData = useMemo(() => {
    return currentRows.map((r) => ({
      'Alert Type': r.alertType,
      'Driver': r.driver,
      'Vehicle': r.vehicle,
      'Fleet': r.fleet,
      'Remarks': r.remarks,
      'Month': r.monthLabel,
      'Date': r.parsedDate ? toDayKey(r.parsedDate) : '',
    }));
  }, [currentRows]);

  const exportColumns = useMemo(
    () =>
      lang === 'th'
        ? [
            { key: 'Alert Type', label: 'ประเภทการแจ้งเตือน' },
            { key: 'Driver', label: 'คนขับ' },
            { key: 'Vehicle', label: 'ยานพาหนะ' },
            { key: 'Fleet', label: 'กลุ่มรถ' },
            { key: 'Remarks', label: 'หมายเหตุ' },
            { key: 'Month', label: 'เดือน' },
            { key: 'Date', label: 'วันที่' },
          ]
        : [
            { key: 'Alert Type', label: 'Alert Type' },
            { key: 'Driver', label: 'Driver' },
            { key: 'Vehicle', label: 'Vehicle' },
            { key: 'Fleet', label: 'Fleet' },
            { key: 'Remarks', label: 'Remarks' },
            { key: 'Month', label: 'Month' },
            { key: 'Date', label: 'Date' },
          ],
    [lang],
  );

  return (
    <DashboardShell
      title={dashboardName}
      subtitle={lang === 'th' ? 'แดชบอร์ดภาพรวม' : 'Summary dashboard'}
      lang={lang}
      lastUpdated={lastUpdated}
      notes={dashboardNotes}
      isStale={lastUpdated ? nowTick - lastUpdated.getTime() > 5 * 60 * 1000 : false}
      activeFilterCount={(isCompleteDateTimeRange(dateTimeRange) ? 1 : 0) + fleetFilters.length + vehicleFilters.length + driverFilters.length + typeFilters.length}
      dashboardId={dashboardId}
      isAdmin={isAdmin}
      actions={
        <ExportButton
          data={exportData}
          fullSheetExport={{ rows, filteredRows: currentRows.map((r) => r.sourceRow), columns: sheetColumns }}
          dashboardName={`${dashboardName}-summary`}
          dateRange={isCompleteDateTimeRange(dateTimeRange) ? `${dateTimeRange.start}_${dateTimeRange.end}` : undefined}
          settingsStorageKey={`summary-${dashboardId}`}
          lang={lang}
          columns={exportColumns}
          label={lang === 'th' ? 'ส่งออก CSV' : 'Export CSV'}
        />
      }
    >
      <div className="flex flex-col gap-6">
          {/* Filters stay mounted during month switches so the picker never disappears. */}
          <FilterBar>
            <DateTimeRangePicker
              value={dateTimeRange}
              onChange={(range) => {
                setDateTimeRange(range);
                setMonthFilters(dateTimeRangeToMonthKeys(range));
                setDayFilters([]);
              }}
              lang={lang}
            />
            <MultiSelect
              label={lang === 'th' ? 'กลุ่มรถ' : 'fleets'}
              options={fleetOptions}
              selected={fleetFilters}
              onChange={setFleetFilters}
              lang={lang}
            />
            <MultiSelect label={lang === 'th' ? 'ยานพาหนะ' : 'vehicles'} options={vehicleOptions} selected={vehicleFilters} onChange={setVehicleFilters} lang={lang} />
            <MultiSelect label={lang === 'th' ? 'คนขับ' : 'drivers'} options={driverOptions} selected={driverFilters} onChange={setDriverFilters} lang={lang} />
            <MultiSelect label={lang === 'th' ? 'ประเภท' : 'types'} options={typeOptions} selected={typeFilters} onChange={setTypeFilters} lang={lang} />
            {(isCompleteDateTimeRange(dateTimeRange) || fleetFilters.length > 0 || vehicleFilters.length > 0 || driverFilters.length > 0 || typeFilters.length > 0) && (
              <button type="button" onClick={resetFilters} className="ml-auto text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                {lang === 'th' ? 'รีเซ็ต' : 'Reset'}
              </button>
            )}
          </FilterBar>

          {(loading || error) ? (
            <LoadingState
              message={
                progress
                  ? (lang === 'th'
                      ? `กำลังโหลดเดือนที่เลือก… ${Math.round((progress.done / progress.total) * 100)}%`
                      : `Loading selected month… ${Math.round((progress.done / progress.total) * 100)}%`)
                  : (lang === 'th' ? 'กำลังโหลดภาพรวม…' : 'Loading summary…')
              }
              detail={lang === 'th' ? 'กำลังสรุป KPI ระดับสูง' : 'Compiling high-level KPI totals.'}
              error={error ?? undefined}
              onRetry={refresh}
              lang={lang}
            />
          ) : (
          <>
          {refreshing && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400" role="status" aria-live="polite">
              {lang === 'th' ? 'กำลังโหลดข้อมูลเพิ่มเติม…' : 'Loading more data…'}
              {progress ? ` ${Math.round((progress.done / progress.total) * 100)}%` : ''}
            </p>
          )}
          {/* ② Overview — headline numbers + safety score */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label={lang === 'th' ? 'การแจ้งเตือนทั้งหมด' : 'Total Alerts'}
              value={currentRows.length}
              accentColor="#DC2626"
              trend={activeMonthKey ? { value: previousRows.length === 0 ? 0 : Math.round(((currentRows.length - previousRows.length) / Math.max(1, previousRows.length)) * 100), label: lang === 'th' ? 'เทียบเดือนก่อน' : 'vs last month' } : undefined}
            />
            <div
              className={`flex flex-col items-center justify-center gap-2 rounded-xl px-4 py-4 ring-1 ring-inset ${
                safetyScore >= SAFETY_THRESHOLDS.excellent
                  ? 'bg-emerald-50/80 ring-emerald-200/60 dark:bg-emerald-950/50 dark:ring-emerald-800/40'
                  : safetyScore >= SAFETY_THRESHOLDS.good
                    ? 'bg-blue-50/80 ring-blue-200/60 dark:bg-blue-950/50 dark:ring-blue-800/40'
                    : safetyScore >= SAFETY_THRESHOLDS.moderate
                      ? 'bg-amber-50/80 ring-amber-200/60 dark:bg-amber-950/50 dark:ring-amber-800/40'
                      : 'bg-red-50/80 ring-red-200/60 dark:bg-red-950/50 dark:ring-red-800/40'
              }`}
            >
              <SafetyScore
                score={safetyScore}
                size={100}
                tooltip={lang === 'th'
                  ? `คะแนนความปลอดภัย (0–100): คำนวณจากจำนวนการแจ้งเตือนต่อคันต่อวัน ยิ่งสูงยิ่งปลอดภัย สูตร: 100 ลบค่าปรับจาก (แจ้งเตือน ÷ คัน ÷ วัน)`
                  : `Safety score (0–100): Based on alerts per vehicle per day. Higher = fewer alerts. Formula: 100 − penalty from (alerts ÷ vehicles ÷ days).`}
                detail={lang === 'th'
                  ? `${currentRows.length} แจ้งเตือน ÷ ${uniqueVehicles} คัน ÷ ${dayCount} วัน`
                  : `${currentRows.length} alerts ÷ ${uniqueVehicles} vehicles ÷ ${dayCount} days`}
              />
              {activeMonthKey && prevSafetyScore !== safetyScore && (
                <TrendIndicator current={safetyScore} previous={prevSafetyScore} suffix={lang === 'th' ? 'เทียบเดือนก่อน' : 'vs prior'} invertColor />
              )}
            </div>
            <KpiCard label={lang === 'th' ? 'ยานพาหนะ' : 'Vehicles'} value={uniqueVehicles} subtitle={lang === 'th' ? 'ยานพาหนะที่ใช้งาน' : 'Active vehicles'} />
            <KpiCard label={lang === 'th' ? 'คนขับ' : 'Drivers'} value={uniqueDrivers} subtitle={lang === 'th' ? 'คนขับที่ใช้งาน' : 'Active drivers'} />
          </div>

          {/* ③ Monthly Trend — full-width, sets the narrative arc */}
          <section className={dashboardSectionClass}>
            <h2 className={heading2}>{lang === 'th' ? 'แนวโน้มรายเดือน' : 'Monthly alert trend'}</h2>
            <p className={`mt-1 ${textSecondary}`}>{lang === 'th' ? 'จำนวนการแจ้งเตือนรายเดือน' : 'Alert count over time.'}</p>
            <TrendChart className="mt-4" data={monthlyTrendData} mode="line" height={240} />
          </section>

          {/* ═══ Alert Breakdown ═══ */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-red-400/50 to-transparent dark:via-red-600/30" />
            <svg width="6" height="6" viewBox="0 0 6 6" className="shrink-0 text-red-400/50" aria-hidden="true"><polygon points="3,0 6,3 3,6 0,3" fill="currentColor" /></svg>
            <h2 className="text-xs font-bold uppercase tracking-widest text-red-600 dark:text-red-400">
              {lang === 'th' ? 'วิเคราะห์การแจ้งเตือน' : 'Alert Breakdown'}
            </h2>
            <svg width="6" height="6" viewBox="0 0 6 6" className="shrink-0 text-red-400/50" aria-hidden="true"><polygon points="3,0 6,3 3,6 0,3" fill="currentColor" /></svg>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-red-400/50 to-transparent dark:via-red-600/30" />
          </div>

          {/* ④ Heatmap + Alert Type donut — when & what */}
          <div className="grid gap-6 lg:grid-cols-5">
            <section className={`${dashboardSectionClass} lg:col-span-3`}>
              <h2 className={heading2}>{lang === 'th' ? 'ช่วงเวลาที่เกิดการแจ้งเตือน' : 'Alert timing heatmap'}</h2>
              <p className={`mt-1 mb-4 ${textSecondary}`}>{lang === 'th'
                ? 'รวมทุกสัปดาห์และทุกเดือนในช่วงที่เลือก — แสดงจำนวนครั้งตามวันในสัปดาห์และชั่วโมงในวัน'
                : 'Aggregated across all weeks and months in the selected period — shows event count by day of week and hour of day.'}</p>
              <AlertHeatmap dates={heatmapDates} />
            </section>
            <section className={`${dashboardSectionClass} lg:col-span-2`}>
              <h2 className={heading2}>{lang === 'th' ? 'สัดส่วนประเภท' : 'By alert type'}</h2>
              <div className="mt-4">
                <DonutChart data={remarkSummary.map((r) => ({ label: r.label, value: r.total }))} centerLabel={lang === 'th' ? 'แจ้งเตือน' : 'alerts'} size={150} colorMap={remarkColorMap} />
              </div>
            </section>
          </div>

          {/* ⑤ Alert Type Highlights — detailed counts */}
          <section className={dashboardSectionClass}>
            <h2 className={heading2}>
              {lang === 'th' ? 'ไฮไลต์ประเภทการแจ้งเตือน' : 'Alert type highlights'}
            </h2>
            <p className={`mt-1 ${textSecondary}`}>
              {activeMonthKey
                ? (lang === 'th' ? `${activeMonthLabel} — เปรียบเทียบเดือนก่อน` : `${activeMonthLabel} — compared to prior month.`)
                : (lang === 'th' ? `${activeMonthLabel}` : `${activeMonthLabel} totals.`)}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {highlightItems.map((item) => {
                const accentColor = remarkColorMap.get(normalizeLabel(item.label)) ?? CHART_COLORS[0];
                return (
                  <div
                    key={item.label}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900"
                    style={{ borderLeft: `3px solid ${accentColor}` }}
                  >
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: accentColor }} />
                      {item.label}
                    </div>
                    <div className="mt-1 text-2xl font-bold tabular-nums tracking-tight" style={{ color: accentColor }}>
                      {item.current}
                    </div>
                    {activeMonthKey && (
                      <div className="mt-1">
                        <TrendIndicator current={item.current} previous={item.previous} suffix={lang === 'th' ? 'เทียบเดือนก่อน' : 'vs prior'} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ═══ People & Vehicles ═══ */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-300 to-transparent dark:via-zinc-700/50" />
            <svg width="6" height="6" viewBox="0 0 6 6" className="shrink-0 text-zinc-300 dark:text-zinc-600" aria-hidden="true"><polygon points="3,0 6,3 3,6 0,3" fill="currentColor" /></svg>
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
              {lang === 'th' ? 'คนขับและยานพาหนะ' : 'Drivers & Vehicles'}
            </h2>
            <svg width="6" height="6" viewBox="0 0 6 6" className="shrink-0 text-zinc-300 dark:text-zinc-600" aria-hidden="true"><polygon points="3,0 6,3 3,6 0,3" fill="currentColor" /></svg>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-300 to-transparent dark:via-zinc-700/50" />
          </div>

          {/* ⑥ Leaderboards (drivers when available, else vehicles) */}
          <div className="grid gap-6 lg:grid-cols-2">
            <section className={dashboardSectionClass}>
              <DriverLeaderboard
                drivers={leaderboardData}
                title={
                  leaderboardGrouping === 'driver'
                    ? (lang === 'th' ? 'คนขับที่ปลอดภัยที่สุด' : 'Safest Drivers')
                    : (lang === 'th' ? 'ยานพาหนะที่ปลอดภัยที่สุด' : 'Safest Vehicles')
                }
                variant="safest"
                lang={lang}
              />
            </section>
            <section className={dashboardSectionClass}>
              <DriverLeaderboard
                drivers={leaderboardData}
                title={
                  leaderboardGrouping === 'driver'
                    ? (lang === 'th' ? 'คนขับที่ต้องปรับปรุง' : 'Needs Improvement')
                    : (lang === 'th' ? 'ยานพาหนะที่ต้องปรับปรุง' : 'Vehicles Needing Improvement')
                }
                variant="riskiest"
                lang={lang}
              />
            </section>
          </div>

          {/* ⑦ Vehicle + Driver donuts */}
          <div className="grid gap-6 lg:grid-cols-2">
            <section className={dashboardSectionClass}>
              <h2 className={heading2}>{lang === 'th' ? 'สัดส่วนตามยานพาหนะ' : 'Alerts by vehicle'}</h2>
              <div className="mt-4">
                <DonutChart data={vehicleSummary.slice(0, 8).map((r) => ({ label: r.label, value: r.total }))} centerLabel={lang === 'th' ? 'แจ้งเตือน' : 'alerts'} size={140} />
              </div>
            </section>
            <section className={dashboardSectionClass}>
              <h2 className={heading2}>{lang === 'th' ? 'สัดส่วนตามคนขับ' : 'Alerts by driver'}</h2>
              <div className="mt-4">
                <DonutChart data={driverSummary.slice(0, 8).map((r) => ({ label: r.label, value: r.total }))} centerLabel={lang === 'th' ? 'แจ้งเตือน' : 'alerts'} size={140} />
              </div>
            </section>
          </div>

          {/* ═══ Deep Dive ═══ */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-300 to-transparent dark:via-zinc-700/50" />
            <svg width="6" height="6" viewBox="0 0 6 6" className="shrink-0 text-zinc-300 dark:text-zinc-600" aria-hidden="true"><polygon points="3,0 6,3 3,6 0,3" fill="currentColor" /></svg>
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
              {lang === 'th' ? 'เจาะลึกรายเดือน' : 'Monthly Deep Dive'}
            </h2>
            <svg width="6" height="6" viewBox="0 0 6 6" className="shrink-0 text-zinc-300 dark:text-zinc-600" aria-hidden="true"><polygon points="3,0 6,3 3,6 0,3" fill="currentColor" /></svg>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-300 to-transparent dark:via-zinc-700/50" />
          </div>

          {/* ⑧ Monthly Comparisons */}
          <section className={dashboardSectionClass}>
            <h2 className={heading2}>{lang === 'th' ? 'เปรียบเทียบรายเดือน' : 'Monthly comparison by alert type'}</h2>
            <p className={`mt-1 ${textSecondary}`}>{lang === 'th' ? 'เปรียบเทียบทุกเดือนของแต่ละประเภท' : 'Compare each alert type across months.'}</p>
            <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {monthlyComparisons.slice(0, 9).map((comparison) => {
                const highest = comparison.rows.reduce((max, r) => Math.max(max, r.total), 0);
                const highestMonthKey = comparison.rows.find((r) => r.total === highest)?.monthKey;
                return (
                  <div
                    key={comparison.label}
                    className="rounded-lg border border-zinc-100 p-4 dark:border-zinc-800"
                    style={{ background: `linear-gradient(135deg, ${comparison.color}0D 0%, transparent 60%)` }}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      <span className="inline-block h-3 w-5 rounded-sm" style={{ backgroundColor: comparison.color }} />
                      {comparison.label}
                    </div>
                    {comparison.rows.length >= 2 && (
                      <div className="mt-1.5">
                        <TrendIndicator current={comparison.rows[0].total} previous={comparison.rows[1].total} suffix={lang === 'th' ? 'เทียบเดือนก่อน' : 'vs prior'} />
                      </div>
                    )}
                    <div className="mt-2.5 space-y-1.5">
                      {comparison.rows.map((row) => {
                        const wp = highest === 0 || row.total === 0 ? 0 : Math.max((row.total / highest) * 100, 2);
                        const isHighest = highest > 0 && row.monthKey === highestMonthKey;
                        return (
                          <div key={`${comparison.label}-${row.monthKey}`}>
                            <div className="mb-0.5 flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1 text-zinc-600 dark:text-zinc-300">
                                {isHighest && <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: comparison.color }} />}
                                {row.monthLabel}
                              </span>
                              <span className="font-medium text-zinc-900 dark:text-zinc-100">{row.total}</span>
                            </div>
                            <div className="h-2.5 rounded-full bg-zinc-200 dark:bg-zinc-800">
                              <div className="h-2.5 rounded-full transition-[width]" style={{ width: `${wp}%`, backgroundColor: comparison.color }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          </>
          )}
        </div>
    </DashboardShell>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import useGoogleSheet from './useGoogleSheet';
import { loadStoredFilters, saveStoredFilters } from './filterStorage';
import { saveDashboardScore } from './scoreCache';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import LoadingState from './LoadingState';
import { getDashboardCopy, type DashboardLang } from 'app/dashboard/i18n-copy';
import {
  computeSafetyScore,
  findValue,
  normalizeLabel,
  parseDate,
  remarkMatchesAllowedTarget,
  STANDARD_ALERT_TYPES,
  STANDARD_REMARK_TARGETS,
  toDayKey,
  toMonthKey,
  previousMonthKey,
  withDerivedRemark,
  applyAlertRules,
  resolveScopeFleetNames,
  scopeFleetSet,
  ALERT_TIME_ALIASES,
  type AlertRule,
} from './dashboardDataUtils';
import TrendChart from 'app/ui/TrendChart';
import { DataTable, type Column } from 'app/ui/DataTable';
import KpiCard from 'app/ui/KpiCard';
import ExportButton from 'app/ui/ExportButton';
import { heading2 } from 'app/ui/design-tokens';
import FilterBar from 'app/ui/FilterBar';
import InlineMonthPicker from 'app/ui/InlineMonthPicker';
import InlineDayPicker from 'app/ui/InlineDayPicker';
import MultiSelect from 'app/ui/MultiSelect';

const DEFAULT_SIMPLE_ALERT_TYPES = [...STANDARD_ALERT_TYPES];
const DEFAULT_SIMPLE_REMARKS = STANDARD_REMARK_TARGETS.map((r) => normalizeLabel(r));

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

type SimpleFilterState = {
  month: string;
  dayFilters: string[];
  fleetFilters: string[];
  vehicleFilters: string[];
  driverFilters: string[];
};

const defaultFilters: SimpleFilterState = {
  month: '',
  dayFilters: [],
  fleetFilters: [],
  vehicleFilters: [],
  driverFilters: [],
};

type TableRow = {
  dateKey: string;
  dateLabel: string;
  vehicle: string;
  fatigue: number;
  yawning: number;
  distraction: number;
  total: number;
  sortDate: number;
};

export default function SimpleDashboard({
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
  const copy = getDashboardCopy(lang);
  const scopeNames = useMemo(
    () => resolveScopeFleetNames(organizationName, organizationNames),
    [organizationName, organizationNames],
  );
  const scopeSet = useMemo(
    () => scopeFleetSet(organizationName, organizationNames),
    [organizationName, organizationNames],
  );
  const [filters, setFilters] = useState<SimpleFilterState>({ ...defaultFilters, fleetFilters: scopeNames });
  const storageKey = useMemo(() => `${dashboardId}-v2`, [dashboardId]);
  const didSetDefaultMonth = useRef(false);
  const defaultMonthKey = useMemo(() => previousMonthKey(), []);
  const monthKeysForFetch = useMemo(
    () => (filters.month ? [filters.month] : []),
    [filters.month],
  );
  const { rows, columns: sheetColumns, loading, refreshing, progress, error, lastUpdated, refresh, availableMonths } = useGoogleSheet({
    sheetId,
    gid: sheetGid,
    monthKeys: monthKeysForFetch,
    loadMonthCatalog: true,
  });

  // ── Load persisted filters ──────────────────────────────────────────────
  useEffect(() => {
    const stored = loadStoredFilters<SimpleFilterState>(storageKey);
    if (!stored) return;
    const frame = requestAnimationFrame(() => {
      const storedMonth = typeof stored.month === 'string' ? stored.month : '';
      if (storedMonth) didSetDefaultMonth.current = true;
      setFilters({
        month: storedMonth,
        dayFilters: Array.isArray(stored.dayFilters)
          ? stored.dayFilters.filter((v) => typeof v === 'string')
          : [],
        fleetFilters: (Array.isArray((stored as SimpleFilterState).fleetFilters) && (stored as SimpleFilterState).fleetFilters.length > 0)
          ? (stored as SimpleFilterState).fleetFilters.filter((v) => typeof v === 'string')
          : scopeNames,
        vehicleFilters: Array.isArray(stored.vehicleFilters)
          ? stored.vehicleFilters.filter((v) => typeof v === 'string')
          : [],
        driverFilters: Array.isArray(stored.driverFilters)
          ? stored.driverFilters.filter((v) => typeof v === 'string')
          : [],
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [storageKey]);

  // ── Persist filters ─────────────────────────────────────────────────────
  useEffect(() => {
    saveStoredFilters(storageKey, filters);
  }, [storageKey, filters]);

  const resetFilters = () =>
    setFilters({ ...defaultFilters, month: defaultMonthKey, fleetFilters: scopeNames });

  const hasActiveFilters = useMemo(() => {
    return filters.month !== '' || filters.dayFilters.length > 0 || filters.fleetFilters.length > 0 || filters.vehicleFilters.length > 0 || filters.driverFilters.length > 0;
  }, [filters]);

  // null = allow-all; only restrict if admin explicitly set an allow-list.
  const effectiveAlertTypes = useMemo<string[] | null>(
    () => (allowedAlertTypesProp && allowedAlertTypesProp.length > 0 ? allowedAlertTypesProp : null),
    [allowedAlertTypesProp],
  );
  const effectiveRemarks = useMemo<string[] | null>(
    () => (allowedRemarksProp && allowedRemarksProp.length > 0
      ? allowedRemarksProp.map((r) => normalizeLabel(r))
      : null),
    [allowedRemarksProp],
  );

  // ── Data pipeline (preserves alert type scope) ──────────────────────────
  const baseAlerts = useMemo(() => {
    const rules = alertRulesProp ?? [];
    const normalizedAllowedRemarks = effectiveRemarks;
    const normalizedAllowed = effectiveAlertTypes ? new Set(effectiveAlertTypes.map((a) => normalizeLabel(a))) : null;
    return rows
      .map((row) => {
        const alertType = String(findValue(row, ['Alert Type']) ?? '');
        const derived = withDerivedRemark(alertType, String(findValue(row, ['Remarks']) ?? ''));
        const speed = Number(findValue(row, ['Speed', 'Max Speed']) ?? 0) || 0;
        const remarks = applyAlertRules(alertType, derived, speed, rules);
        const dateValue = findValue(row, ALERT_TIME_ALIASES);
        const parsedDate = parseDate(dateValue);
        return {
          sourceRow: row,
          alertType,
          remarks,
          parsedDate,
          vehicle: String(findValue(row, ['Vehicle No', 'Vehicle No TH']) ?? '—'),
          driver: String(findValue(row, ['Driver Name']) ?? '—'),
          fleet: String(findValue(row, ['Fleet']) ?? ''),
        };
      })
      .filter((row) => {
        // Hard fleet scope: drop rows outside the dashboard's fleet set.
        if (scopeSet.size > 0 && !scopeSet.has(normalizeLabel(row.fleet))) return false;
        if (normalizedAllowed && !normalizedAllowed.has(normalizeLabel(row.alertType))) return false;
        if (normalizedAllowedRemarks) {
          const nRemark = normalizeLabel(row.remarks);
          if (!normalizedAllowedRemarks.some((t) => remarkMatchesAllowedTarget(nRemark, t))) return false;
        }
        return true;
      })
      .filter((row) => row.parsedDate);
  }, [alertRulesProp, rows, effectiveAlertTypes, effectiveRemarks, scopeSet]);

  // ── Default to current month when no stored filters ──────────────────────
  const monthOptions = useMemo(() => {
    if (availableMonths.length > 0) return availableMonths.map((m) => m.key);
    const keys = new Set<string>();
    baseAlerts.forEach((row) => {
      if (row.parsedDate) keys.add(toMonthKey(row.parsedDate));
    });
    return Array.from(keys).sort();
  }, [availableMonths, baseAlerts]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (didSetDefaultMonth.current) return;
      if (monthOptions.length === 0) return;
      if (filters.month !== '') {
        didSetDefaultMonth.current = true;
        return;
      }
      didSetDefaultMonth.current = true;
      const next = monthOptions.includes(defaultMonthKey) ? defaultMonthKey : monthOptions[0]!;
      setFilters((f) => ({ ...f, month: next, dayFilters: [] }));
    });
    return () => cancelAnimationFrame(frame);
  }, [defaultMonthKey, filters.month, monthOptions]);

  // ── Month-filtered alerts ───────────────────────────────────────────────
  const monthFilteredAlerts = useMemo(() => {
    let alerts = baseAlerts;
    if (filters.month) {
      alerts = alerts.filter((row) => row.parsedDate && toMonthKey(row.parsedDate) === filters.month);
    }
    if (filters.dayFilters.length > 0) {
      alerts = alerts.filter((row) => row.parsedDate && filters.dayFilters.includes(toDayKey(row.parsedDate)));
    }
    return alerts;
  }, [baseAlerts, filters.month, filters.dayFilters]);

  // ── Fleet options (from all data, not month-filtered) ──────────────────
  const fleetOptions = useMemo(() => {
    const unique = new Set<string>();
    baseAlerts.forEach((row) => { if (row.fleet && row.fleet !== '—') unique.add(row.fleet); });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [baseAlerts]);

  // ── Compute options from month-filtered data ────────────────────────────
  const vehicleOptions = useMemo(() => {
    const vehicles = new Set<string>();
    monthFilteredAlerts.forEach((row) => {
      if (row.vehicle && row.vehicle !== '—') vehicles.add(row.vehicle);
    });
    return Array.from(vehicles).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [monthFilteredAlerts]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setFilters((current) => {
        const next = current.vehicleFilters.filter((v) => vehicleOptions.includes(v));
        if (next.length === current.vehicleFilters.length) return current;
        return { ...current, vehicleFilters: next };
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [vehicleOptions]);

  const driverOptions = useMemo(() => {
    const drivers = new Set<string>();
    monthFilteredAlerts.forEach((row) => {
      if (row.driver && row.driver !== '—') drivers.add(row.driver);
    });
    return Array.from(drivers).sort((a, b) => a.localeCompare(b));
  }, [monthFilteredAlerts]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setFilters((current) => {
        const next = current.driverFilters.filter((d) => driverOptions.includes(d));
        if (next.length === current.driverFilters.length) return current;
        return { ...current, driverFilters: next };
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [driverOptions]);

  // ── Fully filtered alerts ───────────────────────────────────────────────
  const filteredAlerts = useMemo(() => {
    let alerts = monthFilteredAlerts;
    if (filters.fleetFilters.length > 0) {
      const activeFleets = new Set(filters.fleetFilters.map((f) => normalizeLabel(f)));
      alerts = alerts.filter((row) => activeFleets.has(normalizeLabel(row.fleet)));
    }
    if (filters.vehicleFilters.length > 0) {
      const activeVehicles = new Set(filters.vehicleFilters);
      alerts = alerts.filter((row) => activeVehicles.has(row.vehicle));
    }
    if (filters.driverFilters.length > 0) {
      const activeDrivers = new Set(filters.driverFilters);
      alerts = alerts.filter((row) => activeDrivers.has(row.driver));
    }
    return alerts;
  }, [monthFilteredAlerts, filters.fleetFilters, filters.vehicleFilters, filters.driverFilters]);

  const uniqueVehiclesForScore = useMemo(
    () => new Set(filteredAlerts.map((r) => r.vehicle).filter((v) => v && v !== '—')).size,
    [filteredAlerts],
  );
  const dayCountForScore = useMemo(() => {
    const days = new Set<string>();
    filteredAlerts.forEach((r) => {
      if (r.parsedDate) days.add(toDayKey(r.parsedDate));
    });
    return Math.max(1, days.size);
  }, [filteredAlerts]);
  const overallSafetyScore = useMemo(
    () => computeSafetyScore(filteredAlerts.length, Math.max(1, uniqueVehiclesForScore), dayCountForScore),
    [filteredAlerts.length, uniqueVehiclesForScore, dayCountForScore],
  );

  useEffect(() => {
    if (loading) return;
    saveDashboardScore(dashboardId, overallSafetyScore, filteredAlerts.length);
  }, [dashboardId, loading, overallSafetyScore, filteredAlerts.length]);

  // ── Stats ───────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const vehicles = new Set<string>();
    const drivers = new Set<string>();
    const days = new Set<string>();
    const remarkTotals = { fatigue: 0, yawning: 0, distraction: 0 };

    filteredAlerts.forEach((row) => {
      if (row.vehicle) vehicles.add(row.vehicle);
      if (row.driver && row.driver !== '—') drivers.add(row.driver);
      if (row.parsedDate) days.add(toDayKey(row.parsedDate));
      const remark = normalizeLabel(row.remarks);
      if (remark === 'fatigue') remarkTotals.fatigue += 1;
      if (remark === 'yawning') remarkTotals.yawning += 1;
      if (remark === 'distraction') remarkTotals.distraction += 1;
    });

    return {
      total: filteredAlerts.length,
      vehicles: vehicles.size,
      drivers: drivers.size,
      dayCount: days.size,
      remarks: remarkTotals,
    };
  }, [filteredAlerts]);

  // ── Trend vs prior period for Total alerts KPI ─────────────────────────
  const alertsTrend = useMemo(() => {
    if (!filters.month) return undefined;
    // Parse selected month into a date range
    const [yearStr, monthStr] = filters.month.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1-based
    if (isNaN(year) || isNaN(month)) return undefined;

    // Prior period = previous month
    const priorFrom = new Date(year, month - 2, 1);
    const priorTo = new Date(year, month - 1, 0, 23, 59, 59, 999);

    const vehicleSet = filters.vehicleFilters.length > 0 ? new Set(filters.vehicleFilters) : null;
    const driverSet = filters.driverFilters.length > 0 ? new Set(filters.driverFilters) : null;

    let priorCount = 0;
    baseAlerts.forEach((row) => {
      if (!row.parsedDate) return;
      if (vehicleSet && !vehicleSet.has(row.vehicle)) return;
      if (driverSet && !driverSet.has(row.driver)) return;
      if (row.parsedDate >= priorFrom && row.parsedDate <= priorTo) {
        priorCount += 1;
      }
    });
    if (priorCount === 0) return undefined;
    const percentChange = Math.round(((stats.total - priorCount) / priorCount) * 100);
    return {
      value: percentChange,
      label: lang === 'th' ? 'เทียบเดือนก่อน' : 'vs prior month',
    };
  }, [filters.month, filters.vehicleFilters, filters.driverFilters, baseAlerts, stats.total, lang]);

  // ── Active filter count for DashboardShell badge ───────────────────────
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.month) count += 1;
    count += filters.dayFilters.length;
    count += filters.vehicleFilters.length;
    count += filters.driverFilters.length;
    return count;
  }, [filters.month, filters.dayFilters.length, filters.vehicleFilters.length, filters.driverFilters.length]);

  // ── Trend chart data (TrendChart format) ───────────────────────────────
  const trendChartData = useMemo(() => {
    const counts = new Map<string, { key: string; date: Date; count: number }>();
    filteredAlerts.forEach((row) => {
      if (!row.parsedDate) return;
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
      .map((d) => ({
        label: d.date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }),
        value: d.count,
      }));
  }, [filteredAlerts]);

  // ── DataTable rows: daily counts per vehicle ──────────────────────────
  const tableRows = useMemo<TableRow[]>(() => {
    const grouped = new Map<string, TableRow>();
    filteredAlerts.forEach((row) => {
      const dateLabel = row.parsedDate ? row.parsedDate.toLocaleDateString('en-GB', { timeZone: 'UTC' }) : '—';
      const dateKey = row.parsedDate ? toDayKey(row.parsedDate) : 'unknown';
      const groupKey = `${dateKey}-${row.vehicle}`;
      const existing = grouped.get(groupKey);
      if (existing) {
        const remark = normalizeLabel(row.remarks);
        if (remark === 'fatigue') existing.fatigue += 1;
        if (remark === 'yawning') existing.yawning += 1;
        if (remark === 'distraction') existing.distraction += 1;
        existing.total += 1;
      } else {
        const remark = normalizeLabel(row.remarks);
        grouped.set(groupKey, {
          dateKey,
          dateLabel,
          vehicle: row.vehicle,
          fatigue: remark === 'fatigue' ? 1 : 0,
          yawning: remark === 'yawning' ? 1 : 0,
          distraction: remark === 'distraction' ? 1 : 0,
          total: 1,
          sortDate: row.parsedDate ? row.parsedDate.getTime() : 0,
        });
      }
    });
    return Array.from(grouped.values());
  }, [filteredAlerts]);

  // ── DataTable columns ──────────────────────────────────────────────────
  const tableColumns = useMemo<Column<TableRow>[]>(() => [
    {
      key: 'dateLabel',
      label: lang === 'th' ? 'วันที่' : 'Date',
      sortable: true,
    },
    {
      key: 'vehicle',
      label: lang === 'th' ? 'เลขรถ' : 'Vehicle number',
      sortable: true,
      render: (value) => <span className="font-semibold">{String(value)}</span>,
    },
    // Tiny colored dot beside each number so columns stay distinguishable for
    // color-blind readers — the shape is redundant but the column header label
    // is the primary signifier regardless.
    {
      key: 'fatigue',
      label: lang === 'th' ? 'ง่วงนอน' : 'Fatigue',
      sortable: true,
      render: (value) => (
        <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-300">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          {String(value)}
        </span>
      ),
    },
    {
      key: 'yawning',
      label: lang === 'th' ? 'หาว' : 'Yawning',
      sortable: true,
      render: (value) => (
        <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-300">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {String(value)}
        </span>
      ),
    },
    {
      key: 'distraction',
      label: lang === 'th' ? 'ไม่สนใจ' : 'Distraction',
      sortable: true,
      render: (value) => (
        <span className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-300">
          <span aria-hidden className="h-1.5 w-1.5 rotate-45 bg-red-500" />
          {String(value)}
        </span>
      ),
    },
    {
      key: 'total',
      label: lang === 'th' ? 'ทั้งหมด' : 'Total',
      sortable: true,
      render: (value) => <span className="font-semibold text-rose-600 dark:text-rose-300">{String(value)}</span>,
    },
  ], [lang]);

  // ── Export data ────────────────────────────────────────────────────────
  const exportData = useMemo(() =>
    tableRows.map((row) => ({
      date: row.dateLabel,
      vehicle: row.vehicle,
      fatigue: row.fatigue,
      yawning: row.yawning,
      distraction: row.distraction,
      total: row.total,
    })),
  [tableRows]);

  const exportDateRange = useMemo(() => {
    return filters.month || undefined;
  }, [filters.month]);

  return (
    <DashboardShell
      title={dashboardName}
      subtitle={lang === 'th' ? 'แดชบอร์ดแบบง่าย' : 'Simple dashboard'}
      lang={lang}
      lastUpdated={lastUpdated}
      notes={dashboardNotes}
      isStale={!loading && !error && filteredAlerts.length === 0 && baseAlerts.length > 0}
      activeFilterCount={activeFilterCount}
      dashboardId={dashboardId}
      isAdmin={isAdmin}
      actions={
        <ExportButton
          data={exportData}
          fullSheetExport={{ rows, filteredRows: filteredAlerts.map((r) => r.sourceRow), columns: sheetColumns }}
          dashboardName="SimpleDashboard"
          dateRange={exportDateRange}
          settingsStorageKey={`simple-${dashboardId}`}
          lang={lang}
          fullSheetHint={
            lang === 'th'
              ? 'ใช้ตัวกรองเดียวกับตารางนี้ แต่ส่งออกแถวดิบจากชีตหนึ่งแถวต่อเหตุการณ์ ไม่ใช่หนึ่งแถวต่อแถวที่รวมในตาราง — รวมทุกคอลัมน์ในชีต'
              : 'Same filters as this table, but exports raw spreadsheet rows (one row per underlying event), not one row per aggregated table row. Includes every sheet column.'
          }
          columns={[
            { key: 'date', label: lang === 'th' ? 'วันที่' : 'Date' },
            { key: 'vehicle', label: lang === 'th' ? 'เลขรถ' : 'Vehicle number' },
            { key: 'fatigue', label: lang === 'th' ? 'ง่วงนอน' : 'Fatigue' },
            { key: 'yawning', label: lang === 'th' ? 'หาว' : 'Yawning' },
            { key: 'distraction', label: lang === 'th' ? 'ไม่สนใจ' : 'Distraction' },
            { key: 'total', label: lang === 'th' ? 'ทั้งหมด' : 'Total' },
          ]}
          label={lang === 'th' ? 'ส่งออก CSV' : 'Export CSV'}
        />
      }
    >
      <div className="flex flex-col gap-6">
          <FilterBar>
            <InlineMonthPicker
              value={filters.month}
              onChange={(v) => setFilters((f) => ({ ...f, month: v as string, dayFilters: [] }))}
              lang={lang}
            />
            {filters.month && (
              <InlineDayPicker
                monthKey={filters.month}
                value={filters.dayFilters}
                onChange={(v) => setFilters((f) => ({ ...f, dayFilters: v as string[] }))}
                multi
                lang={lang}
              />
            )}
            {fleetOptions.length > 1 && (
              <MultiSelect
                label={lang === 'th' ? 'กลุ่มรถ' : 'fleets'}
                options={fleetOptions}
                selected={filters.fleetFilters}
                onChange={(v) => setFilters((f) => ({ ...f, fleetFilters: v }))}
                lang={lang}
              />
            )}
            <MultiSelect
              label={lang === 'th' ? 'ยานพาหนะ' : 'vehicles'}
              options={vehicleOptions}
              selected={filters.vehicleFilters}
              onChange={(v) => setFilters((f) => ({ ...f, vehicleFilters: v }))}
              lang={lang}
            />
            <MultiSelect
              label={lang === 'th' ? 'คนขับ' : 'drivers'}
              options={driverOptions}
              selected={filters.driverFilters}
              onChange={(v) => setFilters((f) => ({ ...f, driverFilters: v }))}
              lang={lang}
            />
            {hasActiveFilters && (
              <button type="button" onClick={resetFilters} className="ml-auto text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                {lang === 'th' ? 'รีเซ็ต' : 'Reset'}
              </button>
            )}
          </FilterBar>

          {(loading || error) ? (
            <LoadingState
              error={error ?? undefined}
              onRetry={refresh}
              lang={lang}
              message={
                progress
                  ? (lang === 'th'
                      ? `กำลังโหลดเดือนที่เลือก… ${Math.round((progress.done / progress.total) * 100)}%`
                      : `Loading selected month… ${Math.round((progress.done / progress.total) * 100)}%`)
                  : (lang === 'th' ? 'กำลังโหลด…' : 'Loading…')
              }
              fallbackDetail={copy.loadingDetail}
            />
          ) : (
          <>
          {refreshing && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400" role="status" aria-live="polite">
              {lang === 'th' ? 'กำลังโหลดข้อมูลเพิ่มเติม…' : 'Loading more data…'}
              {progress ? ` ${Math.round((progress.done / progress.total) * 100)}%` : ''}
            </p>
          )}
          {/* KPIs — one row, the only numbers that matter */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label={lang === 'th' ? 'ทั้งหมด' : 'Total'}
              value={stats.total.toLocaleString()}
              trend={alertsTrend}
            />
            <KpiCard
              label={lang === 'th' ? 'ง่วงนอน' : 'Fatigue'}
              value={stats.remarks.fatigue.toLocaleString()}
              accentColor="#F59E0B"
            />
            <KpiCard
              label={lang === 'th' ? 'หาว' : 'Yawning'}
              value={stats.remarks.yawning.toLocaleString()}
              accentColor="#10B981"
            />
            <KpiCard
              label={lang === 'th' ? 'ไม่สนใจ' : 'Distraction'}
              value={stats.remarks.distraction.toLocaleString()}
              accentColor="#EF4444"
            />
          </div>

          {/* Trend */}
          <section className={dashboardSectionClass}>
            <h2 className={heading2}>{lang === 'th' ? 'แนวโน้มรายวัน' : 'Daily trend'}</h2>
            <TrendChart
              className="mt-3"
              data={trendChartData}
              mode="line"
              height={260}
              ariaLabel={lang === 'th' ? 'แนวโน้มรายวัน' : 'Daily alert trend'}
            />
          </section>

          {/* Table */}
          <section className={dashboardSectionClass}>
            <h2 className={heading2}>{lang === 'th' ? 'รายละเอียด' : 'Details'}</h2>
            <div className="mt-3">
              <DataTable
                columns={tableColumns}
                data={tableRows}
                defaultSort={{ key: 'sortDate', direction: 'desc' }}
                pageSize={15}
                ariaLabel={lang === 'th' ? 'ตารางการแจ้งเตือน' : 'Alert table'}
              />
            </div>
          </section>
          </>
          )}
        </div>
    </DashboardShell>
  );
}

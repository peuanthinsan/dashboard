'use client';

import { useEffect, useMemo, useState } from 'react';
import useGoogleSheet from './useGoogleSheet';
import { formatDateKeyGB } from './dateFormat';
import { FilterChip } from './FilterChip';
import { loadStoredFilters, saveStoredFilters } from './filterStorage';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import LoadingState from './LoadingState';
import { getDashboardCopy, type DashboardLang } from 'app/dashboard/i18n-copy';
import {
  findValue,
  normalizeLabel,
  parseDate,
  toDayKey,
  withDerivedRemark,
} from './dashboardDataUtils';
import TrendChart from 'app/ui/TrendChart';
import { DataTable, type Column } from 'app/ui/DataTable';
import KpiCard from 'app/ui/KpiCard';
import ExportButton from 'app/ui/ExportButton';
import { heading2, textSecondary, inputBase } from 'app/ui/design-tokens';
import FilterBar from 'app/ui/FilterBar';

type DashboardProps = {
  dashboardId: string;
  dashboardName: string;
  sheetId: string;
  sheetGid: string;
  dashboardNotes?: string | null;
  organizationName?: string | null;
  lang?: DashboardLang;
};

type RemarkFilter = 'all' | 'fatigue' | 'yawning' | 'distraction';
type SimpleFilterState = {
  dateRange: { from: string; to: string };
  vehicleFilters: string[];
  driverFilters: string[];
  trendRemarkFilter: RemarkFilter;
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
  lang = 'en',
}: DashboardProps) {
  const copy = getDashboardCopy(lang);
  const { rows, loading, error, lastUpdated } = useGoogleSheet({ sheetId, gid: sheetGid });
  const normalizedOrganizationName = useMemo(
    () => (organizationName ? normalizeLabel(organizationName) : null),
    [organizationName],
  );
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [remarkFilter, setRemarkFilter] = useState<RemarkFilter>('all');
  const [vehicleFilters, setVehicleFilters] = useState<string[]>([]);
  const [vehicleQuery, setVehicleQuery] = useState('');
  const [driverFilters, setDriverFilters] = useState<string[]>([]);
  const [driverQuery, setDriverQuery] = useState('');
  const storageKey = useMemo(() => dashboardId, [dashboardId]);

  useEffect(() => {
    const stored = loadStoredFilters<SimpleFilterState>(storageKey);
    if (!stored) return;
    if (stored.dateRange) {
      setDateRange({
        from: typeof stored.dateRange.from === 'string' ? stored.dateRange.from : '',
        to: typeof stored.dateRange.to === 'string' ? stored.dateRange.to : '',
      });
    }
    if (Array.isArray(stored.vehicleFilters)) {
      setVehicleFilters(stored.vehicleFilters.filter((value) => typeof value === 'string'));
    }
    if (Array.isArray(stored.driverFilters)) {
      setDriverFilters(stored.driverFilters.filter((value) => typeof value === 'string'));
    }
    if (stored.trendRemarkFilter && ['all', 'fatigue', 'yawning', 'distraction'].includes(stored.trendRemarkFilter)) {
      setRemarkFilter(stored.trendRemarkFilter);
    }
  }, [storageKey]);

  useEffect(() => {
    saveStoredFilters(storageKey, {
      dateRange,
      vehicleFilters,
      driverFilters,
      trendRemarkFilter: remarkFilter,
    });
  }, [dateRange, driverFilters, storageKey, remarkFilter, vehicleFilters]);

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
    setDateRange({ from: '', to: '' });
    setVehicleFilters([]);
    setVehicleQuery('');
    setDriverFilters([]);
    setDriverQuery('');
    setRemarkFilter('all');
  };

  // ── Data pipeline (preserves alert type scope) ──────────────────────────
  const baseAlerts = useMemo(() => {
    const allowedRemarks = new Set(['fatigue', 'yawning', 'distraction']);
    return rows
      .map((row) => {
        const alertType = String(findValue(row, ['Alert Type']) ?? '');
        const remarks = withDerivedRemark(
          alertType,
          String(findValue(row, ['Remarks']) ?? ''),
        );
        const dateValue = findValue(row, ['Alert Date Time', 'Track Time', 'Date']);
        const parsedDate = parseDate(dateValue);
        return {
          alertType,
          remarks,
          parsedDate,
          vehicle: String(findValue(row, ['Vehicle No', 'Vehicle No TH']) ?? '—'),
          driver: String(findValue(row, ['Driver Name']) ?? '—'),
          fleet: String(findValue(row, ['Fleet']) ?? ''),
        };
      })
      .filter((row) => {
        if (!normalizedOrganizationName) return true;
        return normalizeLabel(row.fleet) === normalizedOrganizationName;
      })
      .filter((row) => {
        const normalizedAlertType = normalizeLabel(row.alertType);
        const isSupportedAlertType =
          normalizedAlertType === normalizeLabel('Eye Closing-A2') ||
          normalizedAlertType === normalizeLabel('Yawning-A2');
        if (!isSupportedAlertType) return false;
        return allowedRemarks.has(normalizeLabel(row.remarks));
      })
      .filter((row) => row.parsedDate);
  }, [normalizedOrganizationName, rows]);

  const dateBounds = useMemo(() => {
    let minDate: Date | null = null;
    let maxDate: Date | null = null;
    baseAlerts.forEach((row) => {
      if (!row.parsedDate) return;
      if (!minDate || row.parsedDate < minDate) minDate = row.parsedDate;
      if (!maxDate || row.parsedDate > maxDate) maxDate = row.parsedDate;
    });
    return {
      min: minDate ? toDayKey(minDate) : '',
      max: maxDate ? toDayKey(maxDate) : '',
    };
  }, [baseAlerts]);

  const dateFilteredAlerts = useMemo(() => {
    const startDate = dateRange.from ? new Date(`${dateRange.from}T00:00:00`) : null;
    const endDate = dateRange.to ? new Date(`${dateRange.to}T23:59:59.999`) : null;
    return baseAlerts.filter((row) => {
      if (!row.parsedDate) return false;
      if (startDate && row.parsedDate < startDate) return false;
      if (endDate && row.parsedDate > endDate) return false;
      return true;
    });
  }, [baseAlerts, dateRange.from, dateRange.to]);

  const vehicleOptions = useMemo(() => {
    const vehicles = new Set<string>();
    dateFilteredAlerts.forEach((row) => {
      if (row.vehicle && row.vehicle !== '—') vehicles.add(row.vehicle);
    });
    return Array.from(vehicles).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [dateFilteredAlerts]);

  useEffect(() => {
    setVehicleFilters((current) => current.filter((vehicle) => vehicleOptions.includes(vehicle)));
  }, [vehicleOptions]);

  const driverOptions = useMemo(() => {
    const drivers = new Set<string>();
    dateFilteredAlerts.forEach((row) => {
      if (row.driver && row.driver !== '—') drivers.add(row.driver);
    });
    return Array.from(drivers).sort((a, b) => a.localeCompare(b));
  }, [dateFilteredAlerts]);

  useEffect(() => {
    setDriverFilters((current) => current.filter((driver) => driverOptions.includes(driver)));
  }, [driverOptions]);

  const filteredAlerts = useMemo(() => {
    let alerts = dateFilteredAlerts;
    if (vehicleFilters.length > 0) {
      const activeVehicles = new Set(vehicleFilters);
      alerts = alerts.filter((row) => activeVehicles.has(row.vehicle));
    }
    if (driverFilters.length > 0) {
      const activeDrivers = new Set(driverFilters);
      alerts = alerts.filter((row) => activeDrivers.has(row.driver));
    }
    if (remarkFilter !== 'all') {
      alerts = alerts.filter((row) => normalizeLabel(row.remarks) === remarkFilter);
    }
    return alerts;
  }, [dateFilteredAlerts, vehicleFilters, driverFilters, remarkFilter]);

  const filteredVehicleOptions = useMemo(() => {
    const query = vehicleQuery.trim().toLowerCase();
    if (!query) return vehicleOptions;
    return vehicleOptions.filter((vehicle) => vehicle.toLowerCase().includes(query));
  }, [vehicleOptions, vehicleQuery]);

  const filteredDriverOptions = useMemo(() => {
    const query = driverQuery.trim().toLowerCase();
    if (!query) return driverOptions;
    return driverOptions.filter((driver) => driver.toLowerCase().includes(query));
  }, [driverOptions, driverQuery]);

  // ── Stats ───────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const vehicles = new Set<string>();
    const drivers = new Set<string>();
    const remarkTotals = { fatigue: 0, yawning: 0, distraction: 0 };

    filteredAlerts.forEach((row) => {
      if (row.vehicle) vehicles.add(row.vehicle);
      if (row.driver && row.driver !== '—') drivers.add(row.driver);
      const remark = normalizeLabel(row.remarks);
      if (remark === 'fatigue') remarkTotals.fatigue += 1;
      if (remark === 'yawning') remarkTotals.yawning += 1;
      if (remark === 'distraction') remarkTotals.distraction += 1;
    });

    return {
      total: filteredAlerts.length,
      vehicles: vehicles.size,
      drivers: drivers.size,
      remarks: remarkTotals,
    };
  }, [filteredAlerts]);

  // ── Date range label for KPI card ──────────────────────────────────────
  const dateRangeLabel = useMemo(() => {
    if (dateBounds.min && dateBounds.max) {
      return `${formatDateKeyGB(dateBounds.min)} – ${formatDateKeyGB(dateBounds.max)}`;
    }
    return '—';
  }, [dateBounds.min, dateBounds.max]);

  // ── Trend vs prior period for Total alerts KPI ─────────────────────────
  const alertsTrend = useMemo(() => {
    if (!dateRange.from || !dateRange.to) return undefined;
    const from = new Date(`${dateRange.from}T00:00:00`);
    const to = new Date(`${dateRange.to}T23:59:59.999`);
    const durationMs = to.getTime() - from.getTime();
    if (durationMs <= 0) return undefined;
    const priorFrom = new Date(from.getTime() - durationMs - 1);
    const priorTo = new Date(from.getTime() - 1);
    let priorCount = 0;
    baseAlerts.forEach((row) => {
      if (!row.parsedDate) return;
      if (remarkFilter !== 'all' && normalizeLabel(row.remarks) !== remarkFilter) return;
      if (row.parsedDate >= priorFrom && row.parsedDate <= priorTo) {
        if (vehicleFilters.length > 0 && !vehicleFilters.includes(row.vehicle)) return;
        if (driverFilters.length > 0 && !driverFilters.includes(row.driver)) return;
        priorCount += 1;
      }
    });
    if (priorCount === 0) return undefined;
    const percentChange = Math.round(((stats.total - priorCount) / priorCount) * 100);
    return {
      value: percentChange,
      label: lang === 'th' ? 'เทียบช่วงก่อน' : 'vs prior period',
    };
  }, [dateRange.from, dateRange.to, baseAlerts, stats.total, remarkFilter, vehicleFilters, driverFilters, lang]);

  // ── Active filter count for DashboardShell badge ───────────────────────
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (dateRange.from || dateRange.to) count += 1;
    count += vehicleFilters.length;
    count += driverFilters.length;
    if (remarkFilter !== 'all') count += 1;
    return count;
  }, [dateRange.from, dateRange.to, vehicleFilters.length, driverFilters.length, remarkFilter]);

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
        const dayDate = new Date(row.parsedDate.getFullYear(), row.parsedDate.getMonth(), row.parsedDate.getDate());
        counts.set(dayKey, { key: dayKey, date: dayDate, count: 1 });
      }
    });
    return Array.from(counts.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((d) => ({
        label: d.date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        value: d.count,
      }));
  }, [filteredAlerts]);

  // ── DataTable rows: daily counts per vehicle ──────────────────────────
  const tableRows = useMemo<TableRow[]>(() => {
    const grouped = new Map<string, TableRow>();
    filteredAlerts.forEach((row) => {
      const dateLabel = row.parsedDate ? row.parsedDate.toLocaleDateString('en-GB') : '—';
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
    {
      key: 'fatigue',
      label: lang === 'th' ? 'ง่วงนอน' : 'Fatigue',
      sortable: true,
      render: (value) => <span className="text-amber-500 dark:text-amber-300">{String(value)}</span>,
    },
    {
      key: 'yawning',
      label: lang === 'th' ? 'หาว' : 'Yawning',
      sortable: true,
      render: (value) => <span className="text-emerald-500 dark:text-emerald-300">{String(value)}</span>,
    },
    {
      key: 'distraction',
      label: lang === 'th' ? 'ไม่สนใจ' : 'Distraction',
      sortable: true,
      render: (value) => <span className="text-indigo-500 dark:text-indigo-300">{String(value)}</span>,
    },
    {
      key: 'total',
      label: lang === 'th' ? 'ทั้งหมด' : 'Total',
      sortable: true,
      render: (value) => <span className="text-rose-500 dark:text-rose-300">{String(value)}</span>,
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
    const parts: string[] = [];
    if (dateRange.from) parts.push(dateRange.from);
    if (dateRange.to) parts.push(dateRange.to);
    return parts.join('_') || undefined;
  }, [dateRange.from, dateRange.to]);

  // ── Remark filter options ──────────────────────────────────────────────
  const remarkFilterOptions: { label: string; value: RemarkFilter }[] = useMemo(() => [
    { label: lang === 'th' ? 'ทั้งหมด' : 'All remarks', value: 'all' },
    { label: lang === 'th' ? 'ง่วงนอน' : 'Fatigue', value: 'fatigue' },
    { label: lang === 'th' ? 'หาว' : 'Yawning', value: 'yawning' },
    { label: lang === 'th' ? 'ไม่สนใจ' : 'Distraction', value: 'distraction' },
  ], [lang]);

  return (
    <DashboardShell
      title={dashboardName}
      subtitle={lang === 'th' ? 'แดชบอร์ดแบบง่าย' : 'Simple dashboard'}
      lang={lang}
      lastUpdated={lastUpdated}
      notes={dashboardNotes}
      isStale={!loading && !error && filteredAlerts.length === 0 && baseAlerts.length > 0}
      activeFilterCount={activeFilterCount}
      actions={
        <ExportButton
          data={exportData}
          dashboardName="SimpleDashboard"
          dateRange={exportDateRange}
          label={lang === 'th' ? 'ส่งออก CSV' : 'Export CSV'}
        />
      }
    >
      {(loading || error) ? (
        <LoadingState
          error={error ?? undefined}
          onRetry={() => window.location.reload()}
          lang={lang}
          message={lang === 'th' ? 'กำลังโหลดข้อมูลแดชบอร์ด…' : 'Loading dashboard data…'}
          detail={lang === 'th' ? 'กำลังรวบรวมกิจกรรมการแจ้งเตือนและแนวโน้ม' : 'Gathering alert activity and trends.'}
          fallbackDetail={copy.loadingDetail}
        />
      ) : (
        <>
          {/* ── KPI Row ──────────────────────────────────────────── */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label={lang === 'th' ? 'การแจ้งเตือนทั้งหมด' : 'Total alerts'}
              value={stats.total.toLocaleString()}
              trend={alertsTrend}
            />
            <KpiCard
              label={lang === 'th' ? 'ช่วงวันที่' : 'Date range'}
              value={dateRangeLabel}
            />
            <KpiCard
              label={lang === 'th' ? 'รถที่ไม่ซ้ำ' : 'Unique vehicles'}
              value={stats.vehicles}
              unit={lang === 'th' ? 'คัน' : 'vehicles'}
            />
            <KpiCard
              label={lang === 'th' ? 'คนขับที่ไม่ซ้ำ' : 'Unique drivers'}
              value={stats.drivers}
              unit={lang === 'th' ? 'คน' : 'drivers'}
            />
          </section>

          {/* ── Filters ──────────────────────────────────────────── */}
          <FilterBar>
            {/* Date range */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {lang === 'th' ? 'จากวันที่' : 'From'}
                {dateBounds.min && dateBounds.max && (
                  <span className="ml-1 font-normal text-zinc-400">({formatDateKeyGB(dateBounds.min)} – {formatDateKeyGB(dateBounds.max)})</span>
                )}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  lang="en-GB"
                  value={dateRange.from}
                  min={dateBounds.min}
                  max={dateRange.to || dateBounds.max}
                  onChange={(event) => setDateRange((current) => ({ ...current, from: event.target.value }))}
                  className={`${inputBase} !w-auto !py-1 !text-xs dark:[color-scheme:dark]`}
                />
                <span className={textSecondary}>–</span>
                <input
                  type="date"
                  lang="en-GB"
                  value={dateRange.to}
                  min={dateRange.from || dateBounds.min}
                  max={dateBounds.max}
                  onChange={(event) => setDateRange((current) => ({ ...current, to: event.target.value }))}
                  className={`${inputBase} !w-auto !py-1 !text-xs dark:[color-scheme:dark]`}
                />
                {(dateRange.from || dateRange.to) && (
                  <button type="button" onClick={() => setDateRange({ from: '', to: '' })} className="rounded px-1.5 py-1 text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300">×</button>
                )}
              </div>
            </div>

            {/* Vehicle filter */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{lang === 'th' ? 'รถ' : 'Vehicle'}</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {vehicleFilters.map((vehicle) => (
                  <FilterChip key={vehicle} active onClick={() => setVehicleFilters((current) => current.filter((item) => item !== vehicle))}>
                    {vehicle} ×
                  </FilterChip>
                ))}
                <input
                  list="vehicle-options"
                  value={vehicleQuery}
                  onChange={(event) => setVehicleQuery(event.target.value)}
                  placeholder={vehicleOptions.length === 0 ? (lang === 'th' ? 'ไม่มีรถ' : 'No vehicles') : (lang === 'th' ? 'ค้นหารถ' : 'Search')}
                  className={`${inputBase} !py-1 !text-xs !w-36`}
                />
                <datalist id="vehicle-options">{filteredVehicleOptions.map((vehicle) => <option key={vehicle} value={vehicle} />)}</datalist>
                <button type="button"
                  onClick={() => handleSearchAdd(vehicleQuery, (trimmed) => vehicleOptions.find((v) => v.toLowerCase() === trimmed.toLowerCase()), (matched) => setVehicleFilters((current) => (current.includes(matched) ? current : [...current, matched])), () => setVehicleQuery(''))}
                  className="rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 text-xs text-zinc-700 dark:text-zinc-200 hover:border-zinc-500">
                  {lang === 'th' ? 'เพิ่ม' : 'Add'}
                </button>
                {vehicleFilters.length > 0 && (
                  <button type="button" onClick={() => setVehicleFilters([])} className="rounded px-1.5 py-1 text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300">×</button>
                )}
              </div>
            </div>

            {/* Driver filter */}
            {driverOptions.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{lang === 'th' ? 'คนขับ' : 'Driver'}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {driverFilters.map((driver) => (
                    <FilterChip key={driver} active onClick={() => setDriverFilters((current) => current.filter((item) => item !== driver))}>
                      {driver} ×
                    </FilterChip>
                  ))}
                  <input
                    list="driver-options"
                    value={driverQuery}
                    onChange={(event) => setDriverQuery(event.target.value)}
                    placeholder={lang === 'th' ? 'ค้นหาคนขับ' : 'Search'}
                    className={`${inputBase} !py-1 !text-xs !w-36`}
                  />
                  <datalist id="driver-options">{filteredDriverOptions.map((driver) => <option key={driver} value={driver} />)}</datalist>
                  <button type="button"
                    onClick={() => handleSearchAdd(driverQuery, (trimmed) => driverOptions.find((d) => d.toLowerCase() === trimmed.toLowerCase()), (matched) => setDriverFilters((current) => (current.includes(matched) ? current : [...current, matched])), () => setDriverQuery(''))}
                    className="rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 text-xs text-zinc-700 dark:text-zinc-200 hover:border-zinc-500">
                    {lang === 'th' ? 'เพิ่ม' : 'Add'}
                  </button>
                  {driverFilters.length > 0 && (
                    <button type="button" onClick={() => setDriverFilters([])} className="rounded px-1.5 py-1 text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300">×</button>
                  )}
                </div>
              </div>
            )}

            {/* Alert type chips */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{lang === 'th' ? 'ประเภท' : 'Alert type'}</span>
              <div className="flex flex-wrap gap-1.5">
                {remarkFilterOptions.map((option) => (
                  <FilterChip key={option.value} active={remarkFilter === option.value} onClick={() => setRemarkFilter(option.value)}>
                    {option.label}
                  </FilterChip>
                ))}
              </div>
            </div>

            {/* Reset */}
            {activeFilterCount > 0 && (
              <div className="ml-auto flex items-end pb-0.5">
                <button type="button" onClick={resetFilters} className="rounded-md px-2.5 py-1 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50 hover:text-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-950 dark:hover:text-indigo-300">
                  {lang === 'th' ? 'รีเซ็ต' : 'Reset'}
                </button>
              </div>
            )}
          </FilterBar>

          {/* ── Daily alert trend (TrendChart) ───────────────────── */}
          <section className={dashboardSectionClass}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className={heading2}>{lang === 'th' ? 'แนวโน้มการแจ้งเตือนรายวัน' : 'Daily alert trend'}</h2>
                <p className={textSecondary}>
                  {lang === 'th'
                    ? 'การแจ้งเตือน Eye Closing-A2 และ Yawning-A2 สำหรับง่วงนอน หาว และไม่สนใจ'
                    : 'Eye Closing-A2 and Yawning-A2 alerts for fatigue, yawning, and distraction.'}
                </p>
              </div>
            </div>
            <div className="mt-6">
              <TrendChart
                data={trendChartData}
                mode="line"
                height={300}
                ariaLabel={lang === 'th' ? 'แนวโน้มการแจ้งเตือนรายวัน' : 'Daily alert trend'}
              />
            </div>
          </section>

          {/* ── Alert remark highlights (KpiCards) ────────────────── */}
          <section className={dashboardSectionClass}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className={heading2}>{lang === 'th' ? 'สรุปตามประเภทแจ้งเตือน' : 'Alert remark highlights'}</h2>
                <p className={textSecondary}>
                  {lang === 'th'
                    ? 'การแจ้งเตือน Eye Closing-A2 และ Yawning-A2 ตามประเภท'
                    : 'Eye Closing-A2 and Yawning-A2 alerts by remark.'}
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <KpiCard
                label={lang === 'th' ? 'ง่วงนอน' : 'Fatigue'}
                value={stats.remarks.fatigue.toLocaleString()}
                subtitle={lang === 'th' ? 'การแจ้งเตือน' : 'Alerts'}
              />
              <KpiCard
                label={lang === 'th' ? 'หาว' : 'Yawning'}
                value={stats.remarks.yawning.toLocaleString()}
                subtitle={lang === 'th' ? 'การแจ้งเตือน' : 'Alerts'}
              />
              <KpiCard
                label={lang === 'th' ? 'ไม่สนใจ' : 'Distraction'}
                value={stats.remarks.distraction.toLocaleString()}
                subtitle={lang === 'th' ? 'การแจ้งเตือน' : 'Alerts'}
              />
            </div>
          </section>

          {/* ── Alerts table (DataTable) ──────────────────────────── */}
          <section className={dashboardSectionClass}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className={heading2}>
                  {lang === 'th' ? 'การแจ้งเตือนตามรถและวันที่' : 'Alerts by vehicle and date'}
                </h2>
                <p className={textSecondary}>
                  {lang === 'th'
                    ? 'จำนวนการแจ้งเตือนรายวันแยกตามง่วงนอน หาว และไม่สนใจ'
                    : 'Daily alert counts for fatigue, yawning, and distraction.'}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <DataTable
                columns={tableColumns}
                data={tableRows}
                defaultSort={{ key: 'sortDate', direction: 'desc' }}
                ariaLabel={lang === 'th' ? 'ตารางการแจ้งเตือน' : 'Alert summary table'}
              />
            </div>
          </section>
        </>
      )}
    </DashboardShell>
  );
}

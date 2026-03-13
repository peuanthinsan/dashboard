'use client';

import { useEffect, useMemo, useState } from 'react';
import useGoogleSheet from './useGoogleSheet';
import { formatDateKeyGB } from './dateFormat';
import { loadStoredFilters, saveStoredFilters } from './filterStorage';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import LoadingState from './LoadingState';
import { getDashboardCopy, type DashboardLang } from 'app/dashboard/i18n-copy';
import {
  findValue,
  normalizeLabel,
  parseDate,
  toDayKey,
  toMonthKey,
  withDerivedRemark,
} from './dashboardDataUtils';
import TrendChart from 'app/ui/TrendChart';
import { DataTable, type Column } from 'app/ui/DataTable';
import KpiCard from 'app/ui/KpiCard';
import ExportButton from 'app/ui/ExportButton';
import { heading2, textSecondary } from 'app/ui/design-tokens';
import FilterBar from 'app/ui/FilterBar';
import InlineMonthPicker from 'app/ui/InlineMonthPicker';
import MultiSelect from 'app/ui/MultiSelect';

type DashboardProps = {
  dashboardId: string;
  dashboardName: string;
  sheetId: string;
  sheetGid: string;
  dashboardNotes?: string | null;
  organizationName?: string | null;
  lang?: DashboardLang;
};

type SimpleFilterState = {
  month: string;
  vehicleFilters: string[];
  driverFilters: string[];
  remarkFilters: string[];
};

const defaultFilters: SimpleFilterState = {
  month: '',
  vehicleFilters: [],
  driverFilters: [],
  remarkFilters: [],
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

  const [filters, setFilters] = useState<SimpleFilterState>(defaultFilters);
  const storageKey = useMemo(() => `${dashboardId}-v2`, [dashboardId]);

  // ── Load persisted filters ──────────────────────────────────────────────
  useEffect(() => {
    const stored = loadStoredFilters<SimpleFilterState>(storageKey);
    if (!stored) return;
    setFilters({
      month: typeof stored.month === 'string' ? stored.month : '',
      vehicleFilters: Array.isArray(stored.vehicleFilters)
        ? stored.vehicleFilters.filter((v) => typeof v === 'string')
        : [],
      driverFilters: Array.isArray(stored.driverFilters)
        ? stored.driverFilters.filter((v) => typeof v === 'string')
        : [],
      remarkFilters: Array.isArray(stored.remarkFilters)
        ? stored.remarkFilters.filter((v) => typeof v === 'string')
        : [],
    });
  }, [storageKey]);

  // ── Persist filters ─────────────────────────────────────────────────────
  useEffect(() => {
    saveStoredFilters(storageKey, filters);
  }, [storageKey, filters]);

  const resetFilters = () => setFilters(defaultFilters);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.month !== '' ||
      filters.vehicleFilters.length > 0 ||
      filters.driverFilters.length > 0 ||
      filters.remarkFilters.length > 0
    );
  }, [filters]);

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

  // ── Month-filtered alerts ───────────────────────────────────────────────
  const monthFilteredAlerts = useMemo(() => {
    if (!filters.month) return baseAlerts;
    return baseAlerts.filter((row) => {
      return row.parsedDate && toMonthKey(row.parsedDate) === filters.month;
    });
  }, [baseAlerts, filters.month]);

  // ── Compute options from month-filtered data ────────────────────────────
  const vehicleOptions = useMemo(() => {
    const vehicles = new Set<string>();
    monthFilteredAlerts.forEach((row) => {
      if (row.vehicle && row.vehicle !== '—') vehicles.add(row.vehicle);
    });
    return Array.from(vehicles).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [monthFilteredAlerts]);

  useEffect(() => {
    setFilters((current) => {
      const next = current.vehicleFilters.filter((v) => vehicleOptions.includes(v));
      if (next.length === current.vehicleFilters.length) return current;
      return { ...current, vehicleFilters: next };
    });
  }, [vehicleOptions]);

  const driverOptions = useMemo(() => {
    const drivers = new Set<string>();
    monthFilteredAlerts.forEach((row) => {
      if (row.driver && row.driver !== '—') drivers.add(row.driver);
    });
    return Array.from(drivers).sort((a, b) => a.localeCompare(b));
  }, [monthFilteredAlerts]);

  useEffect(() => {
    setFilters((current) => {
      const next = current.driverFilters.filter((d) => driverOptions.includes(d));
      if (next.length === current.driverFilters.length) return current;
      return { ...current, driverFilters: next };
    });
  }, [driverOptions]);

  const remarkOptions = useMemo(() => {
    const set = new Set<string>();
    monthFilteredAlerts.forEach((a) => {
      if (a.remarks && a.remarks !== '—') set.add(a.remarks);
    });
    return Array.from(set).sort();
  }, [monthFilteredAlerts]);

  useEffect(() => {
    setFilters((current) => {
      const next = current.remarkFilters.filter((r) => remarkOptions.includes(r));
      if (next.length === current.remarkFilters.length) return current;
      return { ...current, remarkFilters: next };
    });
  }, [remarkOptions]);

  // ── Fully filtered alerts ───────────────────────────────────────────────
  const filteredAlerts = useMemo(() => {
    let alerts = monthFilteredAlerts;
    if (filters.vehicleFilters.length > 0) {
      const activeVehicles = new Set(filters.vehicleFilters);
      alerts = alerts.filter((row) => activeVehicles.has(row.vehicle));
    }
    if (filters.driverFilters.length > 0) {
      const activeDrivers = new Set(filters.driverFilters);
      alerts = alerts.filter((row) => activeDrivers.has(row.driver));
    }
    if (filters.remarkFilters.length > 0) {
      const activeRemarks = new Set(filters.remarkFilters);
      alerts = alerts.filter((row) => activeRemarks.has(row.remarks));
    }
    return alerts;
  }, [monthFilteredAlerts, filters.vehicleFilters, filters.driverFilters, filters.remarkFilters]);

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
    if (!filters.month) return undefined;
    // Parse selected month into a date range
    const [yearStr, monthStr] = filters.month.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1-based
    if (isNaN(year) || isNaN(month)) return undefined;

    const currentFrom = new Date(year, month - 1, 1);
    const currentTo = new Date(year, month, 0, 23, 59, 59, 999); // last day of month

    // Prior period = previous month
    const priorFrom = new Date(year, month - 2, 1);
    const priorTo = new Date(year, month - 1, 0, 23, 59, 59, 999);

    const remarkSet = filters.remarkFilters.length > 0 ? new Set(filters.remarkFilters) : null;
    const vehicleSet = filters.vehicleFilters.length > 0 ? new Set(filters.vehicleFilters) : null;
    const driverSet = filters.driverFilters.length > 0 ? new Set(filters.driverFilters) : null;

    let priorCount = 0;
    baseAlerts.forEach((row) => {
      if (!row.parsedDate) return;
      if (remarkSet && !remarkSet.has(row.remarks)) return;
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
  }, [filters.month, filters.remarkFilters, filters.vehicleFilters, filters.driverFilters, baseAlerts, stats.total, lang]);

  // ── Active filter count for DashboardShell badge ───────────────────────
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.month) count += 1;
    count += filters.vehicleFilters.length;
    count += filters.driverFilters.length;
    count += filters.remarkFilters.length;
    return count;
  }, [filters.month, filters.vehicleFilters.length, filters.driverFilters.length, filters.remarkFilters.length]);

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
      render: (value) => <span className="text-red-500 dark:text-red-300">{String(value)}</span>,
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
            <InlineMonthPicker
              value={filters.month}
              onChange={(v) => setFilters((f) => ({ ...f, month: v as string }))}
              lang={lang}
            />
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
            <MultiSelect
              label={lang === 'th' ? 'ประเภท' : 'types'}
              options={remarkOptions}
              selected={filters.remarkFilters}
              onChange={(v) => setFilters((f) => ({ ...f, remarkFilters: v }))}
              lang={lang}
            />
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="ml-auto text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                {lang === 'th' ? 'รีเซ็ต' : 'Reset'}
              </button>
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

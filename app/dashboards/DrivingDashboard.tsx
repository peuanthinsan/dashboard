'use client';

import { useMemo, useState } from 'react';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import LoadingState from './LoadingState';
import useGoogleSheet from './useGoogleSheet';
import { findValue, normalizeLabel, parseDate, toDisplayString } from './dashboardDataUtils';
import { type DashboardLang } from 'app/dashboard/i18n-copy';
import KpiCard from 'app/ui/KpiCard';
import ExportButton from 'app/ui/ExportButton';
import EmptyState from 'app/ui/EmptyState';
import TrendChart from 'app/ui/TrendChart';
import { DataTable, type Column } from 'app/ui/DataTable';
import Sparkline from 'app/ui/Sparkline';
import TrendIndicator from 'app/ui/TrendIndicator';
import {
  heading2, textSecondary, inputBase, selectBase,
} from 'app/ui/design-tokens';

type DashboardProps = {
  dashboardId: string;
  dashboardName: string;
  sheetId: string;
  sheetGid: string;
  dashboardNotes?: string | null;
  organizationName?: string | null;
  lang?: DashboardLang;
};

type DrivingRow = { driver: string; date: Date | null; distanceKm: number; cntDrvDurationHours: number; fleet?: string };
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
  dashboardName, sheetId, sheetGid, dashboardNotes, organizationName, lang = 'en',
}: DashboardProps) {
  const { rows, loading, error, lastUpdated, refresh } = useGoogleSheet({ sheetId, gid: sheetGid });
  const [driverFilter, setDriverFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const normalizedOrganizationName = useMemo(() => (organizationName ? normalizeLabel(organizationName) : null), [organizationName]);

  const drivingRows = useMemo<DrivingRow[]>(() => rows.map((row) => ({
    driver: toDisplayString(findValue(row, ['Driver Name'])),
    date: parseDate(findValue(row, ['DateTime', 'Start Time', 'Date', 'Alert Date Time'])),
    distanceKm: parseNumber(findValue(row, ['Distance'])),
    cntDrvDurationHours: parseDurationHours(findValue(row, ['Cnt Drv duration', 'Cnt Drv Hr', 'DriveHrs duration'])),
    fleet: toDisplayString(findValue(row, ['Fleet'])),
  })).filter((row) => {
    if (!normalizedOrganizationName) return true;
    return normalizeLabel(row.fleet ?? '') === normalizedOrganizationName;
  }).map((row) => ({ driver: row.driver, date: row.date, distanceKm: row.distanceKm, cntDrvDurationHours: row.cntDrvDurationHours })), [rows, normalizedOrganizationName]);

  const driverOptions = useMemo(() => Array.from(new Set(drivingRows.map((r) => r.driver).filter((n) => n !== '—'))).sort(), [drivingRows]);

  const filteredRows = useMemo(() => {
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59`) : null;
    return drivingRows.filter((row) => {
      if (driverFilter && row.driver !== driverFilter) return false;
      if (start && (!row.date || row.date < start)) return false;
      if (end && (!row.date || row.date > end)) return false;
      return true;
    });
  }, [drivingRows, driverFilter, startDate, endDate]);

  // Active filter count for DashboardShell badge
  const activeFilterCount = useMemo(() => [driverFilter, startDate, endDate].filter(Boolean).length, [driverFilter, startDate, endDate]);

  // Date range string for ExportButton
  const dateRange = useMemo(() => {
    if (startDate && endDate) return `${startDate}_${endDate}`;
    if (startDate) return startDate;
    if (endDate) return endDate;
    return undefined;
  }, [startDate, endDate]);

  // All months in filtered data (sorted)
  const allMonthKeys = useMemo(() => {
    const keys = new Set<string>();
    filteredRows.forEach((row) => { if (row.date) keys.add(getMonthKey(row.date)); });
    return Array.from(keys).sort();
  }, [filteredRows]);

  const aggregates = useMemo<DriverAggregate[]>(() => {
    const totals = new Map<string, { driver: string; tripCount: number; totalDistanceKm: number; totalCntDrvDurationHours: number; monthlyMap: Map<string, number> }>();
    filteredRows.forEach((row) => {
      const c = totals.get(row.driver) ?? { driver: row.driver, tripCount: 0, totalDistanceKm: 0, totalCntDrvDurationHours: 0, monthlyMap: new Map() };
      c.tripCount += 1;
      c.totalDistanceKm += row.distanceKm;
      c.totalCntDrvDurationHours += row.cntDrvDurationHours;
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
      durFirst: first.reduce((s, r) => s + r.cntDrvDurationHours, 0),
      durSecond: second.reduce((s, r) => s + r.cntDrvDurationHours, 0),
    };
  }, [filteredRows]);

  const kpis = useMemo(() => {
    const totalTrips = filteredRows.length;
    const totalDistanceKm = filteredRows.reduce((s, r) => s + r.distanceKm, 0);
    const totalCntDrvDurationHours = filteredRows.reduce((s, r) => s + r.cntDrvDurationHours, 0);
    return {
      totalTrips,
      totalDistanceKm,
      totalCntDrvDurationHours,
      avgDistancePerTrip: totalTrips > 0 ? totalDistanceKm / totalTrips : 0,
    };
  }, [filteredRows]);

  const monthlyTrend = useMemo<MonthlyTrendPoint[]>(() => {
    const map = new Map<string, MonthlyTrendPoint>();
    filteredRows.forEach((row) => {
      if (!row.date) return;
      const mk = getMonthKey(row.date);
      const c = map.get(mk) ?? { monthKey: mk, monthLabel: getMonthLabel(mk), totalDistanceKm: 0, totalCntDrvDurationHours: 0, tripCount: 0 };
      c.totalDistanceKm += row.distanceKm; c.totalCntDrvDurationHours += row.cntDrvDurationHours; c.tripCount += 1;
      map.set(mk, c);
    });
    return Array.from(map.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey)).slice(-8);
  }, [filteredRows]);

  // Top 5 most active (by distance) and bottom 5 least active
  const top5 = useMemo(() => aggregates.slice(0, 5), [aggregates]);
  const bottom5 = useMemo(() => {
    const topDrivers = new Set(top5.map((r) => r.driver));
    return [...aggregates].reverse().filter((r) => !topDrivers.has(r.driver)).slice(0, 5);
  }, [aggregates, top5]);

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
      isStale={lastUpdated ? (Date.now() - lastUpdated.getTime()) > 5 * 60 * 1000 : false}
      activeFilterCount={activeFilterCount}
      actions={
        <ExportButton
          data={exportData}
          dashboardName={dashboardName}
          dateRange={dateRange}
          filename={`${dashboardName}-driving`}
        />
      }
    >

      {/* Filters */}
      <section className={dashboardSectionClass}>
        <h2 className={heading2}>{lang === 'th' ? 'ตัวกรอง' : 'Filters'}</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-zinc-500 dark:text-zinc-400">{lang === 'th' ? 'คนขับ' : 'Driver'}</span>
            <select value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)} className={selectBase}>
              <option value="">{lang === 'th' ? 'คนขับทั้งหมด' : 'All drivers'}</option>
              {driverOptions.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-500 dark:text-zinc-400">{lang === 'th' ? 'วันที่เริ่มต้น' : 'Start date'}</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputBase} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-500 dark:text-zinc-400">{lang === 'th' ? 'วันที่สิ้นสุด' : 'End date'}</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputBase} />
          </label>
        </div>
      </section>

      {/* KPI Row */}
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
              suffix={lang === 'th' ? 'vs ช่วงก่อน' : 'vs first half'}
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
              suffix={lang === 'th' ? 'vs ช่วงก่อน' : 'vs first half'}
            />
          )}
        </KpiCard>
        <KpiCard
          label={lang === 'th' ? 'ระยะเวลาขับขี่รวม' : 'Total duration'}
          value={formatHours(kpis.totalCntDrvDurationHours)}
        >
          {kpiTrend && (
            <TrendIndicator
              current={kpiTrend.durSecond}
              previous={kpiTrend.durFirst}
              invertColor
              suffix={lang === 'th' ? 'vs ช่วงก่อน' : 'vs first half'}
            />
          )}
        </KpiCard>
        <KpiCard
          label={lang === 'th' ? 'เฉลี่ยระยะทาง/ทริป' : 'Avg distance/trip'}
          value={formatDistance(kpis.avgDistancePerTrip)}
        />
      </div>

      {/* Monthly Trend — dual-axis TrendChart */}
      <section className={dashboardSectionClass}>
        <h2 className={heading2}>{lang === 'th' ? 'แนวโน้มรายเดือน' : 'Monthly trend'}</h2>
        <p className={`mt-1 ${textSecondary}`}>{lang === 'th' ? 'ระยะทาง (แท่ง) และจำนวนทริป (เส้น) — 8 เดือนล่าสุด' : 'Distance (bars) and trip count (line) — last 8 months of filtered trips.'}</p>
        {monthlyTrend.length === 0 ? (
          <div className="mt-4"><EmptyState title="No dated trip data" /></div>
        ) : (
          <TrendChart
            className="mt-4"
            mode="dual-axis"
            height={280}
            data={monthlyTrend.map((p) => ({
              label: p.monthLabel,
              values: {
                'Distance (km)': Math.round(p.totalDistanceKm * 10) / 10,
                'Trips': p.tripCount,
              },
            }))}
            ariaLabel={lang === 'th' ? 'แนวโน้มรายเดือน' : 'Monthly distance and trip count trend'}
          />
        )}
      </section>

      {/* Driver Activity — Top 5 + Bottom 5 */}
      <div className="grid gap-6 xl:grid-cols-2">
        <section className={dashboardSectionClass}>
          <h2 className={heading2}>{lang === 'th' ? '5 คนขับที่ขับมากที่สุด' : 'Top 5 most active drivers'}</h2>
          <p className={`mt-1 ${textSecondary}`}>{lang === 'th' ? 'จัดอันดับตามระยะทางรวม' : 'Ranked by total distance.'}</p>
          {top5.length === 0 ? <EmptyState title="No data available" /> : (
            <div className="mt-4 space-y-2">
              {top5.map((row, i) => (
                <div key={`top-${row.driver}`} className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{row.driver}</p>
                    <p className="text-xs text-zinc-400">{row.tripCount} trips · {formatDistance(row.totalDistanceKm)} · avg {formatHours(row.avgDurationPerTrip)}/trip</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-indigo-50 px-2.5 py-1 text-sm font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    {formatDistance(row.totalDistanceKm)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={dashboardSectionClass}>
          <h2 className={heading2}>{lang === 'th' ? '5 คนขับที่ขับน้อยที่สุด' : 'Bottom 5 least active drivers'}</h2>
          <p className={`mt-1 ${textSecondary}`}>{lang === 'th' ? 'คนขับที่มีระยะทางน้อยที่สุด' : 'Drivers with lowest total distance.'}</p>
          {bottom5.length === 0 ? <EmptyState title="No data available" /> : (
            <div className="mt-4 space-y-2">
              {bottom5.map((row, i) => (
                <div key={`bot-${row.driver}`} className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{row.driver}</p>
                    <p className="text-xs text-zinc-400">{row.tripCount} trips · {formatDistance(row.totalDistanceKm)} · avg {formatHours(row.avgDurationPerTrip)}/trip</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-zinc-100 px-2.5 py-1 text-sm font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {formatDistance(row.totalDistanceKm)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Driver Statistics Table with Sparklines */}
      <section className={dashboardSectionClass}>
        <h2 className={heading2}>{lang === 'th' ? 'ตารางสถิติคนขับ' : 'Driver statistics table'}</h2>
        <p className={`mt-1 ${textSecondary}`}>{lang === 'th' ? 'คลิกหัวคอลัมน์เพื่อเรียงลำดับ' : 'Click column headers to sort.'}</p>
        <div className="mt-4">
          <DataTable
            columns={tableColumns}
            data={aggregates}
            defaultSort={{ key: 'totalDistanceKm', direction: 'desc' }}
            ariaLabel={lang === 'th' ? 'ตารางสถิติคนขับ' : 'Driver statistics table'}
          />
        </div>
      </section>
    </DashboardShell>
  );
}

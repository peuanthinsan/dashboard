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
import InlineMonthPicker from 'app/ui/InlineMonthPicker';
import MultiSelect from 'app/ui/MultiSelect';
import FilterBar from 'app/ui/FilterBar';
import DonutChart from 'app/ui/DonutChart';
import AlertHeatmap from 'app/ui/AlertHeatmap';
import {
  heading2, textSecondary, cardSection, CHART_COLORS,
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

type DrivingRow = { driver: string; vehicle: string; date: Date | null; distanceKm: number; cntDrvDurationHours: number; restHours: number; fleet?: string };
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
  const [driverFilters, setDriverFilters] = useState<string[]>([]);
  const [vehicleFilters, setVehicleFilters] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');

  const normalizedOrganizationName = useMemo(() => (organizationName ? normalizeLabel(organizationName) : null), [organizationName]);

  const drivingRows = useMemo<DrivingRow[]>(() => rows.map((row) => ({
    driver: toDisplayString(findValue(row, ['Driver Name'])),
    vehicle: toDisplayString(findValue(row, ['Vehicle No', 'Vehicle No TH'])),
    date: parseDate(findValue(row, ['DateTime', 'Start Time', 'Date', 'Alert Date Time'])),
    distanceKm: parseNumber(findValue(row, ['Distance'])),
    cntDrvDurationHours: parseDurationHours(findValue(row, ['Cnt Drv duration', 'Cnt Drv Hr', 'DriveHrs duration'])),
    restHours: parseDurationHours(findValue(row, ['Rest Hr', 'RestHr', 'Rest Hour', 'Rest Hours', 'Rest duration', 'RestHrs duration'])),
    fleet: toDisplayString(findValue(row, ['Fleet'])),
  })).filter((row) => {
    if (!normalizedOrganizationName) return true;
    return normalizeLabel(row.fleet ?? '') === normalizedOrganizationName;
  }).map((row) => ({ driver: row.driver, vehicle: row.vehicle, date: row.date, distanceKm: row.distanceKm, cntDrvDurationHours: row.cntDrvDurationHours, restHours: row.restHours })), [rows, normalizedOrganizationName]);

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
      return true;
    });
  }, [drivingRows, driverFilters, vehicleFilters, selectedMonth]);

  // Active filter count for DashboardShell badge
  const activeFilterCount = useMemo(() => [driverFilters.length > 0, vehicleFilters.length > 0, selectedMonth].filter(Boolean).length, [driverFilters, vehicleFilters, selectedMonth]);

  // Date range string for ExportButton
  const dateRange = useMemo(() => selectedMonth || undefined, [selectedMonth]);

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

  // --- Additional KPIs ---
  const extraKpis = useMemo(() => {
    const uniqueDrivers = new Set(filteredRows.map((r) => r.driver).filter((d) => d !== '—')).size;
    const uniqueVehicles = new Set(filteredRows.map((r) => r.vehicle).filter((v) => v !== '—')).size;
    const longestTrip = filteredRows.reduce((mx, r) => Math.max(mx, r.distanceKm), 0);
    const totalDur = filteredRows.reduce((s, r) => s + r.cntDrvDurationHours, 0);
    const totalDist = filteredRows.reduce((s, r) => s + r.distanceKm, 0);
    const avgSpeed = totalDur > 0 ? totalDist / totalDur : 0;
    return { uniqueDrivers, uniqueVehicles, longestTrip, avgSpeed };
  }, [filteredRows]);

  // --- Vehicle aggregates ---
  type VehicleAggregate = { vehicle: string; tripCount: number; totalDistanceKm: number; totalCntDrvDurationHours: number; driverCount: number };
  const vehicleAggregates = useMemo<VehicleAggregate[]>(() => {
    const map = new Map<string, { vehicle: string; tripCount: number; totalDistanceKm: number; totalCntDrvDurationHours: number; drivers: Set<string> }>();
    filteredRows.forEach((row) => {
      if (row.vehicle === '—') return;
      const c = map.get(row.vehicle) ?? { vehicle: row.vehicle, tripCount: 0, totalDistanceKm: 0, totalCntDrvDurationHours: 0, drivers: new Set<string>() };
      c.tripCount += 1;
      c.totalDistanceKm += row.distanceKm;
      c.totalCntDrvDurationHours += row.cntDrvDurationHours;
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

  // --- Violation reports ---
  type ViolationRow = { driver: string; vehicle: string; date: string; cntDrvHours: number; restHours: number; type: 'cnt_drv' | 'rest_hr' };
  const violations = useMemo<ViolationRow[]>(() => {
    const result: ViolationRow[] = [];
    filteredRows.forEach((row) => {
      const dateStr = row.date ? row.date.toLocaleDateString('en-GB') : '—';
      if (row.cntDrvDurationHours > 9) {
        result.push({ driver: row.driver, vehicle: row.vehicle, date: dateStr, cntDrvHours: row.cntDrvDurationHours, restHours: row.restHours, type: 'cnt_drv' });
      }
      if (row.restHours > 0 && row.restHours < 11) {
        result.push({ driver: row.driver, vehicle: row.vehicle, date: dateStr, cntDrvHours: row.cntDrvDurationHours, restHours: row.restHours, type: 'rest_hr' });
      }
    });
    return result.sort((a, b) => {
      if (a.type === b.type) return a.driver.localeCompare(b.driver);
      return a.type === 'cnt_drv' ? -1 : 1;
    });
  }, [filteredRows]);

  const cntDrvViolations = useMemo(() => violations.filter((v) => v.type === 'cnt_drv'), [violations]);
  const restHrViolations = useMemo(() => violations.filter((v) => v.type === 'rest_hr'), [violations]);

  const violationTableColumns = useMemo<Column<ViolationRow>[]>(() => [
    { key: 'driver', label: lang === 'th' ? 'คนขับ' : 'Driver', sortable: true, stickyLeft: true },
    { key: 'vehicle', label: lang === 'th' ? 'ยานพาหนะ' : 'Vehicle', sortable: true },
    { key: 'date', label: lang === 'th' ? 'วันที่' : 'Date', sortable: true },
    { key: 'cntDrvHours', label: lang === 'th' ? 'ขับต่อเนื่อง' : 'Cnt Drv', sortable: true, render: (v) => {
      const hours = Number(v);
      return <span className={hours > 9 ? 'font-semibold text-red-600 dark:text-red-400' : ''}>{formatHours(hours)}</span>;
    }},
    { key: 'restHours', label: lang === 'th' ? 'ชั่วโมงพัก' : 'Rest Hr', sortable: true, render: (v) => {
      const hours = Number(v);
      if (hours === 0) return <span className="text-zinc-400">—</span>;
      return <span className={hours < 11 ? 'font-semibold text-red-600 dark:text-red-400' : ''}>{formatHours(hours)}</span>;
    }},
    { key: 'type', label: lang === 'th' ? 'ประเภท' : 'Violation', sortable: true, render: (v) => {
      return v === 'cnt_drv'
        ? <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950 dark:text-red-400">Cnt Drv &gt; 9h</span>
        : <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">Rest &lt; 11h</span>;
    }},
  ], [lang]);

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
      <FilterBar>
        <InlineMonthPicker
          value={selectedMonth}
          onChange={(v) => setSelectedMonth(v as string)}
          lang={lang}
        />
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
        {(selectedMonth || driverFilters.length > 0 || vehicleFilters.length > 0) && (
          <button
            type="button"
            onClick={() => { setSelectedMonth(''); setDriverFilters([]); setVehicleFilters([]); }}
            className="ml-auto text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            {lang === 'th' ? 'รีเซ็ต' : 'Reset'}
          </button>
        )}
      </FilterBar>

      {/* KPI Row 1 — Primary */}
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

      {/* KPI Row 2 — Secondary */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={lang === 'th' ? 'คนขับ' : 'Unique drivers'}
          value={extraKpis.uniqueDrivers}
          accentColor={CHART_COLORS[4]}
        />
        <KpiCard
          label={lang === 'th' ? 'ยานพาหนะ' : 'Unique vehicles'}
          value={extraKpis.uniqueVehicles}
          accentColor={CHART_COLORS[5]}
        />
        <KpiCard
          label={lang === 'th' ? 'ทริปไกลสุด' : 'Longest trip'}
          value={formatDistance(extraKpis.longestTrip)}
          accentColor={CHART_COLORS[6]}
        />
        <KpiCard
          label={lang === 'th' ? 'ความเร็วเฉลี่ย' : 'Avg speed'}
          value={`${extraKpis.avgSpeed.toFixed(1)} km/h`}
          accentColor={CHART_COLORS[7]}
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

      {/* Donut Charts — Trip distribution & Distance by vehicle */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className={dashboardSectionClass}>
          <h2 className={heading2}>{lang === 'th' ? 'สัดส่วนทริปตามคนขับ' : 'Trip distribution by driver'}</h2>
          <p className={`mt-1 ${textSecondary}`}>{lang === 'th' ? 'คนขับที่มีทริปมากที่สุด' : 'Drivers with the most trips.'}</p>
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
          <p className={`mt-1 ${textSecondary}`}>{lang === 'th' ? 'ยานพาหนะที่ขับไกลที่สุด' : 'Vehicles with the most distance.'}</p>
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

      {/* Activity Heatmap — When drivers are most active */}
      <section className={dashboardSectionClass}>
        <h2 className={heading2}>{lang === 'th' ? 'ช่วงเวลาการขับขี่' : 'Driving activity heatmap'}</h2>
        <p className={`mt-1 ${textSecondary}`}>{lang === 'th' ? 'ความถี่ของทริปตามวันและเวลา' : 'Trip frequency by day of week and hour.'}</p>
        <div className="mt-4">
          {heatmapDates.length === 0 ? (
            <EmptyState title={lang === 'th' ? 'ไม่มีข้อมูลวันที่' : 'No dated trip data'} />
          ) : (
            <AlertHeatmap dates={heatmapDates} />
          )}
        </div>
      </section>

      {/* Violation Reports — Cnt Drv > 9h and Rest < 11h */}
      {violations.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Cnt Drv > 9 hrs */}
          <section className={dashboardSectionClass}>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700 dark:bg-red-900 dark:text-red-300">{cntDrvViolations.length}</span>
              <h2 className={heading2}>{lang === 'th' ? 'ขับต่อเนื่อง > 9 ชม.' : 'Cnt Drv > 9 hrs'}</h2>
            </div>
            <p className={`mt-1 ${textSecondary}`}>{lang === 'th' ? 'ทริปที่มีการขับต่อเนื่องเกิน 9 ชั่วโมง' : 'Trips where continuous driving exceeded 9 hours.'}</p>
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
                  ariaLabel={lang === 'th' ? 'รายงานขับต่อเนื่องเกิน 9 ชม.' : 'Continuous driving over 9 hours report'}
                />
              )}
            </div>
          </section>

          {/* Rest < 11 hrs */}
          <section className={dashboardSectionClass}>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700 dark:bg-amber-900 dark:text-amber-300">{restHrViolations.length}</span>
              <h2 className={heading2}>{lang === 'th' ? 'พักผ่อน < 11 ชม.' : 'Rest hrs < 11 hrs'}</h2>
            </div>
            <p className={`mt-1 ${textSecondary}`}>{lang === 'th' ? 'ทริปที่มีชั่วโมงพักผ่อนน้อยกว่า 11 ชั่วโมง' : 'Trips where rest hours were under 11 hours.'}</p>
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
                  ariaLabel={lang === 'th' ? 'รายงานพักผ่อนน้อยกว่า 11 ชม.' : 'Rest hours under 11 hours report'}
                />
              )}
            </div>
          </section>
        </div>
      )}

      {/* Combined Violations Summary KPI */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label={lang === 'th' ? 'ฝ่าฝืนทั้งหมด' : 'Total violations'}
          value={violations.length}
          accentColor={violations.length > 0 ? '#ef4444' : '#10b981'}
        />
        <KpiCard
          label={lang === 'th' ? 'ขับต่อเนื่อง > 9 ชม.' : 'Cnt Drv > 9 hrs'}
          value={cntDrvViolations.length}
          accentColor={cntDrvViolations.length > 0 ? '#ef4444' : '#10b981'}
        />
        <KpiCard
          label={lang === 'th' ? 'พักผ่อน < 11 ชม.' : 'Rest < 11 hrs'}
          value={restHrViolations.length}
          accentColor={restHrViolations.length > 0 ? '#f59e0b' : '#10b981'}
        />
      </div>

      {/* Driver Activity — Top 5 + Bottom 5 (hidden when only 1 driver in results) */}
      {aggregates.length > 1 && <div className="grid gap-6 xl:grid-cols-2">
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
      </div>}

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
      {/* Vehicle Statistics Table */}
      {vehicleAggregates.length > 0 && (
        <section className={dashboardSectionClass}>
          <h2 className={heading2}>{lang === 'th' ? 'ตารางสถิติยานพาหนะ' : 'Vehicle statistics table'}</h2>
          <p className={`mt-1 ${textSecondary}`}>{lang === 'th' ? 'สรุปข้อมูลการขับขี่แยกตามยานพาหนะ' : 'Driving summary broken down by vehicle.'}</p>
          <div className="mt-4">
            <DataTable
              columns={vehicleTableColumns}
              data={vehicleAggregates}
              defaultSort={{ key: 'totalDistanceKm', direction: 'desc' }}
              ariaLabel={lang === 'th' ? 'ตารางสถิติยานพาหนะ' : 'Vehicle statistics table'}
            />
          </div>
        </section>
      )}
    </DashboardShell>
  );
}

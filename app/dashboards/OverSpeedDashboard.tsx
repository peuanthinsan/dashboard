'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import LoadingState from './LoadingState';
import useGoogleSheet from './useGoogleSheet';
import { loadStoredFilters, saveStoredFilters } from './filterStorage';
import { findValue, normalizeLabel, parseDate, previousMonthKey, resolveScopeFleetNames, scopeFleetSet, toDayKey, toDisplayString, toMonthKey } from './dashboardDataUtils';
import { type DashboardLang } from 'app/dashboard/i18n-copy';
import ExportButton from 'app/ui/ExportButton';
import EmptyState from 'app/ui/EmptyState';
import HorizontalBarChart from 'app/ui/HorizontalBarChart';
import AlertHeatmap from 'app/ui/AlertHeatmap';
import { DataTable, type Column } from 'app/ui/DataTable';
import InlineMonthPicker from 'app/ui/InlineMonthPicker';
import InlineDayPicker from 'app/ui/InlineDayPicker';
import MultiSelect from 'app/ui/MultiSelect';
import FilterBar from 'app/ui/FilterBar';
import { heading2, textSecondary, CHART_COLORS } from 'app/ui/design-tokens';
import { calendarDateToIsoLocal } from 'app/ui/exportCsvFormat';

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
  isAdmin?: boolean;
};

/** One row from the overspeed sheet */
type OverSpeedRow = {
  sourceRow: Record<string, unknown>;
  driver: string;
  vehicle: string;
  fleet: string;
  date: Date | null;
  speed: number;
  overSpeed: number;
  gt1min: number;
  lt1min: number;
  location: string;
  monthKey: string | null;
  monthLabel: string;
};

/** Aggregated per-vehicle summary */
type VehicleSummary = {
  vehicle: string;
  driver: string;
  gt1min: number;
  lt1min: number;
  maxSpeed: number;
  totalEvents: number;
};

/** Aggregated per-driver summary */
type DriverSummary = {
  driver: string;
  gt1min: number;
  lt1min: number;
  maxSpeed: number;
  totalEvents: number;
  vehicleCount: number;
};

const parseNumber = (value: unknown) => {
  if (value == null || value === '') return 0;
  const cleaned = String(value).replace(/,/g, '').trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatSpeed = (kmh: number) => `${kmh.toFixed(0)} km/h`;

const getMonthKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
export default function OverSpeedDashboard({
  dashboardId,
  dashboardName,
  sheetId,
  sheetGid,
  dashboardNotes,
  organizationName,
  organizationNames,
  lang = 'en',
  isAdmin = false,
}: DashboardProps) {
  const { rows, columns: sheetColumns, loading, error, lastUpdated, refresh } = useGoogleSheet({
    sheetId,
    gid: sheetGid,
  });
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const [monthFilters, setMonthFilters] = useState<string[]>([]);
  const [dayFilters, setDayFilters] = useState<string[]>([]);
  const [driverFilters, setDriverFilters] = useState<string[]>([]);
  const [vehicleFilters, setVehicleFilters] = useState<string[]>([]);
  const scopeNames = useMemo(
    () => resolveScopeFleetNames(organizationName, organizationNames),
    [organizationName, organizationNames],
  );
  const scopeSet = useMemo(
    () => scopeFleetSet(organizationName, organizationNames),
    [organizationName, organizationNames],
  );
  const [fleetFilters, setFleetFilters] = useState<string[]>(() => scopeNames);
  const storageKey = useMemo(() => `${dashboardId}-overspeed`, [dashboardId]);
  const didSetDefaultMonth = useRef(false);
  const defaultMonthKey = useMemo(() => previousMonthKey(), []);

  // ── Persist / restore filters ──
  useEffect(() => {
    const stored = loadStoredFilters<{
      monthFilters?: string[];
      dayFilters?: string[];
      driverFilters?: string[];
      vehicleFilters?: string[];
      fleetFilters?: string[];
    }>(storageKey);
    if (!stored) return;
    didSetDefaultMonth.current = true;
    const frame = requestAnimationFrame(() => {
      if (Array.isArray(stored.monthFilters)) setMonthFilters(stored.monthFilters.filter((v) => typeof v === 'string'));
      if (Array.isArray(stored.dayFilters)) setDayFilters(stored.dayFilters.filter((v) => typeof v === 'string'));
      if (Array.isArray(stored.driverFilters)) setDriverFilters(stored.driverFilters.filter((v) => typeof v === 'string'));
      if (Array.isArray(stored.vehicleFilters)) setVehicleFilters(stored.vehicleFilters.filter((v) => typeof v === 'string'));
      if (Array.isArray(stored.fleetFilters) && stored.fleetFilters.length > 0) setFleetFilters(stored.fleetFilters.filter((v) => typeof v === 'string'));
      else setFleetFilters(scopeNames);
    });
    return () => cancelAnimationFrame(frame);
  }, [storageKey]);

  useEffect(() => {
    saveStoredFilters(storageKey, { monthFilters, dayFilters, driverFilters, vehicleFilters, fleetFilters });
  }, [storageKey, monthFilters, dayFilters, driverFilters, vehicleFilters, fleetFilters]);

  const resetFilters = () => {
    setMonthFilters([]);
    setDayFilters([]);
    setDriverFilters([]);
    setVehicleFilters([]);
    setFleetFilters(scopeNames);
  };

  // ── Parse rows ──
  const overSpeedRows = useMemo<OverSpeedRow[]>(() => {
    // First pass: parse all rows
    const parsed = rows.map((row) => {
      const driver = toDisplayString(findValue(row, ['Driver Name']));
      const vehicle = toDisplayString(findValue(row, ['Vehicle No', 'Vehicle No TH', 'Plate']));
      const fleet = toDisplayString(findValue(row, ['Fleet', 'User']));
      const dateValue = findValue(row, ['Track Time', 'Alert Date Time', 'DateTime', 'Date', 'Start Time']);
      const parsedDate = parseDate(dateValue);
      const speed = parseNumber(findValue(row, ['Speed', 'Max Speed', 'Spd']));
      const overSpeed = parseNumber(findValue(row, ['Over Speed', 'OverSpeed', 'Over Spd']));
      const rawGt1 = findValue(row, ['>1minutes', '>1min', '>1 min', '>1 minutes', 'GT1min', 'Over 1 min', '1 Minutes', '1 Minute', '1 Min', '1minutes', '1minute']);
      const rawLt1 = findValue(row, ['Less than 1minutes', 'Less than 1min', '<1minutes', '<1min', '<1 min', 'LT1min', 'Under 1 min']);
      const location = toDisplayString(findValue(row, ['Location', 'Address', 'Landmark']));
      const monthKey = parsedDate ? getMonthKey(parsedDate) : null;
      const monthLabel = parsedDate
        ? parsedDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' })
        : 'Unknown';
      return { sourceRow: row, driver, vehicle, fleet, date: parsedDate, speed, overSpeed, rawGt1, rawLt1, location, monthKey, monthLabel };
    }).filter((r) => scopeSet.size === 0 || scopeSet.has(normalizeLabel(r.fleet)));

    // Check if any row has explicit duration columns
    const hasDurationColumns = parsed.some((r) => r.rawGt1 != null || r.rawLt1 != null);

    if (hasDurationColumns) {
      // Use explicit columns
      return parsed.map((r) => {
        const gt1minVal = parseNumber(r.rawGt1);
        const lt1min = r.rawLt1 != null ? parseNumber(r.rawLt1) : Math.max(0, r.overSpeed - gt1minVal);
        return { sourceRow: r.sourceRow, driver: r.driver, vehicle: r.vehicle, fleet: r.fleet, date: r.date, speed: r.speed, overSpeed: r.overSpeed, gt1min: gt1minVal, lt1min, location: r.location, monthKey: r.monthKey, monthLabel: r.monthLabel };
      });
    }

    // No duration columns — classify each event using the OverSpeed column:
    // OverSpeed = 0  → sustained overspeed (>1 min)
    // OverSpeed > 0  → brief overspeed (<1 min)
    return parsed.map((r) => ({
      sourceRow: r.sourceRow, driver: r.driver, vehicle: r.vehicle, fleet: r.fleet, date: r.date,
      speed: r.speed, overSpeed: r.overSpeed,
      gt1min: r.overSpeed === 0 ? 1 : 0,
      lt1min: r.overSpeed === 0 ? 0 : 1,
      location: r.location, monthKey: r.monthKey, monthLabel: r.monthLabel,
    }));
  }, [rows, scopeSet]);

  // ── Filter options ──
  const driverOptions = useMemo(
    () => Array.from(new Set(overSpeedRows.map((r) => r.driver).filter((n) => n !== '—'))).sort(),
    [overSpeedRows],
  );
  const vehicleOptions = useMemo(
    () => Array.from(new Set(overSpeedRows.map((r) => r.vehicle).filter((n) => n !== '—'))).sort(),
    [overSpeedRows],
  );
  const fleetOptions = useMemo(() => {
    const unique = new Set<string>();
    overSpeedRows.forEach((row) => { if (row.fleet && row.fleet !== '—') unique.add(row.fleet); });
    return Array.from(unique).sort();
  }, [overSpeedRows]);
  const monthOptions = useMemo(() => {
    const map = new Map<string, string>();
    overSpeedRows.forEach((row) => { if (row.monthKey) map.set(row.monthKey, row.monthLabel); });
    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [overSpeedRows]);

  // ── Default to current month ──
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (didSetDefaultMonth.current) return;
      if (monthOptions.length === 0) return;
      if (monthFilters.length > 0) {
        didSetDefaultMonth.current = true;
        return;
      }
      didSetDefaultMonth.current = true;
      if (monthOptions.some((o) => o.key === defaultMonthKey)) setMonthFilters([defaultMonthKey]);
    });
    return () => cancelAnimationFrame(frame);
  }, [defaultMonthKey, monthFilters, monthOptions]);

  // ── Apply filters ──
  const filteredRows = useMemo(() => {
    return overSpeedRows.filter((row) => {
      if (monthFilters.length > 0 && (!row.monthKey || !monthFilters.includes(row.monthKey))) return false;
      if (dayFilters.length > 0 && row.date && !dayFilters.includes(toDayKey(row.date))) return false;
      if (driverFilters.length > 0 && !driverFilters.includes(row.driver)) return false;
      if (vehicleFilters.length > 0 && !vehicleFilters.includes(row.vehicle)) return false;
      if (fleetFilters.length > 0 && !fleetFilters.includes(row.fleet)) return false;
      return true;
    });
  }, [overSpeedRows, monthFilters, dayFilters, driverFilters, vehicleFilters, fleetFilters]);

  const activeMonthKey = monthFilters.length === 1 ? monthFilters[0] : null;

  const activeFilterCount = useMemo(
    () => [monthFilters.length > 0, dayFilters.length > 0, driverFilters.length > 0, vehicleFilters.length > 0, fleetFilters.length > 0].filter(Boolean).length,
    [monthFilters, dayFilters, driverFilters, vehicleFilters, fleetFilters],
  );

  // ── Vehicle summary (matches screenshot table) ──
  const vehicleSummaries = useMemo<VehicleSummary[]>(() => {
    const map = new Map<string, { vehicle: string; drivers: Set<string>; gt1min: number; lt1min: number; maxSpeed: number }>();
    filteredRows.forEach((row) => {
      if (row.vehicle === '—') return;
      const c = map.get(row.vehicle) ?? { vehicle: row.vehicle, drivers: new Set<string>(), gt1min: 0, lt1min: 0, maxSpeed: 0 };
      if (row.driver !== '—') c.drivers.add(row.driver);
      c.gt1min += row.gt1min;
      c.lt1min += row.lt1min;
      if (row.speed > c.maxSpeed) c.maxSpeed = row.speed;
      map.set(row.vehicle, c);
    });
    return Array.from(map.values())
      .map((c) => ({
        vehicle: c.vehicle,
        driver: Array.from(c.drivers).join(', ') || '—',
        gt1min: c.gt1min,
        lt1min: c.lt1min,
        maxSpeed: c.maxSpeed,
        totalEvents: c.gt1min + c.lt1min,
      }))
      .sort((a, b) => b.totalEvents - a.totalEvents);
  }, [filteredRows]);

  // ── Driver summary ──
  const driverSummaries = useMemo<DriverSummary[]>(() => {
    const map = new Map<string, { driver: string; vehicles: Set<string>; gt1min: number; lt1min: number; maxSpeed: number }>();
    filteredRows.forEach((row) => {
      if (row.driver === '—') return;
      const c = map.get(row.driver) ?? { driver: row.driver, vehicles: new Set<string>(), gt1min: 0, lt1min: 0, maxSpeed: 0 };
      if (row.vehicle !== '—') c.vehicles.add(row.vehicle);
      c.gt1min += row.gt1min;
      c.lt1min += row.lt1min;
      if (row.speed > c.maxSpeed) c.maxSpeed = row.speed;
      map.set(row.driver, c);
    });
    return Array.from(map.values())
      .map((c) => ({
        driver: c.driver,
        gt1min: c.gt1min,
        lt1min: c.lt1min,
        maxSpeed: c.maxSpeed,
        totalEvents: c.gt1min + c.lt1min,
        vehicleCount: c.vehicles.size,
      }))
      .sort((a, b) => b.totalEvents - a.totalEvents);
  }, [filteredRows]);

  // ── Bar chart: top vehicles by record count ──
  const topVehiclesBar = useMemo(() =>
    [...vehicleSummaries].sort((a, b) => b.totalEvents - a.totalEvents).slice(0, 10).map((v) => ({ label: v.vehicle, value: v.totalEvents })),
    [vehicleSummaries],
  );

  // ── Bar chart: top drivers by record count ──
  const topDriversBar = useMemo(() =>
    [...driverSummaries].sort((a, b) => b.totalEvents - a.totalEvents).slice(0, 10).map((d) => ({ label: d.driver, value: d.totalEvents })),
    [driverSummaries],
  );

  // ── Heatmap ──
  const heatmapDates = useMemo(
    () => filteredRows.filter((r) => r.date).map((r) => r.date!),
    [filteredRows],
  );

  // ── Table columns: vehicle summary ──
  const vehicleTableColumns = useMemo<Column<VehicleSummary>[]>(() => [
    { key: 'vehicle', label: lang === 'th' ? 'ยานพาหนะ' : 'Vehicle No', sortable: true, stickyLeft: true },
    { key: 'driver', label: lang === 'th' ? 'คนขับ' : 'Driver Name', sortable: true },
    {
      key: 'gt1min',
      label: '> 1 min',
      sortable: true,
      render: (v) => {
        const n = Number(v);
        return n > 0 ? <span className="font-semibold text-red-600 dark:text-red-400">{n}</span> : <span className="text-zinc-400">0</span>;
      },
    },
    {
      key: 'lt1min',
      label: '< 1 min',
      sortable: true,
      render: (v) => {
        const n = Number(v);
        return n > 0 ? <span className="font-medium text-amber-600 dark:text-amber-400">{n}</span> : <span className="text-zinc-400">0</span>;
      },
    },
    {
      key: 'maxSpeed',
      label: lang === 'th' ? 'ความเร็วสูงสุด' : 'Max Speed',
      sortable: true,
      render: (v) => {
        const spd = Number(v);
        return spd > 0 ? (
          <span className={spd > 120 ? 'font-semibold text-red-600 dark:text-red-400' : ''}>{formatSpeed(spd)}</span>
        ) : <span className="text-zinc-400">—</span>;
      },
    },
    { key: 'totalEvents', label: lang === 'th' ? 'รวม' : 'Total', sortable: true },
  ], [lang]);

  // ── Table columns: driver summary ──
  const driverTableColumns = useMemo<Column<DriverSummary>[]>(() => [
    { key: 'driver', label: lang === 'th' ? 'คนขับ' : 'Driver Name', sortable: true, stickyLeft: true },
    {
      key: 'gt1min',
      label: '> 1 min',
      sortable: true,
      render: (v) => {
        const n = Number(v);
        return n > 0 ? <span className="font-semibold text-red-600 dark:text-red-400">{n}</span> : <span className="text-zinc-400">0</span>;
      },
    },
    {
      key: 'lt1min',
      label: '< 1 min',
      sortable: true,
      render: (v) => {
        const n = Number(v);
        return n > 0 ? <span className="font-medium text-amber-600 dark:text-amber-400">{n}</span> : <span className="text-zinc-400">0</span>;
      },
    },
    {
      key: 'maxSpeed',
      label: lang === 'th' ? 'ความเร็วสูงสุด' : 'Max Speed',
      sortable: true,
      render: (v) => {
        const spd = Number(v);
        return spd > 0 ? (
          <span className={spd > 120 ? 'font-semibold text-red-600 dark:text-red-400' : ''}>{formatSpeed(spd)}</span>
        ) : <span className="text-zinc-400">—</span>;
      },
    },
    { key: 'totalEvents', label: lang === 'th' ? 'รวม' : 'Total', sortable: true },
    { key: 'vehicleCount', label: lang === 'th' ? 'ยานพาหนะ' : 'Vehicles', sortable: true },
  ], [lang]);

  // ── Table columns: raw event detail ──
  const eventTableColumns = useMemo<Column<OverSpeedRow>[]>(() => [
    { key: 'vehicle', label: lang === 'th' ? 'ยานพาหนะ' : 'Vehicle No', sortable: true, stickyLeft: true },
    { key: 'driver', label: lang === 'th' ? 'คนขับ' : 'Driver Name', sortable: true },
    {
      key: 'date',
      label: lang === 'th' ? 'วัน/เวลา' : 'Track Time',
      sortable: true,
      render: (_v, row) => row.date ? row.date.toLocaleDateString('en-GB', { timeZone: 'UTC' }) + ' ' + row.date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : '—',
    },
    {
      key: 'gt1min',
      label: '> 1 min',
      sortable: true,
      render: (v) => {
        const n = Number(v);
        return n > 0 ? <span className="font-semibold text-red-600 dark:text-red-400">{n}</span> : <span className="text-zinc-400">0</span>;
      },
    },
    {
      key: 'lt1min',
      label: '< 1 min',
      sortable: true,
      render: (v) => {
        const n = Number(v);
        return n > 0 ? <span className="font-medium text-amber-600 dark:text-amber-400">{n}</span> : <span className="text-zinc-400">0</span>;
      },
    },
    {
      key: 'speed',
      label: lang === 'th' ? 'ความเร็วสูงสุด' : 'Max Speed',
      sortable: true,
      render: (v) => {
        const spd = Number(v);
        return spd > 0 ? (
          <span className={spd > 120 ? 'font-semibold text-red-600 dark:text-red-400' : ''}>{formatSpeed(spd)}</span>
        ) : <span className="text-zinc-400">—</span>;
      },
    },
    { key: 'fleet', label: lang === 'th' ? 'กลุ่มรถ' : 'Fleet', sortable: true },
  ], [lang]);

  // ── Export ──
  const exportData = useMemo(() =>
    filteredRows.map((r) => ({
      'Vehicle No': r.vehicle,
      'Driver Name': r.driver,
      'Track Time': r.date ? calendarDateToIsoLocal(r.date) : '',
      '> 1 min': r.gt1min,
      '< 1 min': r.lt1min,
      'Max Speed': r.speed,
      'Over Speed': r.overSpeed,
      Fleet: r.fleet,
      Location: r.location,
    })),
    [filteredRows],
  );

  const exportColumns = useMemo(
    () =>
      lang === 'th'
        ? [
            { key: 'Vehicle No', label: 'ยานพาหนะ' },
            { key: 'Driver Name', label: 'คนขับ' },
            { key: 'Track Time', label: 'วัน/เวลา' },
            { key: '> 1 min', label: '> 1 นาที' },
            { key: '< 1 min', label: '< 1 นาที' },
            { key: 'Max Speed', label: 'ความเร็วสูงสุด' },
            { key: 'Over Speed', label: 'Over Speed' },
            { key: 'Fleet', label: 'กลุ่มรถ' },
            { key: 'Location', label: 'สถานที่' },
          ]
        : [
            { key: 'Vehicle No', label: 'Vehicle No' },
            { key: 'Driver Name', label: 'Driver Name' },
            { key: 'Track Time', label: 'Track Time' },
            { key: '> 1 min', label: '> 1 min' },
            { key: '< 1 min', label: '< 1 min' },
            { key: 'Max Speed', label: 'Max Speed' },
            { key: 'Over Speed', label: 'Over Speed' },
            { key: 'Fleet', label: 'Fleet' },
            { key: 'Location', label: 'Location' },
          ],
    [lang],
  );

  if (loading) {
    return (
      <DashboardShell title={dashboardName} subtitle={lang === 'th' ? 'แดชบอร์ดความเร็วเกินกำหนด' : 'OverSpeed dashboard'} lang={lang} lastUpdated={lastUpdated} notes={dashboardNotes}>
        <LoadingState
          lang={lang}
          message={lang === 'th' ? 'กำลังโหลด…' : 'Loading overspeed dashboard'}
          detail={lang === 'th' ? 'กำลังดึงข้อมูลความเร็วเกินกำหนด' : 'Fetching overspeed data.'}
        />
      </DashboardShell>
    );
  }

  if (error) {
    return (
      <DashboardShell title={dashboardName} subtitle={lang === 'th' ? 'แดชบอร์ดความเร็วเกินกำหนด' : 'OverSpeed dashboard'} lang={lang} lastUpdated={lastUpdated} notes={dashboardNotes}>
        <LoadingState lang={lang} error={error} onRetry={refresh} />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title={dashboardName}
      subtitle={lang === 'th' ? 'แดชบอร์ดความเร็วเกินกำหนด' : 'OverSpeed dashboard'}
      lang={lang}
      lastUpdated={lastUpdated}
      notes={dashboardNotes}
      isStale={lastUpdated ? nowTick - lastUpdated.getTime() > 5 * 60 * 1000 : false}
      activeFilterCount={activeFilterCount}
      dashboardId={dashboardId}
      isAdmin={isAdmin}
      actions={
        <ExportButton
          data={exportData}
          fullSheetExport={{ rows, filteredRows: filteredRows.map((r) => r.sourceRow), columns: sheetColumns }}
          dashboardName={`${dashboardName}-overspeed`}
          dateRange={activeMonthKey ?? undefined}
          settingsStorageKey={`overspeed-${dashboardId}`}
          lang={lang}
          columns={exportColumns}
          label={lang === 'th' ? 'ส่งออก CSV' : 'Export CSV'}
        />
      }
    >
      <div className="flex flex-col gap-6">

        {/* ① Filters */}
        <FilterBar>
          <InlineMonthPicker
            value={monthFilters}
            onChange={(v) => {
              setMonthFilters(v as string[]);
              if (Array.isArray(v) && v.length !== 1) setDayFilters([]);
            }}
            multi
            lang={lang}
          />
          {monthFilters.length === 1 && (
            <InlineDayPicker
              monthKey={monthFilters[0]}
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
          {fleetOptions.length > 1 && (
            <MultiSelect
              label={lang === 'th' ? 'กลุ่มรถ' : 'fleets'}
              options={fleetOptions}
              selected={fleetFilters}
              onChange={setFleetFilters}
              lang={lang}
            />
          )}
          {activeFilterCount > 0 && (
            <button type="button" onClick={resetFilters} className="ml-auto text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
              {lang === 'th' ? 'รีเซ็ต' : 'Reset'}
            </button>
          )}
        </FilterBar>

        {/* ═══ OverSpeed Overview ═══ */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-red-400/50 to-transparent dark:via-red-600/30" />
          <svg width="6" height="6" viewBox="0 0 6 6" className="shrink-0 text-red-400/50" aria-hidden="true"><polygon points="3,0 6,3 3,6 0,3" fill="currentColor" /></svg>
          <h2 className="text-xs font-bold uppercase tracking-widest text-red-600 dark:text-red-400">
            {lang === 'th' ? 'ภาพรวมความเร็วเกินกำหนด' : 'OverSpeed Overview'}
          </h2>
          <svg width="6" height="6" viewBox="0 0 6 6" className="shrink-0 text-red-400/50" aria-hidden="true"><polygon points="3,0 6,3 3,6 0,3" fill="currentColor" /></svg>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-red-400/50 to-transparent dark:via-red-600/30" />
        </div>

        {/* ② Heatmap — event timing */}
        <section className={dashboardSectionClass}>
          <h2 className={heading2}>{lang === 'th' ? 'ช่วงเวลาที่เกิดเหตุการณ์' : 'Event timing heatmap'}</h2>
          <p className={`mt-1 mb-4 ${textSecondary}`}>
            {lang === 'th'
              ? 'รวมทุกสัปดาห์และทุกเดือนในช่วงที่เลือก — แสดงจำนวนครั้งตามวันในสัปดาห์และชั่วโมงในวัน'
              : 'Aggregated across all weeks and months in the selected period — shows event count by day of week and hour of day.'}
          </p>
          {heatmapDates.length === 0 ? (
            <EmptyState title={lang === 'th' ? 'ไม่มีข้อมูลวันที่' : 'No dated events'} />
          ) : (
            <AlertHeatmap dates={heatmapDates} />
          )}
        </section>

        {/* ③ Top vehicles + top drivers bar charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section className={dashboardSectionClass}>
            <h2 className={heading2}>{lang === 'th' ? 'ยานพาหนะที่เกิดมากที่สุด' : 'Vehicle — Record Count'}</h2>
            <p className={`mt-1 ${textSecondary}`}>
              {lang === 'th' ? 'จำนวนครั้งตามยานพาหนะ' : 'Events per vehicle.'}
            </p>
            <div className="mt-4">
              {topVehiclesBar.length === 0 ? (
                <EmptyState title={lang === 'th' ? 'ไม่มีข้อมูล' : 'No data'} />
              ) : (
                <HorizontalBarChart data={topVehiclesBar} maxItems={10} colors={CHART_COLORS} ariaLabel={lang === 'th' ? 'ยานพาหนะที่เกิดมากที่สุด' : 'Vehicles by record count'} />
              )}
            </div>
          </section>
          <section className={dashboardSectionClass}>
            <h2 className={heading2}>{lang === 'th' ? 'คนขับที่เกิดมากที่สุด' : 'Driver Name — Record Count'}</h2>
            <p className={`mt-1 ${textSecondary}`}>
              {lang === 'th' ? 'จำนวนครั้งตามคนขับ' : 'Events per driver.'}
            </p>
            <div className="mt-4">
              {topDriversBar.length === 0 ? (
                <EmptyState title={lang === 'th' ? 'ไม่มีข้อมูล' : 'No data'} />
              ) : (
                <HorizontalBarChart data={topDriversBar} maxItems={10} colors={CHART_COLORS} ariaLabel={lang === 'th' ? 'คนขับที่เกิดมากที่สุด' : 'Drivers by record count'} />
              )}
            </div>
          </section>
        </div>

        {/* ═══ Detailed Tables ═══ */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-300 to-transparent dark:via-zinc-700/50" />
          <svg width="6" height="6" viewBox="0 0 6 6" className="shrink-0 text-zinc-300 dark:text-zinc-600" aria-hidden="true"><polygon points="3,0 6,3 3,6 0,3" fill="currentColor" /></svg>
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            {lang === 'th' ? 'ตารางรายละเอียด' : 'Detailed Tables'}
          </h2>
          <svg width="6" height="6" viewBox="0 0 6 6" className="shrink-0 text-zinc-300 dark:text-zinc-600" aria-hidden="true"><polygon points="3,0 6,3 3,6 0,3" fill="currentColor" /></svg>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-300 to-transparent dark:via-zinc-700/50" />
        </div>

        {/* ⑦ Vehicle summary table */}
        <section className={dashboardSectionClass}>
          <h2 className={heading2}>{lang === 'th' ? 'สรุปตามยานพาหนะ' : 'Vehicle summary'}</h2>
          <p className={`mt-1 ${textSecondary}`}>
            {lang === 'th'
              ? `${vehicleSummaries.length} ยานพาหนะ`
              : `${vehicleSummaries.length} vehicle${vehicleSummaries.length === 1 ? '' : 's'}`}
          </p>
          <div className="mt-4">
            {vehicleSummaries.length === 0 ? (
              <EmptyState title={lang === 'th' ? 'ไม่พบข้อมูล' : 'No vehicle data'} />
            ) : (
              <DataTable
                columns={vehicleTableColumns}
                data={vehicleSummaries}
                defaultSort={{ key: 'totalEvents', direction: 'desc' }}
                pageSize={15}
                ariaLabel={lang === 'th' ? 'สรุปตามยานพาหนะ' : 'Vehicle overspeed summary'}
              />
            )}
          </div>
        </section>

        {/* ⑧ Driver summary table */}
        <section className={dashboardSectionClass}>
          <h2 className={heading2}>{lang === 'th' ? 'สรุปตามคนขับ' : 'Driver summary'}</h2>
          <p className={`mt-1 ${textSecondary}`}>
            {lang === 'th'
              ? `${driverSummaries.length} คนขับ`
              : `${driverSummaries.length} driver${driverSummaries.length === 1 ? '' : 's'}`}
          </p>
          <div className="mt-4">
            {driverSummaries.length === 0 ? (
              <EmptyState title={lang === 'th' ? 'ไม่พบข้อมูล' : 'No driver data'} />
            ) : (
              <DataTable
                columns={driverTableColumns}
                data={driverSummaries}
                defaultSort={{ key: 'totalEvents', direction: 'desc' }}
                pageSize={15}
                ariaLabel={lang === 'th' ? 'สรุปตามคนขับ' : 'Driver overspeed summary'}
              />
            )}
          </div>
        </section>

        {/* ⑨ Raw event log */}
        <section className={dashboardSectionClass}>
          <h2 className={heading2}>{lang === 'th' ? 'รายการเหตุการณ์ทั้งหมด' : 'All overspeed events'}</h2>
          <p className={`mt-1 ${textSecondary}`}>
            {lang === 'th'
              ? `${filteredRows.length} แถว`
              : `${filteredRows.length} row${filteredRows.length === 1 ? '' : 's'}`}
          </p>
          <div className="mt-4">
            {filteredRows.length === 0 ? (
              <EmptyState title={lang === 'th' ? 'ไม่พบเหตุการณ์' : 'No overspeed events'} />
            ) : (
              <DataTable
                columns={eventTableColumns}
                data={filteredRows}
                defaultSort={{ key: 'speed', direction: 'desc' }}
                pageSize={15}
                ariaLabel={lang === 'th' ? 'รายการเหตุการณ์ OverSpeed' : 'Overspeed events log'}
              />
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

'use client';

import { useMemo, useState } from 'react';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import LoadingState from './LoadingState';
import useGoogleSheet from './useGoogleSheet';
import { findValue, normalizeLabel, parseDate, toDisplayString } from './dashboardDataUtils';
import { type DashboardLang } from 'app/dashboard/i18n-copy';

type DashboardProps = {
  dashboardId: string;
  dashboardName: string;
  sheetId: string;
  sheetGid: string;
  dashboardNotes?: string | null;
  organizationName?: string | null;
  lang?: DashboardLang;
};

type DrivingRow = {
  driver: string;
  date: Date | null;
  distanceKm: number;
  cntDrvDurationHours: number;
  fleet?: string;
};

type DriverAggregate = {
  driver: string;
  tripCount: number;
  totalDistanceKm: number;
  totalCntDrvDurationHours: number;
};

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
    if (parts.length === 3) {
      return parts[0] + parts[1] / 60 + parts[2] / 3600;
    }
    if (parts.length === 2) {
      return parts[0] + parts[1] / 60;
    }
  }

  return parseNumber(raw);
};

const formatHours = (hours: number) => `${hours.toFixed(2)} h`;
const formatDistance = (distanceKm: number) => `${distanceKm.toFixed(1)} km`;

export default function DrivingDashboard({
  dashboardName,
  sheetId,
  sheetGid,
  dashboardNotes,
  organizationName,
  lang = 'en',
}: DashboardProps) {
  const { rows, loading, error, lastUpdated } = useGoogleSheet({ sheetId, gid: sheetGid });
  const [driverFilter, setDriverFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const normalizedOrganizationName = useMemo(
    () => (organizationName ? normalizeLabel(organizationName) : null),
    [organizationName],
  );

  const drivingRows = useMemo<DrivingRow[]>(() => rows.map((row) => {
    const driver = toDisplayString(findValue(row, ['Driver Name']));
    const distanceKm = parseNumber(findValue(row, ['Distance']));
    const cntDrvDurationHours = parseDurationHours(
      findValue(row, ['Cnt Drv duration', 'Cnt Drv Hr', 'DriveHrs duration']),
    );
    const date = parseDate(findValue(row, ['DateTime', 'Start Time', 'Date', 'Alert Date Time']));
    const fleet = toDisplayString(findValue(row, ['Fleet']));

    return {
      driver,
      date,
      distanceKm,
      cntDrvDurationHours,
      fleet,
    };
  }).filter((row) => {
    if (!normalizedOrganizationName) return true;
    return normalizeLabel(row.fleet ?? '') === normalizedOrganizationName;
  }).map((row) => ({
    driver: row.driver,
    date: row.date,
    distanceKm: row.distanceKm,
    cntDrvDurationHours: row.cntDrvDurationHours,
  })), [rows, normalizedOrganizationName]);

  const driverOptions = useMemo(
    () => Array.from(new Set(drivingRows.map((row) => row.driver).filter((name) => name !== '—'))).sort(),
    [drivingRows],
  );

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

  const aggregates = useMemo<DriverAggregate[]>(() => {
    const totals = new Map<string, DriverAggregate>();
    filteredRows.forEach((row) => {
      const current = totals.get(row.driver) ?? {
        driver: row.driver,
        tripCount: 0,
        totalDistanceKm: 0,
        totalCntDrvDurationHours: 0,
      };
      current.tripCount += 1;
      current.totalDistanceKm += row.distanceKm;
      current.totalCntDrvDurationHours += row.cntDrvDurationHours;
      totals.set(row.driver, current);
    });

    return Array.from(totals.values()).sort((a, b) => b.totalCntDrvDurationHours - a.totalCntDrvDurationHours);
  }, [filteredRows]);

  const kpis = useMemo(() => {
    const totalTrips = filteredRows.length;
    const totalDistanceKm = filteredRows.reduce((sum, row) => sum + row.distanceKm, 0);
    const totalCntDrvDurationHours = filteredRows.reduce((sum, row) => sum + row.cntDrvDurationHours, 0);
    const activeDrivers = aggregates.length;

    return {
      totalTrips,
      totalDistanceKm,
      totalCntDrvDurationHours,
      activeDrivers,
    };
  }, [filteredRows, aggregates.length]);

  const chartData = useMemo(() => {
    const top = aggregates.slice(0, 10);
    const maxDuration = Math.max(1, ...top.map((row) => row.totalCntDrvDurationHours));
    const maxDistance = Math.max(1, ...top.map((row) => row.totalDistanceKm));

    return { top, maxDuration, maxDistance };
  }, [aggregates]);

  if (loading) {
    return (
      <DashboardShell title={dashboardName} subtitle="Driving dashboard" lang={lang} lastUpdated={lastUpdated} notes={dashboardNotes}>
        <LoadingState
          message="Loading driving dashboard"
          detail="Fetching Cnt Drv duration and distance data from Google Sheets."
        />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title={dashboardName} subtitle="Driving dashboard" lang={lang} lastUpdated={lastUpdated} notes={dashboardNotes}>
      <section className={dashboardSectionClass}>
        <h2 className="text-lg font-medium">Filters</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-500 dark:text-slate-400">Driver</span>
            <select
              value={driverFilter}
              onChange={(event) => setDriverFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">All drivers</option>
              {driverOptions.map((driver) => (
                <option key={driver} value={driver}>{driver}</option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-slate-500 dark:text-slate-400">Start date</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-slate-500 dark:text-slate-400">End date</span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className={dashboardSectionClass}><p className="text-sm text-slate-500">Trips</p><p className="mt-2 text-2xl font-semibold">{kpis.totalTrips}</p></div>
        <div className={dashboardSectionClass}><p className="text-sm text-slate-500">Active drivers</p><p className="mt-2 text-2xl font-semibold">{kpis.activeDrivers}</p></div>
        <div className={dashboardSectionClass}><p className="text-sm text-slate-500">Cnt Drv duration</p><p className="mt-2 text-2xl font-semibold">{formatHours(kpis.totalCntDrvDurationHours)}</p></div>
        <div className={dashboardSectionClass}><p className="text-sm text-slate-500">Distance</p><p className="mt-2 text-2xl font-semibold">{formatDistance(kpis.totalDistanceKm)}</p></div>
      </section>

      <section className={dashboardSectionClass}>
        <h2 className="text-lg font-medium">Cnt Drv duration and distance by driver (Top 10)</h2>
        <div className="mt-4 space-y-4">
          {chartData.top.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No data available for the selected filters.</p>
          ) : chartData.top.map((row) => (
            <div key={`bar-${row.driver}`}>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="truncate pr-4 text-sm text-slate-700 dark:text-slate-200">{row.driver}</span>
                <span>{formatHours(row.totalCntDrvDurationHours)} • {formatDistance(row.totalDistanceKm)}</span>
              </div>
              <div className="space-y-1">
                <div className="h-2 rounded bg-slate-200 dark:bg-slate-800">
                  <div className="h-2 rounded bg-indigo-500" style={{ width: `${(row.totalCntDrvDurationHours / chartData.maxDuration) * 100}%` }} />
                </div>
                <div className="h-2 rounded bg-slate-200 dark:bg-slate-800">
                  <div className="h-2 rounded bg-cyan-500" style={{ width: `${(row.totalDistanceKm / chartData.maxDistance) * 100}%` }} />
                </div>
              </div>
            </div>
          ))}
          <div className="pt-2 text-xs text-slate-500 dark:text-slate-400">Indigo = Cnt Drv duration, Cyan = Distance</div>
        </div>
      </section>

      <section className={dashboardSectionClass}>
        <h2 className="text-lg font-medium">Cnt Drv duration table</h2>
        {error ? <p className="mt-2 text-sm text-rose-500">{error}</p> : null}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="px-3 py-2 font-medium">Driver</th>
                <th className="px-3 py-2 font-medium">Trips</th>
                <th className="px-3 py-2 font-medium">Cnt Drv duration</th>
                <th className="px-3 py-2 font-medium">Distance</th>
              </tr>
            </thead>
            <tbody>
              {aggregates.map((row) => (
                <tr key={`table-${row.driver}`} className="border-b border-slate-100 dark:border-slate-900">
                  <td className="px-3 py-2">{row.driver}</td>
                  <td className="px-3 py-2">{row.tripCount}</td>
                  <td className="px-3 py-2">{formatHours(row.totalCntDrvDurationHours)}</td>
                  <td className="px-3 py-2">{formatDistance(row.totalDistanceKm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  );
}

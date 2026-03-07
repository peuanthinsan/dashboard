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
  idleHours: number;
  overspeedEvents: number;
  harshEvents: number;
  fuelLiters: number;
  score: number;
  nightTrips: number;
  maxSpeedKmh: number;
  fleet?: string;
};

type DriverAggregate = {
  driver: string;
  tripCount: number;
  totalDistanceKm: number;
  totalCntDrvDurationHours: number;
  totalIdleHours: number;
  totalOverspeedEvents: number;
  totalHarshEvents: number;
  totalFuelLiters: number;
  nightTripCount: number;
  maxSpeedKmh: number;
  averageScore: number;
  scoredTrips: number;
};

type MonthlyTrendPoint = {
  monthKey: string;
  monthLabel: string;
  totalDistanceKm: number;
  totalCntDrvDurationHours: number;
  tripCount: number;
  totalOverspeedEvents: number;
  totalFuelLiters: number;
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
const formatLiters = (liters: number) => `${liters.toFixed(1)} L`;
const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const getMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const getMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return monthKey;
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

const normalizeDateOnly = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

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
    const idleHours = parseDurationHours(findValue(row, ['Idle duration', 'Idle Hr', 'Idling Hours']));
    const overspeedEvents = parseNumber(findValue(row, ['Overspeed Count', 'Over Speed Count', 'Over-speed events']));
    const harshEvents = parseNumber(
      findValue(row, ['Harsh Event Count', 'Harsh Break + Harsh Accel + Harsh Cornering', 'Harsh Driving Count']),
    );
    const fuelLiters = parseNumber(findValue(row, ['Fuel Used (L)', 'Fuel Consumed', 'Fuel']));
    const score = parseNumber(findValue(row, ['Safety Score', 'Driver Score', 'Score']));
    const nightTrips = parseNumber(findValue(row, ['Night Trip Count', 'Night Trips']));
    const maxSpeedKmh = parseNumber(findValue(row, ['Max Speed', 'Top Speed (km/h)', 'Highest Speed']));
    const date = parseDate(findValue(row, ['DateTime', 'Start Time', 'Date', 'Alert Date Time']));
    const fleet = toDisplayString(findValue(row, ['Fleet']));

    return {
      driver,
      date,
      distanceKm,
      cntDrvDurationHours,
      idleHours,
      overspeedEvents,
      harshEvents,
      fuelLiters,
      score,
      nightTrips,
      maxSpeedKmh,
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
    idleHours: row.idleHours,
    overspeedEvents: row.overspeedEvents,
    harshEvents: row.harshEvents,
    fuelLiters: row.fuelLiters,
    score: row.score,
    nightTrips: row.nightTrips,
    maxSpeedKmh: row.maxSpeedKmh,
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
        totalIdleHours: 0,
        totalOverspeedEvents: 0,
        totalHarshEvents: 0,
        totalFuelLiters: 0,
        nightTripCount: 0,
        maxSpeedKmh: 0,
        averageScore: 0,
        scoredTrips: 0,
      };
      current.tripCount += 1;
      current.totalDistanceKm += row.distanceKm;
      current.totalCntDrvDurationHours += row.cntDrvDurationHours;
      current.totalIdleHours += row.idleHours;
      current.totalOverspeedEvents += row.overspeedEvents;
      current.totalHarshEvents += row.harshEvents;
      current.totalFuelLiters += row.fuelLiters;
      current.nightTripCount += row.nightTrips;
      current.maxSpeedKmh = Math.max(current.maxSpeedKmh, row.maxSpeedKmh);
      if (row.score > 0) {
        current.averageScore += row.score;
        current.scoredTrips += 1;
      }
      totals.set(row.driver, current);
    });

    return Array.from(totals.values())
      .map((row) => ({
        ...row,
        averageScore: row.scoredTrips > 0 ? row.averageScore / row.scoredTrips : 0,
      }))
      .sort((a, b) => b.totalCntDrvDurationHours - a.totalCntDrvDurationHours);
  }, [filteredRows]);

  const kpis = useMemo(() => {
    const totalTrips = filteredRows.length;
    const totalDistanceKm = filteredRows.reduce((sum, row) => sum + row.distanceKm, 0);
    const totalCntDrvDurationHours = filteredRows.reduce((sum, row) => sum + row.cntDrvDurationHours, 0);
    const totalIdleHours = filteredRows.reduce((sum, row) => sum + row.idleHours, 0);
    const totalOverspeedEvents = filteredRows.reduce((sum, row) => sum + row.overspeedEvents, 0);
    const totalHarshEvents = filteredRows.reduce((sum, row) => sum + row.harshEvents, 0);
    const totalFuelLiters = filteredRows.reduce((sum, row) => sum + row.fuelLiters, 0);
    const totalNightTrips = filteredRows.reduce((sum, row) => sum + row.nightTrips, 0);
    const activeDrivers = aggregates.length;
    const utilizationPct = totalCntDrvDurationHours > 0
      ? (totalCntDrvDurationHours / (totalCntDrvDurationHours + totalIdleHours)) * 100
      : 0;
    const eventRatePer100Trips = totalTrips > 0 ? ((totalOverspeedEvents + totalHarshEvents) / totalTrips) * 100 : 0;
    const kmPerLiter = totalFuelLiters > 0 ? totalDistanceKm / totalFuelLiters : 0;
    const kmPerTrip = totalTrips > 0 ? totalDistanceKm / totalTrips : 0;
    const hoursPerTrip = totalTrips > 0 ? totalCntDrvDurationHours / totalTrips : 0;
    const speedWeighted = totalCntDrvDurationHours > 0 ? totalDistanceKm / totalCntDrvDurationHours : 0;
    const datePoints = filteredRows.filter((row) => row.date).map((row) => row.date as Date).sort((a, b) => a.getTime() - b.getTime());
    const firstTripDate = datePoints[0] ?? null;
    const lastTripDate = datePoints[datePoints.length - 1] ?? null;
    const daysCovered = firstTripDate && lastTripDate
      ? Math.max(1, Math.round((normalizeDateOnly(lastTripDate) - normalizeDateOnly(firstTripDate)) / (1000 * 60 * 60 * 24)) + 1)
      : 0;
    const tripsPerDay = daysCovered > 0 ? totalTrips / daysCovered : 0;
    const overspeedPer100Km = totalDistanceKm > 0 ? (totalOverspeedEvents / totalDistanceKm) * 100 : 0;

    return {
      totalTrips,
      totalDistanceKm,
      totalCntDrvDurationHours,
      totalIdleHours,
      totalOverspeedEvents,
      totalHarshEvents,
      totalFuelLiters,
      totalNightTrips,
      activeDrivers,
      utilizationPct,
      eventRatePer100Trips,
      kmPerLiter,
      kmPerTrip,
      hoursPerTrip,
      speedWeighted,
      daysCovered,
      firstTripDate,
      lastTripDate,
      tripsPerDay,
      overspeedPer100Km,
    };
  }, [filteredRows, aggregates.length]);

  const chartData = useMemo(() => {
    const top = aggregates.slice(0, 10);
    const maxDuration = Math.max(1, ...top.map((row) => row.totalCntDrvDurationHours));
    const maxDistance = Math.max(1, ...top.map((row) => row.totalDistanceKm));

    return { top, maxDuration, maxDistance };
  }, [aggregates]);

  const monthlyTrend = useMemo<MonthlyTrendPoint[]>(() => {
    const monthTotals = new Map<string, MonthlyTrendPoint>();
    filteredRows.forEach((row) => {
      if (!row.date) return;
      const monthKey = getMonthKey(row.date);
      const current = monthTotals.get(monthKey) ?? {
        monthKey,
        monthLabel: getMonthLabel(monthKey),
        totalDistanceKm: 0,
        totalCntDrvDurationHours: 0,
        tripCount: 0,
        totalOverspeedEvents: 0,
        totalFuelLiters: 0,
      };
      current.totalDistanceKm += row.distanceKm;
      current.totalCntDrvDurationHours += row.cntDrvDurationHours;
      current.tripCount += 1;
      current.totalOverspeedEvents += row.overspeedEvents;
      current.totalFuelLiters += row.fuelLiters;
      monthTotals.set(monthKey, current);
    });
    return Array.from(monthTotals.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey)).slice(-8);
  }, [filteredRows]);

  const maxMonthlyDistance = useMemo(
    () => Math.max(1, ...monthlyTrend.map((point) => point.totalDistanceKm)),
    [monthlyTrend],
  );

  const topEfficiencyDrivers = useMemo(
    () => aggregates
      .filter((row) => row.totalCntDrvDurationHours > 0)
      .map((row) => ({
        ...row,
        efficiencyKmh: row.totalDistanceKm / row.totalCntDrvDurationHours,
      }))
      .sort((a, b) => b.efficiencyKmh - a.efficiencyKmh)
      .slice(0, 5),
    [aggregates],
  );

  const topRiskDrivers = useMemo(
    () => aggregates
      .map((row) => ({
        ...row,
        riskScore: (row.totalOverspeedEvents * 2) + row.totalHarshEvents + (row.nightTripCount * 0.5),
      }))
      .filter((row) => row.riskScore > 0)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 5),
    [aggregates],
  );

  const bestPerformers = useMemo(
    () => aggregates
      .filter((row) => row.tripCount >= 3)
      .map((row) => {
        const eventRate = row.tripCount > 0 ? (row.totalOverspeedEvents + row.totalHarshEvents) / row.tripCount : 0;
        return {
          ...row,
          composite: (row.averageScore || 80) - (eventRate * 8) + ((row.totalDistanceKm / Math.max(1, row.totalCntDrvDurationHours)) / 2),
        };
      })
      .sort((a, b) => b.composite - a.composite)
      .slice(0, 5),
    [aggregates],
  );

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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className={dashboardSectionClass}><p className="text-sm text-slate-500">Idle duration</p><p className="mt-2 text-2xl font-semibold">{formatHours(kpis.totalIdleHours)}</p><p className="mt-1 text-xs text-slate-500">Utilization {formatPercent(kpis.utilizationPct)}</p></div>
        <div className={dashboardSectionClass}><p className="text-sm text-slate-500">Safety events</p><p className="mt-2 text-2xl font-semibold">{kpis.totalOverspeedEvents + kpis.totalHarshEvents}</p><p className="mt-1 text-xs text-slate-500">{kpis.eventRatePer100Trips.toFixed(1)} / 100 trips</p></div>
        <div className={dashboardSectionClass}><p className="text-sm text-slate-500">Fuel used</p><p className="mt-2 text-2xl font-semibold">{formatLiters(kpis.totalFuelLiters)}</p><p className="mt-1 text-xs text-slate-500">Efficiency {kpis.kmPerLiter.toFixed(2)} km/L</p></div>
        <div className={dashboardSectionClass}><p className="text-sm text-slate-500">Night trips</p><p className="mt-2 text-2xl font-semibold">{kpis.totalNightTrips.toFixed(0)}</p><p className="mt-1 text-xs text-slate-500">Overspeed intensity {kpis.overspeedPer100Km.toFixed(2)} / 100 km</p></div>
      </section>

      <section className={dashboardSectionClass}>
        <h2 className="text-lg font-medium">Operational snapshot</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Date coverage</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
              {kpis.firstTripDate ? kpis.firstTripDate.toLocaleDateString() : '—'} → {kpis.lastTripDate ? kpis.lastTripDate.toLocaleDateString() : '—'}
            </p>
            <p className="mt-1 text-xs text-slate-500">{kpis.daysCovered} days</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Trip intensity</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{kpis.tripsPerDay.toFixed(2)} trips/day</p>
            <p className="mt-1 text-xs text-slate-500">{kpis.kmPerTrip.toFixed(1)} km/trip</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Drive quality</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{kpis.hoursPerTrip.toFixed(2)} h/trip</p>
            <p className="mt-1 text-xs text-slate-500">{kpis.speedWeighted.toFixed(1)} average km/h</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">What this means</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-500">
              <li>High idle % can indicate route congestion or excessive warm-up time.</li>
              <li>Event rate spikes usually correlate with specific drivers, routes, or shifts.</li>
            </ul>
          </div>
        </div>
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
                  <div className="h-2 rounded bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500" style={{ width: `${(row.totalCntDrvDurationHours / chartData.maxDuration) * 100}%` }} />
                </div>
                <div className="h-2 rounded bg-slate-200 dark:bg-slate-800">
                  <div className="h-2 rounded bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600" style={{ width: `${(row.totalDistanceKm / chartData.maxDistance) * 100}%` }} />
                </div>
              </div>
            </div>
          ))}
          <div className="pt-2 text-xs text-slate-500 dark:text-slate-400">Purple gradient = Cnt Drv duration, Blue gradient = Distance</div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className={dashboardSectionClass}>
          <h2 className="text-lg font-medium">Distance trend by month</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Last 8 months of filtered trips.</p>
          {monthlyTrend.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No dated trip data available.</p>
          ) : (
            <div className="mt-5 space-y-3">
              {monthlyTrend.map((point) => (
                <div key={point.monthKey}>
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="text-sm text-slate-700 dark:text-slate-200">{point.monthLabel}</span>
                    <span>{formatDistance(point.totalDistanceKm)} • {point.tripCount} trips • {point.totalOverspeedEvents.toFixed(0)} overspeed</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500"
                      style={{ width: `${(point.totalDistanceKm / maxMonthlyDistance) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={dashboardSectionClass}>
          <h2 className="text-lg font-medium">Most efficient drivers</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Top drivers ranked by average km/h (distance ÷ drive duration).</p>
          {topEfficiencyDrivers.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No data available to calculate efficiency.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {topEfficiencyDrivers.map((row, index) => (
                <div key={`efficiency-${row.driver}`} className="rounded-xl border border-slate-200 bg-gradient-to-r from-white via-amber-50 to-rose-50 px-4 py-3 dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">#{index + 1} {row.driver}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{row.tripCount} trips • {formatDistance(row.totalDistanceKm)} • {formatHours(row.totalCntDrvDurationHours)}</p>
                    </div>
                    <p className="rounded-full bg-gradient-to-r from-orange-400 to-pink-500 px-3 py-1 text-sm font-semibold text-white">
                      {row.efficiencyKmh.toFixed(1)} km/h
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className={dashboardSectionClass}>
          <h2 className="text-lg font-medium">Drivers needing coaching</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Ranked by overspeed + harsh events + night driving pressure.</p>
          {topRiskDrivers.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No risk events found in selected data.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {topRiskDrivers.map((row, index) => (
                <div key={`risk-${row.driver}`} className="rounded-lg border border-rose-200 bg-rose-50/70 p-3 dark:border-rose-900/60 dark:bg-rose-900/10">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">#{index + 1} {row.driver}</p>
                    <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">Risk {row.riskScore.toFixed(1)}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Overspeed {row.totalOverspeedEvents.toFixed(0)} • Harsh {row.totalHarshEvents.toFixed(0)} • Night trips {row.nightTripCount.toFixed(0)} • Top speed {row.maxSpeedKmh.toFixed(0)} km/h</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={dashboardSectionClass}>
          <h2 className="text-lg font-medium">High performers</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Balanced by safety score, event rate, and productivity.</p>
          {bestPerformers.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Need at least 3 trips/driver to rank fairly.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {bestPerformers.map((row, index) => (
                <div key={`best-${row.driver}`} className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900/60 dark:bg-emerald-900/10">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">#{index + 1} {row.driver}</p>
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Score {row.composite.toFixed(1)}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Safety {row.averageScore > 0 ? row.averageScore.toFixed(1) : '—'} • {formatDistance(row.totalDistanceKm)} • {formatHours(row.totalCntDrvDurationHours)} • Fuel {formatLiters(row.totalFuelLiters)}</p>
                </div>
              ))}
            </div>
          )}
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
                <th className="px-3 py-2 font-medium">Idle</th>
                <th className="px-3 py-2 font-medium">Fuel</th>
                <th className="px-3 py-2 font-medium">Events</th>
                <th className="px-3 py-2 font-medium">Night trips</th>
                <th className="px-3 py-2 font-medium">Avg safety score</th>
              </tr>
            </thead>
            <tbody>
              {aggregates.map((row) => (
                <tr key={`table-${row.driver}`} className="border-b border-slate-100 dark:border-slate-900">
                  <td className="px-3 py-2">{row.driver}</td>
                  <td className="px-3 py-2">{row.tripCount}</td>
                  <td className="px-3 py-2">{formatHours(row.totalCntDrvDurationHours)}</td>
                  <td className="px-3 py-2">{formatDistance(row.totalDistanceKm)}</td>
                  <td className="px-3 py-2">{formatHours(row.totalIdleHours)}</td>
                  <td className="px-3 py-2">{formatLiters(row.totalFuelLiters)}</td>
                  <td className="px-3 py-2">{(row.totalOverspeedEvents + row.totalHarshEvents).toFixed(0)}</td>
                  <td className="px-3 py-2">{row.nightTripCount.toFixed(0)}</td>
                  <td className="px-3 py-2">{row.averageScore > 0 ? row.averageScore.toFixed(1) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  );
}

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
  idlingHours: number;
  fuelUsedLiters: number;
  overspeedEvents: number;
  harshBrakeEvents: number;
  harshAccelEvents: number;
  score: number;
  fleet?: string;
};

type DriverAggregate = {
  driver: string;
  tripCount: number;
  totalDistanceKm: number;
  totalCntDrvDurationHours: number;
  totalIdlingHours: number;
  totalFuelUsedLiters: number;
  overspeedEvents: number;
  harshBrakeEvents: number;
  harshAccelEvents: number;
  avgScore: number;
};

type MonthlyTrendPoint = {
  monthKey: string;
  monthLabel: string;
  totalDistanceKm: number;
  totalCntDrvDurationHours: number;
  totalIdlingHours: number;
  tripCount: number;
};

type DailyOpsPoint = {
  dateKey: string;
  trips: number;
  distanceKm: number;
  drivingHours: number;
  idlingHours: number;
  riskEvents: number;
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
const formatRate = (value: number, suffix: string) => `${value.toFixed(1)} ${suffix}`;

const getMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const getDateKey = (date: Date) => date.toISOString().slice(0, 10);

const getMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return monthKey;
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

const formatDateLabel = (dateKey: string) => new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, {
  month: 'short',
  day: 'numeric',
});

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
    const distanceKm = parseNumber(findValue(row, ['Distance', 'Distance Km', 'Total Distance']));
    const cntDrvDurationHours = parseDurationHours(
      findValue(row, ['Cnt Drv duration', 'Cnt Drv Hr', 'DriveHrs duration', 'Driving Duration']),
    );
    const idlingHours = parseDurationHours(findValue(row, ['Idle duration', 'Idling Duration', 'Idle Hrs']));
    const fuelUsedLiters = parseNumber(findValue(row, ['Fuel Used', 'Fuel Consumed', 'Fuel (L)', 'Fuel']));
    const overspeedEvents = parseNumber(findValue(row, ['Over Speed Count', 'Overspeed Count', 'Overspeed']));
    const harshBrakeEvents = parseNumber(findValue(row, ['Harsh Brake Count', 'Harsh Braking', 'Harsh Brake']));
    const harshAccelEvents = parseNumber(findValue(row, ['Harsh Acceleration Count', 'Harsh Accel', 'Harsh Acceleration']));
    const score = parseNumber(findValue(row, ['Driver Score', 'Score', 'Safety Score']));
    const date = parseDate(findValue(row, ['DateTime', 'Start Time', 'Date', 'Alert Date Time']));
    const fleet = toDisplayString(findValue(row, ['Fleet']));

    return {
      driver,
      date,
      distanceKm,
      cntDrvDurationHours,
      idlingHours,
      fuelUsedLiters,
      overspeedEvents,
      harshBrakeEvents,
      harshAccelEvents,
      score,
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
    idlingHours: row.idlingHours,
    fuelUsedLiters: row.fuelUsedLiters,
    overspeedEvents: row.overspeedEvents,
    harshBrakeEvents: row.harshBrakeEvents,
    harshAccelEvents: row.harshAccelEvents,
    score: row.score,
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
        totalIdlingHours: 0,
        totalFuelUsedLiters: 0,
        overspeedEvents: 0,
        harshBrakeEvents: 0,
        harshAccelEvents: 0,
        avgScore: 0,
      };
      current.tripCount += 1;
      current.totalDistanceKm += row.distanceKm;
      current.totalCntDrvDurationHours += row.cntDrvDurationHours;
      current.totalIdlingHours += row.idlingHours;
      current.totalFuelUsedLiters += row.fuelUsedLiters;
      current.overspeedEvents += row.overspeedEvents;
      current.harshBrakeEvents += row.harshBrakeEvents;
      current.harshAccelEvents += row.harshAccelEvents;
      current.avgScore += row.score;
      totals.set(row.driver, current);
    });

    return Array.from(totals.values())
      .map((row) => ({
        ...row,
        avgScore: row.tripCount ? row.avgScore / row.tripCount : 0,
      }))
      .sort((a, b) => b.totalCntDrvDurationHours - a.totalCntDrvDurationHours);
  }, [filteredRows]);

  const kpis = useMemo(() => {
    const totalTrips = filteredRows.length;
    const totalDistanceKm = filteredRows.reduce((sum, row) => sum + row.distanceKm, 0);
    const totalCntDrvDurationHours = filteredRows.reduce((sum, row) => sum + row.cntDrvDurationHours, 0);
    const totalIdlingHours = filteredRows.reduce((sum, row) => sum + row.idlingHours, 0);
    const totalFuelUsedLiters = filteredRows.reduce((sum, row) => sum + row.fuelUsedLiters, 0);
    const totalRiskEvents = filteredRows.reduce(
      (sum, row) => sum + row.overspeedEvents + row.harshBrakeEvents + row.harshAccelEvents,
      0,
    );
    const activeDrivers = aggregates.length;

    const avgTripDistance = totalTrips ? totalDistanceKm / totalTrips : 0;
    const avgTripDuration = totalTrips ? totalCntDrvDurationHours / totalTrips : 0;
    const avgSpeedKmh = totalCntDrvDurationHours > 0 ? totalDistanceKm / totalCntDrvDurationHours : 0;
    const idlingRatio = totalCntDrvDurationHours + totalIdlingHours > 0
      ? (totalIdlingHours / (totalCntDrvDurationHours + totalIdlingHours)) * 100
      : 0;
    const fuelEfficiencyKml = totalFuelUsedLiters > 0 ? totalDistanceKm / totalFuelUsedLiters : 0;
    const riskEventsPer100Km = totalDistanceKm > 0 ? (totalRiskEvents / totalDistanceKm) * 100 : 0;

    return {
      totalTrips,
      totalDistanceKm,
      totalCntDrvDurationHours,
      totalIdlingHours,
      totalFuelUsedLiters,
      totalRiskEvents,
      activeDrivers,
      avgTripDistance,
      avgTripDuration,
      avgSpeedKmh,
      idlingRatio,
      fuelEfficiencyKml,
      riskEventsPer100Km,
    };
  }, [filteredRows, aggregates.length]);

  const chartData = useMemo(() => {
    const top = aggregates.slice(0, 12);
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
        totalIdlingHours: 0,
        tripCount: 0,
      };
      current.totalDistanceKm += row.distanceKm;
      current.totalCntDrvDurationHours += row.cntDrvDurationHours;
      current.totalIdlingHours += row.idlingHours;
      current.tripCount += 1;
      monthTotals.set(monthKey, current);
    });
    return Array.from(monthTotals.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey)).slice(-12);
  }, [filteredRows]);

  const dailyOperations = useMemo<DailyOpsPoint[]>(() => {
    const dailyTotals = new Map<string, DailyOpsPoint>();
    filteredRows.forEach((row) => {
      if (!row.date) return;
      const dateKey = getDateKey(row.date);
      const current = dailyTotals.get(dateKey) ?? {
        dateKey,
        trips: 0,
        distanceKm: 0,
        drivingHours: 0,
        idlingHours: 0,
        riskEvents: 0,
      };
      current.trips += 1;
      current.distanceKm += row.distanceKm;
      current.drivingHours += row.cntDrvDurationHours;
      current.idlingHours += row.idlingHours;
      current.riskEvents += row.overspeedEvents + row.harshBrakeEvents + row.harshAccelEvents;
      dailyTotals.set(dateKey, current);
    });

    return Array.from(dailyTotals.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey)).slice(0, 14);
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

  const highestRiskDrivers = useMemo(
    () => aggregates
      .map((row) => {
        const totalEvents = row.overspeedEvents + row.harshBrakeEvents + row.harshAccelEvents;
        const eventsPer100Km = row.totalDistanceKm > 0 ? (totalEvents / row.totalDistanceKm) * 100 : 0;
        return {
          ...row,
          totalEvents,
          eventsPer100Km,
        };
      })
      .filter((row) => row.totalDistanceKm > 0)
      .sort((a, b) => b.eventsPer100Km - a.eventsPer100Km)
      .slice(0, 5),
    [aggregates],
  );

  const bestScoreDrivers = useMemo(
    () => aggregates
      .filter((row) => row.avgScore > 0)
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 5),
    [aggregates],
  );

  const insights = useMemo(() => {
    const topByDistance = [...aggregates].sort((a, b) => b.totalDistanceKm - a.totalDistanceKm)[0];
    const mostIdle = [...aggregates].sort((a, b) => b.totalIdlingHours - a.totalIdlingHours)[0];
    const safest = bestScoreDrivers[0];
    const risk = highestRiskDrivers[0];

    return [
      topByDistance
        ? `${topByDistance.driver} has the highest workload at ${formatDistance(topByDistance.totalDistanceKm)} across ${topByDistance.tripCount} trips.`
        : null,
      mostIdle && mostIdle.totalIdlingHours > 0
        ? `${mostIdle.driver} has the highest idling exposure at ${formatHours(mostIdle.totalIdlingHours)}. Consider route or stop optimization.`
        : null,
      safest
        ? `${safest.driver} currently leads safety score performance with an average score of ${safest.avgScore.toFixed(1)}.`
        : null,
      risk
        ? `${risk.driver} has the highest risk-event density at ${formatRate(risk.eventsPer100Km, 'events/100km')}.`
        : null,
    ].filter((item): item is string => Boolean(item));
  }, [aggregates, bestScoreDrivers, highestRiskDrivers]);

  if (loading) {
    return (
      <DashboardShell title={dashboardName} subtitle="Driving operations intelligence" lang={lang} lastUpdated={lastUpdated} notes={dashboardNotes}>
        <LoadingState
          message="Loading driving operations dashboard"
          detail="Fetching trip, safety, and utilization metrics from Google Sheets."
        />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title={dashboardName} subtitle="Driving operations intelligence" lang={lang} lastUpdated={lastUpdated} notes={dashboardNotes}>
      <section className={dashboardSectionClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Filters</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{filteredRows.length} trips in scope</p>
        </div>
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
        <div className={dashboardSectionClass}><p className="text-sm text-slate-500">Trips</p><p className="mt-2 text-2xl font-semibold">{kpis.totalTrips}</p><p className="mt-1 text-xs text-slate-500">Avg {formatDistance(kpis.avgTripDistance)} per trip</p></div>
        <div className={dashboardSectionClass}><p className="text-sm text-slate-500">Active drivers</p><p className="mt-2 text-2xl font-semibold">{kpis.activeDrivers}</p><p className="mt-1 text-xs text-slate-500">Avg {formatHours(kpis.avgTripDuration)} per trip</p></div>
        <div className={dashboardSectionClass}><p className="text-sm text-slate-500">Driving duration</p><p className="mt-2 text-2xl font-semibold">{formatHours(kpis.totalCntDrvDurationHours)}</p><p className="mt-1 text-xs text-slate-500">Avg speed {formatRate(kpis.avgSpeedKmh, 'km/h')}</p></div>
        <div className={dashboardSectionClass}><p className="text-sm text-slate-500">Distance</p><p className="mt-2 text-2xl font-semibold">{formatDistance(kpis.totalDistanceKm)}</p><p className="mt-1 text-xs text-slate-500">Fuel efficiency {formatRate(kpis.fuelEfficiencyKml, 'km/L')}</p></div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className={dashboardSectionClass}><p className="text-sm text-slate-500">Idling duration</p><p className="mt-2 text-2xl font-semibold">{formatHours(kpis.totalIdlingHours)}</p><p className="mt-1 text-xs text-slate-500">Idling share {kpis.idlingRatio.toFixed(1)}%</p></div>
        <div className={dashboardSectionClass}><p className="text-sm text-slate-500">Fuel used</p><p className="mt-2 text-2xl font-semibold">{formatLiters(kpis.totalFuelUsedLiters)}</p><p className="mt-1 text-xs text-slate-500">{kpis.totalFuelUsedLiters > 0 ? formatRate(kpis.totalDistanceKm / kpis.totalFuelUsedLiters, 'km/L') : 'No fuel data'}</p></div>
        <div className={dashboardSectionClass}><p className="text-sm text-slate-500">Risk events</p><p className="mt-2 text-2xl font-semibold">{kpis.totalRiskEvents}</p><p className="mt-1 text-xs text-slate-500">{formatRate(kpis.riskEventsPer100Km, 'events/100km')}</p></div>
        <div className={dashboardSectionClass}><p className="text-sm text-slate-500">Data quality</p><p className="mt-2 text-2xl font-semibold">{Math.round((filteredRows.filter((row) => row.date).length / Math.max(1, filteredRows.length)) * 100)}%</p><p className="mt-1 text-xs text-slate-500">Trips with valid date</p></div>
      </section>

      <section className={dashboardSectionClass}>
        <h2 className="text-lg font-medium">Operations insights</h2>
        {insights.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Add distance, duration, and score columns to unlock deeper insights.</p>
        ) : (
          <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            {insights.map((insight) => (
              <li key={insight} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900">{insight}</li>
            ))}
          </ul>
        )}
      </section>

      <section className={dashboardSectionClass}>
        <h2 className="text-lg font-medium">Driver workload and output (Top 12)</h2>
        <div className="mt-4 space-y-4">
          {chartData.top.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No data available for the selected filters.</p>
          ) : chartData.top.map((row) => (
            <div key={`bar-${row.driver}`}>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="truncate pr-4 text-sm text-slate-700 dark:text-slate-200">{row.driver}</span>
                <span>{formatHours(row.totalCntDrvDurationHours)} • {formatDistance(row.totalDistanceKm)} • {row.tripCount} trips</span>
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
          <div className="pt-2 text-xs text-slate-500 dark:text-slate-400">Purple = drive hours, Blue = distance</div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className={dashboardSectionClass}>
          <h2 className="text-lg font-medium">Distance trend by month</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Last 12 months of filtered trips.</p>
          {monthlyTrend.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No dated trip data available.</p>
          ) : (
            <div className="mt-5 space-y-3">
              {monthlyTrend.map((point) => (
                <div key={point.monthKey}>
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="text-sm text-slate-700 dark:text-slate-200">{point.monthLabel}</span>
                    <span>{formatDistance(point.totalDistanceKm)} • {point.tripCount} trips • idle {formatHours(point.totalIdlingHours)}</span>
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
                      {formatRate(row.efficiencyKmh, 'km/h')}
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
          <h2 className="text-lg font-medium">Highest risk-event density</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Overspeed + harsh braking + harsh acceleration per 100 km.</p>
          {highestRiskDrivers.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No risk-event columns detected in the sheet.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {highestRiskDrivers.map((driver) => (
                <div key={`risk-${driver.driver}`} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
                  <div>
                    <p className="text-sm font-medium">{driver.driver}</p>
                    <p className="text-xs text-slate-500">{driver.totalEvents} events over {formatDistance(driver.totalDistanceKm)}</p>
                  </div>
                  <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{formatRate(driver.eventsPer100Km, 'ev/100km')}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={dashboardSectionClass}>
          <h2 className="text-lg font-medium">Top safety scores</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Best average score from available score columns.</p>
          {bestScoreDrivers.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No score column detected in the sheet.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {bestScoreDrivers.map((driver, index) => (
                <div key={`score-${driver.driver}`} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
                  <div>
                    <p className="text-sm font-medium">#{index + 1} {driver.driver}</p>
                    <p className="text-xs text-slate-500">{driver.tripCount} trips • {formatDistance(driver.totalDistanceKm)}</p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{driver.avgScore.toFixed(1)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className={dashboardSectionClass}>
        <h2 className="text-lg font-medium">Daily operations snapshot (latest 14 days)</h2>
        {dailyOperations.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No date data available for daily operations.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Trips</th>
                  <th className="px-3 py-2 font-medium">Distance</th>
                  <th className="px-3 py-2 font-medium">Driving</th>
                  <th className="px-3 py-2 font-medium">Idling</th>
                  <th className="px-3 py-2 font-medium">Risk events</th>
                </tr>
              </thead>
              <tbody>
                {dailyOperations.map((day) => (
                  <tr key={day.dateKey} className="border-b border-slate-100 dark:border-slate-900">
                    <td className="px-3 py-2">{formatDateLabel(day.dateKey)}</td>
                    <td className="px-3 py-2">{day.trips}</td>
                    <td className="px-3 py-2">{formatDistance(day.distanceKm)}</td>
                    <td className="px-3 py-2">{formatHours(day.drivingHours)}</td>
                    <td className="px-3 py-2">{formatHours(day.idlingHours)}</td>
                    <td className="px-3 py-2">{day.riskEvents}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={dashboardSectionClass}>
        <h2 className="text-lg font-medium">Driver performance table</h2>
        {error ? <p className="mt-2 text-sm text-rose-500">{error}</p> : null}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="px-3 py-2 font-medium">Driver</th>
                <th className="px-3 py-2 font-medium">Trips</th>
                <th className="px-3 py-2 font-medium">Drive duration</th>
                <th className="px-3 py-2 font-medium">Distance</th>
                <th className="px-3 py-2 font-medium">Idling</th>
                <th className="px-3 py-2 font-medium">Fuel</th>
                <th className="px-3 py-2 font-medium">Risk events</th>
                <th className="px-3 py-2 font-medium">Avg score</th>
              </tr>
            </thead>
            <tbody>
              {aggregates.map((row) => (
                <tr key={`table-${row.driver}`} className="border-b border-slate-100 dark:border-slate-900">
                  <td className="px-3 py-2">{row.driver}</td>
                  <td className="px-3 py-2">{row.tripCount}</td>
                  <td className="px-3 py-2">{formatHours(row.totalCntDrvDurationHours)}</td>
                  <td className="px-3 py-2">{formatDistance(row.totalDistanceKm)}</td>
                  <td className="px-3 py-2">{formatHours(row.totalIdlingHours)}</td>
                  <td className="px-3 py-2">{row.totalFuelUsedLiters > 0 ? formatLiters(row.totalFuelUsedLiters) : '—'}</td>
                  <td className="px-3 py-2">{row.overspeedEvents + row.harshBrakeEvents + row.harshAccelEvents}</td>
                  <td className="px-3 py-2">{row.avgScore > 0 ? row.avgScore.toFixed(1) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  );
}

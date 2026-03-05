'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import FilterGroup from './FilterGroup';
import LoadingState from './LoadingState';
import useGoogleSheet from './useGoogleSheet';
import { FilterChip, chipMutedClassName } from './FilterChip';
import { findValue, parseDate } from './dashboardDataUtils';
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
  driverName: string;
  date: Date;
  dateLabel: string;
  cntDrvDuration: number;
  distance: number;
};

const toNumber = (value: unknown) => {
  if (value == null || value === '') return 0;
  const parsed = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

export default function DrivingDashboard({
  dashboardId,
  dashboardName,
  sheetId,
  sheetGid,
  dashboardNotes,
  organizationName,
  lang = 'en',
}: DashboardProps) {
  const { rows, loading, error, lastUpdated } = useGoogleSheet({ sheetId, gid: sheetGid });
  const [driverFilters, setDriverFilters] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const storedRaw = localStorage.getItem(`driving-dashboard-filters:${dashboardId}`);
    if (!storedRaw) return;
    try {
      const stored = JSON.parse(storedRaw) as {
        driverFilters?: string[];
        startDate?: string;
        endDate?: string;
      };
      if (Array.isArray(stored.driverFilters)) {
        setDriverFilters(stored.driverFilters.filter((value) => typeof value === 'string'));
      }
      if (typeof stored.startDate === 'string') setStartDate(stored.startDate);
      if (typeof stored.endDate === 'string') setEndDate(stored.endDate);
    } catch {
      // noop
    }
  }, [dashboardId]);

  useEffect(() => {
    localStorage.setItem(
      `driving-dashboard-filters:${dashboardId}`,
      JSON.stringify({ driverFilters, startDate, endDate }),
    );
  }, [dashboardId, driverFilters, startDate, endDate]);

  const parsedRows = useMemo<DrivingRow[]>(() => {
    return rows
      .map((row) => {
        const dateValue = findValue(row, ['DateTime', 'Start Time', 'Date']);
        const parsedDate = parseDate(dateValue);
        if (!parsedDate) return null;

        const driverNameRaw = findValue(row, ['Driver Name', 'Driver']);
        const driverName = String(driverNameRaw ?? '').trim() || 'Unknown Driver';

        return {
          driverName,
          date: parsedDate,
          dateLabel: parsedDate.toLocaleDateString('en-GB'),
          cntDrvDuration: toNumber(findValue(row, ['Cnt Drv duration'])),
          distance: toNumber(findValue(row, ['Distance'])),
        };
      })
      .filter((value): value is DrivingRow => value !== null);
  }, [rows]);

  const driverOptions = useMemo(
    () => Array.from(new Set(parsedRows.map((row) => row.driverName))).sort((a, b) => a.localeCompare(b)),
    [parsedRows],
  );

  const filteredRows = useMemo(() => {
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59`) : null;

    return parsedRows.filter((row) => {
      if (driverFilters.length > 0 && !driverFilters.includes(row.driverName)) return false;
      if (start && row.date < start) return false;
      if (end && row.date > end) return false;
      return true;
    });
  }, [driverFilters, endDate, parsedRows, startDate]);

  const kpis = useMemo(() => {
    const totalCntDrvDuration = filteredRows.reduce((sum, row) => sum + row.cntDrvDuration, 0);
    const totalDistance = filteredRows.reduce((sum, row) => sum + row.distance, 0);
    return {
      totalCntDrvDuration,
      totalDistance,
      trips: filteredRows.length,
      avgCntDrvDuration: filteredRows.length === 0 ? 0 : totalCntDrvDuration / filteredRows.length,
    };
  }, [filteredRows]);

  const chartRows = useMemo(() => {
    const grouped = new Map<string, { label: string; cntDrvDuration: number; distance: number }>();

    filteredRows.forEach((row) => {
      const existing = grouped.get(row.driverName) ?? {
        label: row.driverName,
        cntDrvDuration: 0,
        distance: 0,
      };
      existing.cntDrvDuration += row.cntDrvDuration;
      existing.distance += row.distance;
      grouped.set(row.driverName, existing);
    });

    return Array.from(grouped.values()).sort((a, b) => b.cntDrvDuration - a.cntDrvDuration).slice(0, 12);
  }, [filteredRows]);

  const maxChartValue = useMemo(() => {
    return Math.max(1, ...chartRows.flatMap((row) => [row.cntDrvDuration, row.distance]));
  }, [chartRows]);

  return (
    <DashboardShell
      title={dashboardName}
      subtitle={organizationName ? `${organizationName} • Driving` : 'Driving'}
      lang={lang}
      lastUpdated={lastUpdated}
      notes={dashboardNotes}
    >
      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <LoadingState message="Loading driving dashboard data..." />
      ) : (
      <>
      <FilterGroup label="Driver" count={driverFilters.length} onClear={() => setDriverFilters([])} lang={lang}>
        {driverOptions.map((driverName) => (
          <FilterChip
            key={driverName}
            className={driverFilters.includes(driverName) ? undefined : chipMutedClassName}
            onClick={() => {
              setDriverFilters((current) =>
                current.includes(driverName)
                  ? current.filter((value) => value !== driverName)
                  : [...current, driverName],
              );
            }}
          >
            {driverName}
          </FilterChip>
        ))}
      </FilterGroup>

      <FilterGroup
        label="Date range"
        onClear={() => {
          setStartDate('');
          setEndDate('');
        }}
        lang={lang}
      >
        <label className="text-sm text-slate-600 dark:text-slate-300">Start</label>
        <input
          type="date"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
        <label className="text-sm text-slate-600 dark:text-slate-300">End</label>
        <input
          type="date"
          value={endDate}
          onChange={(event) => setEndDate(event.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
      </FilterGroup>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className={dashboardSectionClass}>
          <p className="text-sm text-slate-500 dark:text-slate-400">Total Cnt Drv Duration</p>
          <p className="mt-2 text-3xl font-semibold">{fmt.format(kpis.totalCntDrvDuration)}</p>
        </article>
        <article className={dashboardSectionClass}>
          <p className="text-sm text-slate-500 dark:text-slate-400">Total Distance</p>
          <p className="mt-2 text-3xl font-semibold">{fmt.format(kpis.totalDistance)} km</p>
        </article>
        <article className={dashboardSectionClass}>
          <p className="text-sm text-slate-500 dark:text-slate-400">Trips</p>
          <p className="mt-2 text-3xl font-semibold">{fmt.format(kpis.trips)}</p>
        </article>
        <article className={dashboardSectionClass}>
          <p className="text-sm text-slate-500 dark:text-slate-400">Avg Cnt Drv Duration</p>
          <p className="mt-2 text-3xl font-semibold">{fmt.format(kpis.avgCntDrvDuration)}</p>
        </article>
      </section>

      <section className={dashboardSectionClass}>
        <h2 className="text-lg font-medium">Driver comparison (Cnt Drv Duration vs Distance)</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Top 12 drivers by Cnt Drv duration in selected range.</p>
        <div className="mt-6 space-y-4">
          {chartRows.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No data available for current filters.</p>
          ) : (
            chartRows.map((row) => (
              <div key={row.label} className="space-y-1">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{row.label}</p>
                <div className="grid gap-1">
                  <div
                    className="h-3 rounded-full bg-indigo-500"
                    style={{ width: `${(row.cntDrvDuration / maxChartValue) * 100}%` }}
                    title={`Cnt Drv Duration: ${fmt.format(row.cntDrvDuration)}`}
                  />
                  <div
                    className="h-3 rounded-full bg-cyan-500"
                    style={{ width: `${(row.distance / maxChartValue) * 100}%` }}
                    title={`Distance: ${fmt.format(row.distance)} km`}
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cnt Drv Duration {fmt.format(row.cntDrvDuration)} • Distance {fmt.format(row.distance)} km
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className={dashboardSectionClass}>
        <h2 className="text-lg font-medium">Driving records</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Table of filtered Cnt Drv duration rows.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Driver</th>
                <th className="px-3 py-2 text-right">Cnt Drv Duration</th>
                <th className="px-3 py-2 text-right">Distance (km)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRows.slice(0, 300).map((row, index) => (
                <tr key={`${row.driverName}-${row.date.getTime()}-${index}`}>
                  <td className="px-3 py-2">{row.dateLabel}</td>
                  <td className="px-3 py-2">{row.driverName}</td>
                  <td className="px-3 py-2 text-right">{fmt.format(row.cntDrvDuration)}</td>
                  <td className="px-3 py-2 text-right">{fmt.format(row.distance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRows.length > 300 ? (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Showing first 300 rows out of {fmt.format(filteredRows.length)} filtered rows.
            </p>
          ) : null}
        </div>
      </section>
      </>
      )}
    </DashboardShell>
  );
}

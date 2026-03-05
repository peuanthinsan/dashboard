'use client';

import { useMemo, useState } from 'react';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import LoadingState from './LoadingState';
import useGoogleSheet from './useGoogleSheet';
import { findValue, normalizeLabel, parseDate } from './dashboardDataUtils';
import { formatDateTimeGB } from './dateFormat';
import type { DashboardLang } from 'app/dashboard/i18n-copy';

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
  id: string;
  driver: string;
  vehicle: string;
  startTime: string;
  endTime: string;
  startLocation: string;
  endLocation: string;
  distance: number;
  cntDrvDuration: number;
  alertType: string;
  fleet: string;
  parsedDate: Date | null;
};

const parseNumberValue = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (value == null) return 0;
  const cleaned = String(value).replace(/,/g, '').trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toDisplay = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '—';
};

export default function DrivingDashboard({
  dashboardName,
  sheetId,
  sheetGid,
  dashboardNotes,
  organizationName,
  lang = 'en',
}: DashboardProps) {
  const { rows, loading, error, lastUpdated } = useGoogleSheet({ sheetId, gid: sheetGid });
  const [driverFilter, setDriverFilter] = useState('all');

  const normalizedOrganizationName = useMemo(
    () => (organizationName ? normalizeLabel(organizationName) : null),
    [organizationName],
  );

  const parsedRows = useMemo<DrivingRow[]>(() => {
    return rows
      .map((row, index) => {
        const dateValue =
          findValue(row, ['DateTime', 'Start Time', 'Date']) ??
          findValue(row, ['Track Time', 'Alert Date Time']);

        return {
          id: String(findValue(row, ['SlNo']) ?? index + 1),
          driver: String(findValue(row, ['Driver Name']) ?? ''),
          vehicle: String(findValue(row, ['Vehicle No']) ?? ''),
          startTime: String(findValue(row, ['Start Time']) ?? ''),
          endTime: String(findValue(row, ['End Time']) ?? ''),
          startLocation: String(findValue(row, ['Start Location']) ?? ''),
          endLocation: String(findValue(row, ['End Location']) ?? ''),
          distance: parseNumberValue(findValue(row, ['Distance'])),
          cntDrvDuration: parseNumberValue(findValue(row, ['Cnt Drv duration', 'Cnt Drv Duration'])),
          alertType: String(findValue(row, ['Alert Type']) ?? ''),
          fleet: String(findValue(row, ['Fleet']) ?? ''),
          parsedDate: parseDate(dateValue),
        };
      })
      .filter((row) => row.cntDrvDuration > 0)
      .filter((row) => {
        if (!normalizedOrganizationName) return true;
        return normalizeLabel(row.fleet) === normalizedOrganizationName;
      });
  }, [normalizedOrganizationName, rows]);

  const driverOptions = useMemo(() => {
    const drivers = new Set<string>();
    parsedRows.forEach((row) => {
      if (row.driver.trim()) drivers.add(row.driver.trim());
    });
    return Array.from(drivers).sort((a, b) => a.localeCompare(b));
  }, [parsedRows]);

  const filteredRows = useMemo(() => {
    let nextRows = parsedRows;
    if (driverFilter !== 'all') {
      nextRows = nextRows.filter((row) => row.driver === driverFilter);
    }
    return [...nextRows].sort((a, b) => {
      const aTime = a.parsedDate?.getTime() ?? 0;
      const bTime = b.parsedDate?.getTime() ?? 0;
      return bTime - aTime;
    });
  }, [driverFilter, parsedRows]);

  const chartRows = useMemo(() => filteredRows.slice(0, 24), [filteredRows]);
  const maxDuration = useMemo(
    () => Math.max(1, ...chartRows.map((row) => row.cntDrvDuration)),
    [chartRows],
  );

  const stats = useMemo(() => {
    const over4 = filteredRows.filter((row) => row.cntDrvDuration > 4).length;
    const over9 = filteredRows.filter((row) => row.cntDrvDuration > 9).length;
    const avgDuration =
      filteredRows.length > 0
        ? filteredRows.reduce((sum, row) => sum + row.cntDrvDuration, 0) / filteredRows.length
        : 0;
    return { over4, over9, avgDuration };
  }, [filteredRows]);

  if (loading) {
    return <LoadingState message={lang === 'th' ? 'กำลังโหลดแดชบอร์ดการขับขี่...' : 'Loading driving dashboard...'} />;
  }

  if (error) {
    return (
      <DashboardShell
        title={dashboardName}
        subtitle={lang === 'th' ? 'แดชบอร์ดการขับขี่' : 'Driving dashboard'}
        lastUpdated={lastUpdated}
        notes={dashboardNotes}
      >
        <section className={dashboardSectionClass}>
          <p className="text-sm text-red-500">{error}</p>
        </section>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title={dashboardName}
      subtitle={lang === 'th' ? 'แดชบอร์ดการขับขี่' : 'Driving dashboard'}
      lastUpdated={lastUpdated}
      notes={dashboardNotes}
    >
      <section className="grid gap-4 md:grid-cols-3">
        <article className={dashboardSectionClass}>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Cnt Drv &gt; 4 Hrs</p>
          <p className="mt-2 text-3xl font-semibold">{stats.over4}</p>
        </article>
        <article className={dashboardSectionClass}>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Cnt Drv &gt; 9 Hrs</p>
          <p className="mt-2 text-3xl font-semibold">{stats.over9}</p>
        </article>
        <article className={dashboardSectionClass}>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Avg Cnt Drv duration</p>
          <p className="mt-2 text-3xl font-semibold">{stats.avgDuration.toFixed(2)}</p>
        </article>
      </section>

      <section className={dashboardSectionClass}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Cnt Drv duration (latest 24 trips)</h2>
            <p className="text-sm text-slate-500">Bar graph from Google Sheet driving data.</p>
          </div>
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">Driver</span>
            <select
              value={driverFilter}
              onChange={(event) => setDriverFilter(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="all">All drivers</option>
              {driverOptions.map((driver) => (
                <option key={driver} value={driver}>
                  {driver}
                </option>
              ))}
            </select>
          </label>
        </div>

        {chartRows.length === 0 ? (
          <p className="text-sm text-slate-500">No Cnt Drv duration data found.</p>
        ) : (
          <div className="overflow-x-auto pb-3">
            <div className="flex min-w-[920px] items-end gap-3">
              {chartRows.map((row) => {
                const heightPct = (row.cntDrvDuration / maxDuration) * 100;
                return (
                  <div key={`${row.id}-${row.startTime}`} className="flex w-9 flex-col items-center gap-2">
                    <span className="text-[11px] text-slate-500">{row.cntDrvDuration.toFixed(2)}</span>
                    <div className="relative flex h-64 w-full items-end rounded-t-md bg-slate-100 dark:bg-slate-800">
                      <div
                        className="w-full rounded-t-md bg-cyan-600"
                        style={{ height: `${Math.max(heightPct, 2)}%` }}
                        title={`${row.driver}: ${row.cntDrvDuration.toFixed(2)}`}
                      />
                    </div>
                    <span className="line-clamp-2 text-center text-[10px] text-slate-500" title={`${row.driver} (${row.vehicle})`}>
                      {row.driver || row.vehicle}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className={dashboardSectionClass}>
        <h2 className="text-lg font-semibold">Driving details</h2>
        <p className="text-sm text-slate-500">Showing {filteredRows.length} records from the selected sheet.</p>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700">
                <th className="px-3 py-2">Driver</th>
                <th className="px-3 py-2">Vehicle</th>
                <th className="px-3 py-2">Start Time</th>
                <th className="px-3 py-2">End Time</th>
                <th className="px-3 py-2">Distance</th>
                <th className="px-3 py-2">Cnt Drv duration</th>
                <th className="px-3 py-2">Alert Type</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.slice(0, 100).map((row) => (
                <tr key={`${row.id}-${row.startTime}-table`} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-2">{toDisplay(row.driver)}</td>
                  <td className="px-3 py-2">{toDisplay(row.vehicle)}</td>
                  <td className="px-3 py-2">{row.parsedDate ? formatDateTimeGB(row.parsedDate) : toDisplay(row.startTime)}</td>
                  <td className="px-3 py-2">{toDisplay(row.endTime)}</td>
                  <td className="px-3 py-2">{row.distance.toFixed(0)}</td>
                  <td className="px-3 py-2 font-semibold text-cyan-700 dark:text-cyan-300">{row.cntDrvDuration.toFixed(2)}</td>
                  <td className="px-3 py-2">{toDisplay(row.alertType)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  );
}

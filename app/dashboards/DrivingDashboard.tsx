'use client';

import { useMemo, useState } from 'react';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import LoadingState from './LoadingState';
import useGoogleSheet from './useGoogleSheet';
import { findValue, parseDate, toDisplayString } from './dashboardDataUtils';
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
  duration: number;
  distance: number;
  date: Date | null;
  dateLabel: string;
};

const DEFAULT_DRIVING_SHEET_ID = '163ouJ7fsWiVXzrkKq1CssL47wM0V3G3WxHCBZSpJMZw';
const DEFAULT_DRIVING_SHEET_GID = '412401625';

const parseNumericValue = (value: unknown) => {
  if (value == null || value === '') return 0;
  const normalized = String(value).replace(/,/g, '').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function DrivingDashboard({
  dashboardId,
  dashboardName,
  sheetId,
  sheetGid,
  dashboardNotes,
  organizationName,
  lang = 'en',
}: DashboardProps) {
  const effectiveSheetId = sheetId || DEFAULT_DRIVING_SHEET_ID;
  const effectiveGid = sheetGid || DEFAULT_DRIVING_SHEET_GID;
  const { rows, loading, error, lastUpdated } = useGoogleSheet({ sheetId: effectiveSheetId, gid: effectiveGid });

  const drivingRows = useMemo<DrivingRow[]>(() => {
    return rows.map((row) => {
      const dateValue = findValue(row, ['Date', 'Track Time', 'Alert Date Time']);
      const parsedDate = parseDate(dateValue);
      return {
        driver: toDisplayString(findValue(row, ['Driver Name', 'Driver'])),
        duration: parseNumericValue(findValue(row, ['Cnt Drv Duration', 'CntDrvDuration', 'Driving Duration'])),
        distance: parseNumericValue(findValue(row, ['Cnt Drv Distance', 'CntDrvDistance', 'Driving Distance'])),
        date: parsedDate,
        dateLabel: parsedDate ? parsedDate.toLocaleDateString('en-GB') : '—',
      };
    });
  }, [rows]);

  const [driverFilter, setDriverFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const driverOptions = useMemo(() => {
    return Array.from(new Set(drivingRows.map((row) => row.driver).filter((driver) => driver !== '—'))).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [drivingRows]);

  const filteredRows = useMemo(() => {
    return drivingRows.filter((row) => {
      if (driverFilter && row.driver !== driverFilter) return false;
      if (startDate) {
        if (!row.date) return false;
        const start = new Date(`${startDate}T00:00:00`);
        if (row.date < start) return false;
      }
      if (endDate) {
        if (!row.date) return false;
        const end = new Date(`${endDate}T23:59:59`);
        if (row.date > end) return false;
      }
      return true;
    });
  }, [drivingRows, driverFilter, startDate, endDate]);

  const summary = useMemo(() => {
    const totalDuration = filteredRows.reduce((sum, row) => sum + row.duration, 0);
    const totalDistance = filteredRows.reduce((sum, row) => sum + row.distance, 0);
    const uniqueDrivers = new Set(filteredRows.map((row) => row.driver).filter((driver) => driver !== '—')).size;
    return {
      totalDuration,
      totalDistance,
      totalTrips: filteredRows.length,
      uniqueDrivers,
    };
  }, [filteredRows]);

  const byDriver = useMemo(() => {
    const grouped = new Map<string, { driver: string; duration: number; distance: number }>();
    filteredRows.forEach((row) => {
      const key = row.driver;
      const current = grouped.get(key) ?? { driver: key, duration: 0, distance: 0 };
      current.duration += row.duration;
      current.distance += row.distance;
      grouped.set(key, current);
    });
    return Array.from(grouped.values()).sort((a, b) => b.duration - a.duration).slice(0, 12);
  }, [filteredRows]);

  const maxDuration = useMemo(() => Math.max(1, ...byDriver.map((row) => row.duration)), [byDriver]);
  const maxDistance = useMemo(() => Math.max(1, ...byDriver.map((row) => row.distance)), [byDriver]);

  return (
    <DashboardShell
      title={dashboardName}
      subtitle={lang === 'th' ? 'แดชบอร์ดการขับขี่' : 'Driving dashboard'}
      lang={lang}
      lastUpdated={lastUpdated}
      notes={dashboardNotes ?? `Google Sheet source: ${effectiveSheetId} (gid: ${effectiveGid})`}
    >
      {loading ? (
        <LoadingState
          message={lang === 'th' ? 'กำลังโหลดข้อมูลการขับขี่…' : 'Loading driving data…'}
          detail={lang === 'th' ? 'กำลังดึงค่า Cnt Drv Duration และ Cnt Drv Distance' : 'Fetching Cnt Drv Duration and Cnt Drv Distance'}
        />
      ) : null}

      {error ? (
        <section className={`${dashboardSectionClass} border-rose-300 bg-rose-50/80 text-rose-900 dark:border-rose-500/50 dark:bg-rose-900/20 dark:text-rose-100`}>
          <h2 className="text-lg font-medium">Failed to load driving data</h2>
          <p className="mt-2 text-sm">{error}</p>
        </section>
      ) : null}

      {!loading && !error ? (
        <>
          <section className={dashboardSectionClass}>
            <h2 className="text-lg font-medium">Filters</h2>
            {organizationName ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Organization: {organizationName}</p> : null}
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="text-sm">
                <span className="mb-1 block font-medium">Driver name</span>
                <select
                  value={driverFilter}
                  onChange={(event) => setDriverFilter(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="">All drivers</option>
                  {driverOptions.map((driver) => (
                    <option key={driver} value={driver}>
                      {driver}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                <span className="mb-1 block font-medium">Start date</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block font-medium">End date</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                />
              </label>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <article className={dashboardSectionClass}>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total trips</p>
              <p className="mt-2 text-3xl font-semibold">{summary.totalTrips.toLocaleString()}</p>
            </article>
            <article className={dashboardSectionClass}>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total duration</p>
              <p className="mt-2 text-3xl font-semibold">{summary.totalDuration.toLocaleString()}</p>
            </article>
            <article className={dashboardSectionClass}>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total distance</p>
              <p className="mt-2 text-3xl font-semibold">{summary.totalDistance.toLocaleString()}</p>
            </article>
            <article className={dashboardSectionClass}>
              <p className="text-sm text-slate-500 dark:text-slate-400">Drivers</p>
              <p className="mt-2 text-3xl font-semibold">{summary.uniqueDrivers.toLocaleString()}</p>
            </article>
          </section>

          <section className={dashboardSectionClass}>
            <h2 className="text-lg font-medium">Driver totals (bar graph)</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Duration (cyan) and distance (violet) by driver.</p>
            <div className="mt-6 space-y-4">
              {byDriver.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No data in selected filters.</p>
              ) : (
                byDriver.map((row) => {
                  const durationPct = (row.duration / maxDuration) * 100;
                  const distancePct = (row.distance / maxDistance) * 100;
                  return (
                    <div key={row.driver} className="space-y-1">
                      <p className="text-sm font-medium">{row.driver}</p>
                      <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-800">
                        <div className="h-3 rounded-full bg-cyan-500" style={{ width: `${Math.max(2, durationPct)}%` }} />
                      </div>
                      <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-800">
                        <div className="h-3 rounded-full bg-violet-500" style={{ width: `${Math.max(2, distancePct)}%` }} />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Duration: {row.duration.toLocaleString()} | Distance: {row.distance.toLocaleString()}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className={dashboardSectionClass}>
            <h2 className="text-lg font-medium">Driving rows</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Filtered by driver/date. Includes Cnt Drv Duration and distance.</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <th className="px-2 py-2">Date</th>
                    <th className="px-2 py-2">Driver</th>
                    <th className="px-2 py-2">Cnt Drv Duration</th>
                    <th className="px-2 py-2">Cnt Drv Distance</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.slice(0, 500).map((row, index) => (
                    <tr key={`${row.driver}-${row.dateLabel}-${index}`} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="px-2 py-2">{row.dateLabel}</td>
                      <td className="px-2 py-2">{row.driver}</td>
                      <td className="px-2 py-2">{row.duration.toLocaleString()}</td>
                      <td className="px-2 py-2">{row.distance.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </DashboardShell>
  );
}

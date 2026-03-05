'use client';

import { useMemo } from 'react';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import LoadingState from './LoadingState';
import useGoogleSheet from './useGoogleSheet';
import { getDashboardCopy, type DashboardLang } from 'app/dashboard/i18n-copy';
import { findValue, normalizeLabel, toDisplayString } from './dashboardDataUtils';

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
  driverName: string;
  vehicleNo: string;
  startTime: string;
  endTime: string;
  startLocation: string;
  endLocation: string;
  distance: number;
  cntDrvDuration: number;
};

const parseNumber = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim().replace(/,/g, ''));
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
};

const normalizeHeader = (value: string) => normalizeLabel(value).replace(/\s+/g, '');

const findDrivingValue = (row: Record<string, unknown>, labels: string[]) => {
  const directValue = findValue(row, labels);
  if (directValue != null) return directValue;

  const keyMap = new Map<string, string>();
  Object.keys(row).forEach((key) => {
    const normalized = normalizeHeader(key);
    if (!keyMap.has(normalized)) {
      keyMap.set(normalized, key);
    }
  });

  for (const label of labels) {
    const key = keyMap.get(normalizeHeader(label));
    if (key) return row[key];
  }
  return null;
};

const MAX_BARS = 25;

export default function DrivingDashboard({
  dashboardName,
  sheetId,
  sheetGid,
  dashboardNotes,
  organizationName,
  lang = 'en',
}: DashboardProps) {
  const copy = getDashboardCopy(lang);
  const { rows, loading, error, lastUpdated, refresh } = useGoogleSheet({ sheetId, gid: sheetGid });

  const dataRows = useMemo<DrivingRow[]>(() => {
    return rows
      .map((row, index) => {
        const driverName = toDisplayString(findDrivingValue(row, ['Driver Name', 'DriverName']));
        const vehicleNo = toDisplayString(findDrivingValue(row, ['Vehicle No', 'Vehicle']));
        const startTime = toDisplayString(findDrivingValue(row, ['Start Time']));
        const endTime = toDisplayString(findDrivingValue(row, ['End Time']));
        const startLocation = toDisplayString(findDrivingValue(row, ['Start Location']));
        const endLocation = toDisplayString(findDrivingValue(row, ['End Location']));
        const distance = parseNumber(findDrivingValue(row, ['Distance']));
        const cntDrvDuration = parseNumber(findDrivingValue(row, ['Cnt Drv duration', 'Cnt Drv Duration']));

        return {
          id: `${index}-${driverName}-${vehicleNo}`,
          driverName,
          vehicleNo,
          startTime,
          endTime,
          startLocation,
          endLocation,
          distance,
          cntDrvDuration,
        };
      })
      .filter((row) => row.cntDrvDuration > 0)
      .sort((a, b) => b.cntDrvDuration - a.cntDrvDuration);
  }, [rows]);

  const chartRows = useMemo(() => dataRows.slice(0, MAX_BARS), [dataRows]);
  const maxDuration = useMemo(
    () => chartRows.reduce((max, row) => Math.max(max, row.cntDrvDuration), 0),
    [chartRows],
  );

  return (
    <DashboardShell
      title={dashboardName}
      subtitle={lang === 'th' ? 'แดชบอร์ดการขับขี่' : 'Driving dashboard'}
      lang={lang}
      lastUpdated={lastUpdated}
      notes={dashboardNotes}
      actions={
        <button
          type="button"
          onClick={() => refresh()}
          className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Refresh
        </button>
      }
    >
      {loading ? (
        <LoadingState message={lang === 'th' ? 'กำลังโหลดข้อมูลแดชบอร์ด…' : 'Loading dashboard data…'} detail={copy.loadingDetail} />
      ) : null}

      {error ? (
        <section className={dashboardSectionClass}>
          <p className="text-sm font-medium text-rose-600">{error}</p>
        </section>
      ) : null}

      {!loading && !error ? (
        <>
          <section className={dashboardSectionClass}>
            <h2 className="text-lg font-medium">Cnt Drv duration by trip</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Top {chartRows.length} records ranked by Cnt Drv duration.
              {organizationName ? ` Fleet: ${organizationName}` : ''}
            </p>
            {chartRows.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No Cnt Drv duration data found in this sheet.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <svg viewBox={`0 0 ${Math.max(960, chartRows.length * 56)} 360`} className="h-[360px] w-full min-w-[960px]">
                  <line x1="56" y1="320" x2={Math.max(900, chartRows.length * 56)} y2="320" stroke="#94a3b8" strokeWidth="1" />
                  {chartRows.map((row, index) => {
                    const chartHeight = 250;
                    const barHeight = maxDuration === 0 ? 0 : (row.cntDrvDuration / maxDuration) * chartHeight;
                    const x = 70 + index * 52;
                    const y = 320 - barHeight;
                    return (
                      <g key={row.id}>
                        <rect x={x} y={y} width="32" height={barHeight} rx="4" fill="#0f766e" />
                        <text x={x + 16} y={y - 6} textAnchor="middle" className="fill-slate-700 text-[11px] dark:fill-slate-300">
                          {row.cntDrvDuration.toFixed(2)}
                        </text>
                        <text
                          x={x + 16}
                          y="338"
                          textAnchor="end"
                          transform={`rotate(-35 ${x + 16} 338)`}
                          className="fill-slate-500 text-[10px] dark:fill-slate-400"
                        >
                          {row.driverName}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </section>

          <section className={dashboardSectionClass}>
            <h2 className="text-lg font-medium">Driving records</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-800">
                <thead className="bg-slate-100/80 text-xs uppercase tracking-[0.2em] text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-3">Driver</th>
                    <th className="px-3 py-3">Vehicle No</th>
                    <th className="px-3 py-3">Start Time</th>
                    <th className="px-3 py-3">End Time</th>
                    <th className="px-3 py-3">Start Location</th>
                    <th className="px-3 py-3">End Location</th>
                    <th className="px-3 py-3 text-right">Distance</th>
                    <th className="px-3 py-3 text-right">Cnt Drv duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {dataRows.slice(0, 100).map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-3">{row.driverName}</td>
                      <td className="px-3 py-3">{row.vehicleNo}</td>
                      <td className="px-3 py-3">{row.startTime}</td>
                      <td className="px-3 py-3">{row.endTime}</td>
                      <td className="max-w-[220px] truncate px-3 py-3" title={row.startLocation}>{row.startLocation}</td>
                      <td className="max-w-[220px] truncate px-3 py-3" title={row.endLocation}>{row.endLocation}</td>
                      <td className="px-3 py-3 text-right">{row.distance.toFixed(0)}</td>
                      <td className="px-3 py-3 text-right font-semibold">{row.cntDrvDuration.toFixed(2)}</td>
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

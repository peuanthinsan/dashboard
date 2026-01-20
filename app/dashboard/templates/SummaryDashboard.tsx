'use client';

import { useMemo } from 'react';
import useGoogleSheet from '../hooks/useGoogleSheet';

const normalizeLabel = (label: string) => (label ? label.trim().toLowerCase() : '');

const buildColumnFinder =
  (columns: { label: string; field: string }[]) =>
  ({ matches, fallbackIndex }: { matches: string[]; fallbackIndex?: number }) => {
    const match = columns.find((column) => {
      const label = normalizeLabel(column.label);
      return matches.some((target) => label === target || label.includes(target));
    });
    if (match) return match;
    if (fallbackIndex == null) return null;
    return columns[fallbackIndex] || null;
  };

const formatDateLabel = (value: string | Date | null) => {
  if (!value) return 'Unspecified';
  if (value instanceof Date) {
    return value.toLocaleDateString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toLocaleDateString();
};

type SummaryDashboardProps = {
  name: string;
  sheetUrl: string;
};

export default function SummaryDashboard({ name, sheetUrl }: SummaryDashboardProps) {
  const { columns, records, loading, error, lastUpdated, refresh } = useGoogleSheet({ sheetUrl });

  const findColumn = useMemo(() => buildColumnFinder(columns), [columns]);
  const vehicleColumn = useMemo(
    () =>
      findColumn({
        matches: ['vehicle no', 'vehicle number', 'vehicle'],
        fallbackIndex: 0,
      }),
    [findColumn],
  );
  const alertTypeColumn = useMemo(
    () =>
      findColumn({
        matches: ['alert type', 'alert'],
        fallbackIndex: 2,
      }),
    [findColumn],
  );
  const remarkColumn = useMemo(
    () =>
      findColumn({
        matches: ['remarks', 'remark'],
        fallbackIndex: null,
      }),
    [findColumn],
  );
  const dateColumn = useMemo(
    () =>
      findColumn({
        matches: ['alert date time', 'track time', 'date'],
        fallbackIndex: null,
      }),
    [findColumn],
  );

  const summary = useMemo(() => {
    const vehicles = new Set<string>();
    const alerts = new Map<string, number>();
    const remarks = new Map<string, number>();
    const daily = new Map<string, number>();
    records.forEach((record) => {
      if (vehicleColumn) {
        const value = record[vehicleColumn.field];
        if (value) {
          vehicles.add(String(value));
        }
      }
      if (alertTypeColumn) {
        const value = record[alertTypeColumn.field];
        if (value) {
          const key = String(value);
          alerts.set(key, (alerts.get(key) ?? 0) + 1);
        }
      }
      if (remarkColumn) {
        const value = record[remarkColumn.field];
        if (value) {
          const key = String(value);
          remarks.set(key, (remarks.get(key) ?? 0) + 1);
        }
      }
      if (dateColumn) {
        const value = record[dateColumn.field];
        const dateKey = value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '');
        if (dateKey) {
          daily.set(dateKey, (daily.get(dateKey) ?? 0) + 1);
        }
      }
    });
    const topAlert = Array.from(alerts.entries()).sort((a, b) => b[1] - a[1])[0];
    const topRemark = Array.from(remarks.entries()).sort((a, b) => b[1] - a[1])[0];
    const dailySeries = Array.from(daily.entries())
      .map(([dateKey, total]) => ({ dateKey, total }))
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
      .slice(-10);
    return {
      vehicleCount: vehicles.size,
      totalAlerts: records.length,
      topAlert,
      topRemark,
      dailySeries,
    };
  }, [alertTypeColumn, dateColumn, remarkColumn, records, vehicleColumn]);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">{name}</h1>
            <p className="text-sm text-slate-300">
              Summary view highlighting alert totals, vehicles, and top alert categories.
            </p>
            {lastUpdated ? (
              <p className="text-xs text-slate-500">Last updated {lastUpdated.toLocaleString()}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={refresh}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-white hover:border-slate-500"
          >
            Refresh data
          </button>
        </header>

        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
        ) : null}

        {loading ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
            Loading dashboard data...
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <p className="text-xs uppercase tracking-wide text-slate-400">Total alerts</p>
                <p className="mt-2 text-3xl font-semibold">{summary.totalAlerts.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <p className="text-xs uppercase tracking-wide text-slate-400">Active vehicles</p>
                <p className="mt-2 text-3xl font-semibold">{summary.vehicleCount.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <p className="text-xs uppercase tracking-wide text-slate-400">Top alert type</p>
                <p className="mt-2 text-lg font-semibold">
                  {summary.topAlert ? summary.topAlert[0] : 'No data'}
                </p>
                {summary.topAlert ? (
                  <p className="text-xs text-slate-400">{summary.topAlert[1]} alerts</p>
                ) : null}
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <p className="text-xs uppercase tracking-wide text-slate-400">Top remark</p>
                <p className="mt-2 text-lg font-semibold">{summary.topRemark ? summary.topRemark[0] : 'No data'}</p>
                {summary.topRemark ? (
                  <p className="text-xs text-slate-400">{summary.topRemark[1]} alerts</p>
                ) : null}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <div className="flex flex-col gap-2">
                <h2 className="text-lg font-semibold">Recent daily activity</h2>
                <p className="text-sm text-slate-400">
                  Last {summary.dailySeries.length} days of alert totals based on the sheet data.
                </p>
              </div>
              {summary.dailySeries.length === 0 ? (
                <p className="mt-4 text-sm text-slate-400">No date data is available in the sheet yet.</p>
              ) : (
                <div className="mt-4 grid gap-2">
                  {summary.dailySeries.map((entry) => (
                    <div key={entry.dateKey} className="flex items-center gap-4">
                      <div className="w-28 text-xs text-slate-400">{formatDateLabel(entry.dateKey)}</div>
                      <div className="flex-1 rounded-full bg-slate-800">
                        <div
                          className="h-2 rounded-full bg-indigo-400"
                          style={{
                            width: `${Math.min(100, (entry.total / summary.totalAlerts) * 100 || 0)}%`,
                          }}
                        />
                      </div>
                      <div className="w-14 text-right text-xs text-slate-300">{entry.total}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <h2 className="text-lg font-semibold">Recent alerts preview</h2>
              <p className="text-sm text-slate-400">
                A quick look at the latest entries from the connected Google Sheet.
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm text-slate-200">
                  <thead className="border-b border-slate-800 text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Vehicle</th>
                      <th className="px-3 py-2 text-left">Alert type</th>
                      <th className="px-3 py-2 text-left">Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.slice(0, 6).map((record, index) => (
                      <tr key={`${index}-preview`} className="border-b border-slate-900/80">
                        <td className="px-3 py-2 text-slate-300">
                          {dateColumn ? formatDateLabel(record[dateColumn.field] as string | Date | null) : '—'}
                        </td>
                        <td className="px-3 py-2">{vehicleColumn ? String(record[vehicleColumn.field] ?? '—') : '—'}</td>
                        <td className="px-3 py-2">
                          {alertTypeColumn ? String(record[alertTypeColumn.field] ?? '—') : '—'}
                        </td>
                        <td className="px-3 py-2">
                          {remarkColumn ? String(record[remarkColumn.field] ?? '—') : '—'}
                        </td>
                      </tr>
                    ))}
                    {records.length === 0 ? (
                      <tr>
                        <td className="px-3 py-4 text-sm text-slate-400" colSpan={4}>
                          No rows available in the sheet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

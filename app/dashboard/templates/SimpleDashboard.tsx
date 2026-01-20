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
    return value.toLocaleString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toLocaleString();
};

type SimpleDashboardProps = {
  name: string;
  sheetUrl: string;
};

export default function SimpleDashboard({ name, sheetUrl }: SimpleDashboardProps) {
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

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">{name}</h1>
            <p className="text-sm text-slate-300">Simple view for quickly scanning recent alerts.</p>
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

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          {loading ? (
            <p className="text-sm text-slate-400">Loading dashboard data...</p>
          ) : (
            <div className="overflow-x-auto">
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
                  {records.slice(0, 15).map((record, index) => (
                    <tr key={`${index}-simple`} className="border-b border-slate-900/80">
                      <td className="px-3 py-2 text-slate-300">
                        {dateColumn ? formatDateLabel(record[dateColumn.field] as string | Date | null) : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {vehicleColumn ? String(record[vehicleColumn.field] ?? '—') : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {alertTypeColumn ? String(record[alertTypeColumn.field] ?? '—') : '—'}
                      </td>
                      <td className="px-3 py-2">{remarkColumn ? String(record[remarkColumn.field] ?? '—') : '—'}</td>
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
          )}
        </section>
      </div>
    </div>
  );
}

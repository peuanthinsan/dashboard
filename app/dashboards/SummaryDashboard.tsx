'use client';

import { useMemo } from 'react';
import useGoogleSheet from './useGoogleSheet';

type DashboardProps = {
  dashboardName: string;
  sheetId: string;
  sheetGid: string;
};

const normalizeLabel = (value: string) => value.trim().toLowerCase();

const findValue = (row: Record<string, any>, labels: string[]) => {
  const target = labels.map((label) => normalizeLabel(label));
  const key = Object.keys(row).find((candidate) => target.includes(normalizeLabel(candidate)));
  return key ? row[key] : null;
};

const buildCounts = (rows: Record<string, any>[], labels: string[]) => {
  const totals = new Map<string, number>();
  rows.forEach((row) => {
    const value = findValue(row, labels);
    if (!value) return;
    const key = String(value).trim() || 'Unspecified';
    totals.set(key, (totals.get(key) ?? 0) + 1);
  });
  return Array.from(totals.entries())
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total);
};

const Bar = ({ value, max }: { value: number; max: number }) => {
  const width = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="h-2 w-full rounded-full bg-slate-800">
      <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${width}%` }} />
    </div>
  );
};

export default function SummaryDashboard({ dashboardName, sheetId, sheetGid }: DashboardProps) {
  const { rows, loading, error, lastUpdated, refresh } = useGoogleSheet({ sheetId, gid: sheetGid });

  const alertTypeSummary = useMemo(() => buildCounts(rows, ['Alert Type']), [rows]);
  const fleetSummary = useMemo(() => buildCounts(rows, ['Fleet']), [rows]);
  const topAlertTypes = alertTypeSummary.slice(0, 6);
  const topFleets = fleetSummary.slice(0, 6);
  const maxAlertTotal = topAlertTypes[0]?.total ?? 0;
  const maxFleetTotal = topFleets[0]?.total ?? 0;

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Summary dashboard</p>
            <h1 className="text-3xl font-semibold">{dashboardName}</h1>
            {lastUpdated ? (
              <p className="mt-1 text-xs text-slate-400">Last updated {lastUpdated.toLocaleString()}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={refresh}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-white hover:border-slate-500"
          >
            Refresh data
          </button>
        </header>

        {error ? (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
            Loading summary…
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
              <h2 className="text-lg font-medium">Alert type volume</h2>
              <p className="text-sm text-slate-400">
                See which alert categories are appearing most frequently in the sheet.
              </p>
              <div className="mt-4 space-y-3">
                {topAlertTypes.length === 0 ? (
                  <p className="text-sm text-slate-400">No alert types found.</p>
                ) : (
                  topAlertTypes.map((row) => (
                    <div key={row.label} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-200">{row.label}</span>
                        <span className="text-slate-400">{row.total}</span>
                      </div>
                      <Bar value={row.total} max={maxAlertTotal} />
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
              <h2 className="text-lg font-medium">Fleet volume</h2>
              <p className="text-sm text-slate-400">Fleet distribution based on alert activity.</p>
              <div className="mt-4 space-y-3">
                {topFleets.length === 0 ? (
                  <p className="text-sm text-slate-400">No fleet data available.</p>
                ) : (
                  topFleets.map((row) => (
                    <div key={row.label} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-200">{row.label}</span>
                        <span className="text-slate-400">{row.total}</span>
                      </div>
                      <Bar value={row.total} max={maxFleetTotal} />
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg lg:col-span-2">
              <h2 className="text-lg font-medium">Latest alert samples</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {rows.slice(0, 9).map((row, index) => {
                  const vehicle = findValue(row, ['Vehicle No']);
                  const alertType = findValue(row, ['Alert Type']);
                  const driver = findValue(row, ['Driver Name']);
                  return (
                    <div key={`${vehicle}-${index}`} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Vehicle</div>
                      <div className="text-base font-semibold text-white">{vehicle ?? '—'}</div>
                      <div className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">Alert</div>
                      <div className="text-sm text-slate-200">{alertType ?? '—'}</div>
                      <div className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">Driver</div>
                      <div className="text-sm text-slate-300">{driver ?? '—'}</div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

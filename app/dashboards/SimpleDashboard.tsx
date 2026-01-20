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

const parseDate = (value: unknown) => {
  if (!value) return null;
  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

export default function SimpleDashboard({ dashboardName, sheetId, sheetGid }: DashboardProps) {
  const { rows, loading, error, lastUpdated, refresh } = useGoogleSheet({ sheetId, gid: sheetGid });

  const stats = useMemo(() => {
    const vehicles = new Set<string>();
    const drivers = new Set<string>();
    let latest: Date | null = null;

    rows.forEach((row) => {
      const vehicle = findValue(row, ['Vehicle No']);
      if (vehicle) vehicles.add(String(vehicle));
      const driver = findValue(row, ['Driver Name']);
      if (driver) drivers.add(String(driver));
      const dateValue = findValue(row, ['Alert Date Time', 'Track Time', 'Date']);
      const parsed = parseDate(dateValue);
      if (parsed && (!latest || parsed > latest)) {
        latest = parsed;
      }
    });

    const latestLabel = latest ? latest.toLocaleString() : '—';

    return {
      total: rows.length,
      vehicles: vehicles.size,
      drivers: drivers.size,
      latest: latestLabel,
    };
  }, [rows]);

  const recentAlerts = useMemo(() => {
    return [...rows]
      .map((row) => {
        const dateValue = findValue(row, ['Alert Date Time', 'Track Time', 'Date']);
        const parsed = parseDate(dateValue);
        return {
          id: `${findValue(row, ['Vehicle No']) ?? 'vehicle'}-${parsed?.getTime() ?? Math.random()}`,
          time: parsed?.toLocaleString() ?? String(dateValue ?? '—'),
          timestamp: parsed?.getTime() ?? 0,
          vehicle: String(findValue(row, ['Vehicle No']) ?? '—'),
          alert: String(findValue(row, ['Alert Type']) ?? '—'),
          speed: findValue(row, ['Speed']),
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 6);
  }, [rows]);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Simple dashboard</p>
              <h1 className="text-3xl font-semibold">{dashboardName}</h1>
            </div>
            <button
              type="button"
              onClick={refresh}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-white hover:border-slate-500"
            >
              Refresh data
            </button>
          </div>
          {lastUpdated ? (
            <p className="text-xs text-slate-400">Last updated {lastUpdated.toLocaleString()}</p>
          ) : null}
        </header>

        {error ? (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
            Loading dashboard data…
          </div>
        ) : (
          <>
            <section className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg md:grid-cols-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Total alerts</span>
                <span className="text-3xl font-semibold">{stats.total.toLocaleString()}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Vehicles</span>
                <span className="text-3xl font-semibold">{stats.vehicles.toLocaleString()}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Drivers</span>
                <span className="text-3xl font-semibold">{stats.drivers.toLocaleString()}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Latest alert</span>
                <span className="text-base text-slate-200">{stats.latest}</span>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
              <h2 className="text-lg font-medium">Recent alerts</h2>
              <div className="mt-4 grid gap-3">
                {recentAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="grid gap-2 rounded-xl border border-slate-800 bg-slate-950/40 p-4 md:grid-cols-[1.1fr_1fr_1fr_auto]"
                  >
                    <div className="text-sm text-slate-300">{alert.time}</div>
                    <div className="text-sm font-semibold text-white">{alert.vehicle}</div>
                    <div className="text-sm text-slate-200">{alert.alert}</div>
                    <div className="text-sm text-slate-400">{alert.speed ? `${alert.speed} km/h` : '—'}</div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

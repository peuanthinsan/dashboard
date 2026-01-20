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

const toDayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

type TableRow = {
  key: string;
  date: Date;
  dateLabel: string;
  vehicle: string;
  distraction: number;
  fatigue: number;
  yawning: number;
  total: number;
};

export default function SimpleDashboard({ dashboardName, sheetId, sheetGid }: DashboardProps) {
  const { rows, loading, error, lastUpdated, refresh } = useGoogleSheet({ sheetId, gid: sheetGid });

  const stats = useMemo(() => {
    const vehicles = new Set<string>();
    const drivers = new Set<string>();
    let latestTimestamp = 0;
    let latestLabel = '—';

    rows.forEach((row) => {
      const vehicle = findValue(row, ['Vehicle No']);
      if (vehicle) vehicles.add(String(vehicle));
      const driver = findValue(row, ['Driver Name']);
      if (driver) drivers.add(String(driver));
      const dateValue = findValue(row, ['Alert Date Time', 'Track Time', 'Date']);
      const parsed = parseDate(dateValue);
      if (parsed) {
        const timestamp = parsed.getTime();
        if (timestamp > latestTimestamp) {
          latestTimestamp = timestamp;
          latestLabel = parsed.toLocaleString();
        }
      }
    });

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

  const tableRows = useMemo<TableRow[]>(() => {
    const grouped = new Map<string, TableRow>();
    rows.forEach((row) => {
      const dateValue = findValue(row, ['Alert Date Time', 'Track Time', 'Date']);
      const parsed = parseDate(dateValue);
      if (!parsed) return;
      const dateKey = toDayKey(parsed);
      const date = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
      const vehicle = String(findValue(row, ['Vehicle No', 'Vehicle No TH']) ?? '—');
      const alertType = normalizeLabel(String(findValue(row, ['Alert Type']) ?? ''));
      const key = `${dateKey}-${vehicle}`;
      const entry = grouped.get(key) ?? {
        key,
        date,
        dateLabel: date.toLocaleDateString(),
        vehicle,
        distraction: 0,
        fatigue: 0,
        yawning: 0,
        total: 0,
      };
      if (alertType.includes('distraction')) entry.distraction += 1;
      if (alertType.includes('fatigue')) entry.fatigue += 1;
      if (alertType.includes('yawn')) entry.yawning += 1;
      entry.total += 1;
      grouped.set(key, entry);
    });
    return Array.from(grouped.values()).sort((a, b) => {
      const timeDiff = b.date.getTime() - a.date.getTime();
      if (timeDiff !== 0) return timeDiff;
      return a.vehicle.localeCompare(b.vehicle);
    });
  }, [rows]);

  const trendData = useMemo(() => {
    const counts = new Map<string, { key: string; date: Date; count: number }>();
    rows.forEach((row) => {
      const dateValue = findValue(row, ['Alert Date Time', 'Track Time', 'Date']);
      const parsed = parseDate(dateValue);
      if (!parsed) return;
      const dayKey = toDayKey(parsed);
      const existing = counts.get(dayKey);
      if (existing) {
        existing.count += 1;
      } else {
        const dayDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
        counts.set(dayKey, { key: dayKey, date: dayDate, count: 1 });
      }
    });
    return Array.from(counts.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [rows]);

  const maxTrendValue = trendData.reduce((max, item) => Math.max(max, item.count), 0);
  const trendPoints = useMemo(() => {
    const width = 1200;
    const height = 300;
    const padding = { top: 28, right: 32, bottom: 48, left: 60 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    if (trendData.length === 0) {
      return { points: [], path: '', viewBox: `0 0 ${width} ${height}`, padding, width, height };
    }
    const maxValue = Math.max(1, maxTrendValue);
    const points = trendData.map((item, index) => {
      const x =
        trendData.length === 1
          ? padding.left + plotWidth / 2
          : padding.left + (index / (trendData.length - 1)) * plotWidth;
      const y = padding.top + (1 - item.count / maxValue) * plotHeight;
      return { x, y, count: item.count, label: item.date.toLocaleDateString() };
    });
    const path = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(' ');
    return { points, path, viewBox: `0 0 ${width} ${height}`, padding, width, height };
  }, [maxTrendValue, trendData]);

  const yAxisTicks = useMemo(() => {
    const ticks = 4;
    const maxValue = Math.max(1, maxTrendValue);
    return Array.from({ length: ticks + 1 }, (_, index) => {
      const value = Math.round((maxValue / ticks) * (ticks - index));
      return { value, position: index / ticks };
    });
  }, [maxTrendValue]);

  const xAxisLabels = useMemo(() => {
    if (trendData.length === 0) return [];
    const labelCount = Math.min(6, trendData.length);
    return Array.from({ length: labelCount }, (_, index) => {
      const position = labelCount === 1 ? 0 : index / (labelCount - 1);
      const dataIndex = labelCount === 1 ? 0 : Math.round(position * (trendData.length - 1));
      const item = trendData[dataIndex];
      return {
        label: item.date.toLocaleDateString(),
        position,
      };
    });
  }, [trendData]);

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
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium">Daily alert trend</h2>
                  <p className="text-sm text-slate-400">Daily totals for the full alert set.</p>
                </div>
                <span className="text-sm text-slate-400">{rows.length.toLocaleString()} alerts</span>
              </div>
              {trendData.length === 0 ? (
                <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-300">
                  No alert trend data yet.
                </div>
              ) : (
                <div className="mt-6 overflow-x-auto">
                  <svg viewBox={trendPoints.viewBox} className="min-w-[720px]">
                    <defs>
                      <linearGradient id="simple-trend-line" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="#c7b9ff" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                    {yAxisTicks.map((tick) => {
                      const y =
                        trendPoints.padding.top +
                        tick.position * (trendPoints.height - trendPoints.padding.top - trendPoints.padding.bottom);
                      return (
                        <g key={`y-${tick.value}`}>
                          <line
                            x1={trendPoints.padding.left}
                            x2={trendPoints.width - trendPoints.padding.right}
                            y1={y}
                            y2={y}
                            stroke="#1f2937"
                            strokeDasharray="6 8"
                          />
                          <text x={trendPoints.padding.left - 12} y={y + 4} fill="#94a3b8" fontSize="12" textAnchor="end">
                            {tick.value}
                          </text>
                        </g>
                      );
                    })}
                    <line
                      x1={trendPoints.padding.left}
                      x2={trendPoints.padding.left}
                      y1={trendPoints.padding.top}
                      y2={trendPoints.height - trendPoints.padding.bottom}
                      stroke="#334155"
                    />
                    <line
                      x1={trendPoints.padding.left}
                      x2={trendPoints.width - trendPoints.padding.right}
                      y1={trendPoints.height - trendPoints.padding.bottom}
                      y2={trendPoints.height - trendPoints.padding.bottom}
                      stroke="#334155"
                    />
                    <path d={trendPoints.path} fill="none" stroke="url(#simple-trend-line)" strokeWidth="3" />
                    {trendPoints.points.map((point, index) => (
                      <circle key={`${point.label}-${index}`} cx={point.x} cy={point.y} r="6" fill="#0f172a" stroke="#c7b9ff" strokeWidth="2" />
                    ))}
                    {xAxisLabels.map((label) => {
                      const x =
                        trendPoints.padding.left +
                        label.position * (trendPoints.width - trendPoints.padding.left - trendPoints.padding.right);
                      return (
                        <text
                          key={`x-${label.label}`}
                          x={x}
                          y={trendPoints.height - trendPoints.padding.bottom + 24}
                          fill="#94a3b8"
                          fontSize="12"
                          textAnchor="middle"
                        >
                          {label.label}
                        </text>
                      );
                    })}
                  </svg>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
              <div>
                <h2 className="text-lg font-medium">Alerts by vehicle and date</h2>
                <p className="text-sm text-slate-400">
                  Daily counts for distraction, fatigue, and yawning alerts grouped by vehicle.
                </p>
              </div>
              {tableRows.length === 0 ? (
                <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-300">
                  No alert table data yet.
                </div>
              ) : (
                <div className="mt-6 overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                    <thead>
                      <tr>
                        <th className="rounded-l-xl bg-sky-500/90 px-4 py-3 text-white">Date</th>
                        <th className="bg-teal-400/90 px-4 py-3 text-slate-900">Vehicle Number</th>
                        <th className="bg-blue-400/90 px-4 py-3 text-right text-slate-900">Distraction</th>
                        <th className="bg-amber-300/90 px-4 py-3 text-right text-slate-900">Fatigue</th>
                        <th className="bg-emerald-300/90 px-4 py-3 text-right text-slate-900">Yawning</th>
                        <th className="rounded-r-xl bg-rose-400/90 px-4 py-3 text-right text-slate-900">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((row) => (
                        <tr key={row.key} className="border-b border-slate-800 last:border-0">
                          <td className="bg-slate-950/40 px-4 py-3 font-semibold text-slate-100">
                            {row.dateLabel}
                          </td>
                          <td className="bg-slate-950/30 px-4 py-3 text-slate-100">{row.vehicle}</td>
                          <td className="bg-blue-500/10 px-4 py-3 text-right text-blue-200">{row.distraction}</td>
                          <td className="bg-amber-400/10 px-4 py-3 text-right text-amber-200">{row.fatigue}</td>
                          <td className="bg-emerald-400/10 px-4 py-3 text-right text-emerald-200">{row.yawning}</td>
                          <td className="bg-rose-500/10 px-4 py-3 text-right text-rose-200">{row.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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

'use client';

import { useMemo, useState } from 'react';
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

const toAlertCategory = (value: unknown) => {
  const normalized = normalizeLabel(String(value ?? ''));
  if (!normalized) return 'other';
  if (normalized.includes('distract')) return 'distraction';
  if (normalized.includes('fatigue') || normalized.includes('drows') || normalized.includes('sleep')) return 'fatigue';
  if (normalized.includes('yawn')) return 'yawning';
  return 'other';
};

export default function SimpleDashboard({ dashboardName, sheetId, sheetGid }: DashboardProps) {
  const { rows, loading, error, lastUpdated, refresh } = useGoogleSheet({ sheetId, gid: sheetGid });
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number; count: number; label: string } | null>(null);

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

  const dailyTrend = useMemo(() => {
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

  const maxTrendValue = dailyTrend.reduce((max, item) => Math.max(max, item.count), 0);
  const trendPoints = useMemo(() => {
    const width = 1200;
    const height = 300;
    const padding = { top: 28, right: 32, bottom: 48, left: 60 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    if (dailyTrend.length === 0) {
      return { points: [], path: '', viewBox: `0 0 ${width} ${height}`, padding, width, height };
    }
    const maxValue = Math.max(1, maxTrendValue);
    const points = dailyTrend.map((item, index) => {
      const x =
        dailyTrend.length === 1
          ? padding.left + plotWidth / 2
          : padding.left + (index / (dailyTrend.length - 1)) * plotWidth;
      const y = padding.top + (1 - item.count / maxValue) * plotHeight;
      return { x, y, count: item.count, label: item.date.toLocaleDateString() };
    });
    const path = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(' ');
    return { points, path, viewBox: `0 0 ${width} ${height}`, padding, width, height };
  }, [dailyTrend, maxTrendValue]);

  const yAxisTicks = useMemo(() => {
    const ticks = 4;
    const maxValue = Math.max(1, maxTrendValue);
    return Array.from({ length: ticks + 1 }, (_, index) => {
      const value = Math.round((maxValue / ticks) * (ticks - index));
      return { value, position: index / ticks };
    });
  }, [maxTrendValue]);

  const xAxisLabels = useMemo(() => {
    if (dailyTrend.length === 0) return [];
    const labelCount = Math.min(6, dailyTrend.length);
    return Array.from({ length: labelCount }, (_, index) => {
      const position = labelCount === 1 ? 0 : index / (labelCount - 1);
      const dataIndex = labelCount === 1 ? 0 : Math.round(position * (dailyTrend.length - 1));
      const item = dailyTrend[dataIndex];
      return {
        label: item.date.toLocaleDateString(),
        position,
      };
    });
  }, [dailyTrend]);

  const alertSummaryRows = useMemo(() => {
    const summary = new Map<
      string,
      {
        dateLabel: string;
        vehicle: string;
        distraction: number;
        fatigue: number;
        yawning: number;
        total: number;
        dateValue: number;
      }
    >();

    rows.forEach((row) => {
      const dateValue = findValue(row, ['Alert Date Time', 'Track Time', 'Date']);
      const parsed = parseDate(dateValue);
      const vehicle = String(findValue(row, ['Vehicle No']) ?? '—');
      if (!parsed || !vehicle) return;
      const dayKey = toDayKey(parsed);
      const key = `${dayKey}-${vehicle}`;
      const entry = summary.get(key) ?? {
        dateLabel: dayKey,
        vehicle,
        distraction: 0,
        fatigue: 0,
        yawning: 0,
        total: 0,
        dateValue: parsed.getTime(),
      };
      const category = toAlertCategory(findValue(row, ['Alert Type']));
      if (category === 'distraction') entry.distraction += 1;
      if (category === 'fatigue') entry.fatigue += 1;
      if (category === 'yawning') entry.yawning += 1;
      entry.total += 1;
      summary.set(key, entry);
    });

    return Array.from(summary.values()).sort((a, b) => {
      if (b.dateValue !== a.dateValue) return b.dateValue - a.dateValue;
      return a.vehicle.localeCompare(b.vehicle);
    });
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
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-medium">Daily alert trend</h2>
                  <p className="text-sm text-slate-400">Daily totals for the latest alert activity.</p>
                </div>
                <span className="text-sm text-slate-400">{rows.length.toLocaleString()} alerts</span>
              </div>
              <div className="relative mt-4">
                {dailyTrend.length === 0 ? (
                  <p className="text-sm text-slate-400">No alert activity available.</p>
                ) : (
                  <svg
                    viewBox={trendPoints.viewBox}
                    className="h-72 w-full"
                    preserveAspectRatio="none"
                    role="img"
                    aria-label="Daily alert trend"
                  >
                    <defs>
                      <linearGradient id="trend-line-simple" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="#a78bfa" />
                        <stop offset="100%" stopColor="#c4b5fd" />
                      </linearGradient>
                    </defs>
                    {yAxisTicks.map((tick) => {
                      const y =
                        trendPoints.padding.top +
                        tick.position * (trendPoints.height - trendPoints.padding.top - trendPoints.padding.bottom);
                      return (
                        <g key={`tick-${tick.value}`}>
                          <line
                            x1={trendPoints.padding.left}
                            x2={trendPoints.width - trendPoints.padding.right}
                            y1={y}
                            y2={y}
                            stroke="#1f2937"
                            strokeDasharray="4 6"
                          />
                          <text
                            x={trendPoints.padding.left - 12}
                            y={y + 4}
                            textAnchor="end"
                            fontSize="11"
                            fill="#94a3b8"
                          >
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
                    <path d={trendPoints.path} fill="none" stroke="url(#trend-line-simple)" strokeWidth="3" />
                    {trendPoints.points.map((point, index) => (
                      <circle
                        key={`point-${index}`}
                        cx={point.x}
                        cy={point.y}
                        r="5"
                        fill="#0f172a"
                        stroke="#c4b5fd"
                        strokeWidth="2"
                        onMouseEnter={() => setHoverPoint(point)}
                        onMouseLeave={() => setHoverPoint(null)}
                      />
                    ))}
                    {xAxisLabels.map((label) => {
                      const x =
                        trendPoints.padding.left +
                        label.position * (trendPoints.width - trendPoints.padding.left - trendPoints.padding.right);
                      return (
                        <text
                          key={`label-${label.label}-${label.position}`}
                          x={x}
                          y={trendPoints.height - trendPoints.padding.bottom + 24}
                          textAnchor="middle"
                          fontSize="11"
                          fill="#94a3b8"
                        >
                          {label.label}
                        </text>
                      );
                    })}
                  </svg>
                )}
                {hoverPoint ? (
                  <div
                    className="pointer-events-none absolute rounded-lg border border-indigo-400/40 bg-slate-950/90 px-3 py-2 text-xs text-indigo-100 shadow-lg"
                    style={{
                      left: `${(hoverPoint.x / trendPoints.width) * 100}%`,
                      top: `${(hoverPoint.y / trendPoints.height) * 100}%`,
                      transform: 'translate(-50%, -120%)',
                    }}
                  >
                    <div className="font-semibold">{hoverPoint.count} alerts</div>
                    <div className="text-[11px] text-slate-300">{hoverPoint.label}</div>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium">Alerts by vehicle and date</h2>
                  <p className="text-sm text-slate-400">Daily breakdown of distraction, fatigue, and yawning alerts.</p>
                </div>
                <span className="text-sm text-slate-400">{alertSummaryRows.length} rows</span>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2 text-left text-sm">
                  <thead>
                    <tr className="text-sm font-semibold">
                      <th className="rounded-l-xl bg-blue-500/80 px-4 py-2 text-white">Date</th>
                      <th className="bg-sky-400/80 px-4 py-2 text-slate-900">Vehicle Number</th>
                      <th className="bg-indigo-400/80 px-4 py-2 text-slate-900">Distraction</th>
                      <th className="bg-amber-300/90 px-4 py-2 text-slate-900">Fatigue</th>
                      <th className="bg-emerald-300/90 px-4 py-2 text-slate-900">Yawning</th>
                      <th className="rounded-r-xl bg-rose-400/80 px-4 py-2 text-slate-900">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertSummaryRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-6 text-center text-slate-400">
                          No alert summary rows available.
                        </td>
                      </tr>
                    ) : (
                      alertSummaryRows.map((row) => (
                        <tr key={`${row.dateLabel}-${row.vehicle}`} className="bg-slate-950/40">
                          <td className="rounded-l-xl border border-slate-800 px-4 py-3 font-semibold text-slate-100">
                            {row.dateLabel}
                          </td>
                          <td className="border border-slate-800 px-4 py-3 text-slate-100">{row.vehicle}</td>
                          <td className="border border-slate-800 bg-indigo-500/10 px-4 py-3 text-right text-indigo-200">
                            {row.distraction}
                          </td>
                          <td className="border border-slate-800 bg-amber-400/10 px-4 py-3 text-right text-amber-200">
                            {row.fatigue}
                          </td>
                          <td className="border border-slate-800 bg-emerald-400/10 px-4 py-3 text-right text-emerald-200">
                            {row.yawning}
                          </td>
                          <td className="rounded-r-xl border border-slate-800 bg-rose-400/10 px-4 py-3 text-right font-semibold text-rose-100">
                            {row.total}
                          </td>
                        </tr>
                      ))
                    )}
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

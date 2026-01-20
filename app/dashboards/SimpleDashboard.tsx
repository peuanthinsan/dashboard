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

const toAlertCategory = (value: string) => {
  const normalized = normalizeLabel(value);
  if (normalized.includes('distraction')) return 'distraction';
  if (normalized.includes('fatigue')) return 'fatigue';
  if (normalized.includes('yawn')) return 'yawning';
  return 'other';
};

type TrendPoint = {
  x: number;
  y: number;
  count: number;
  label: string;
};

export default function SimpleDashboard({ dashboardName, sheetId, sheetGid }: DashboardProps) {
  const { rows, loading, error, lastUpdated, refresh } = useGoogleSheet({ sheetId, gid: sheetGid });
  const [hoverPoint, setHoverPoint] = useState<TrendPoint | null>(null);
  const [pinnedPoint, setPinnedPoint] = useState<TrendPoint | null>(null);

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

  const alertRows = useMemo(() => {
    return rows.map((row) => {
      const dateValue = findValue(row, ['Alert Date Time', 'Track Time', 'Date']);
      const parsedDate = parseDate(dateValue);
      const vehicle = String(findValue(row, ['Vehicle No', 'Vehicle No TH']) ?? '—');
      const alertType = String(findValue(row, ['Alert Type']) ?? '—');
      return {
        vehicle,
        alertType,
        parsedDate,
        dateLabel: parsedDate ? toDayKey(parsedDate) : String(dateValue ?? '—'),
      };
    });
  }, [rows]);

  const alertTableRows = useMemo(() => {
    const grouped = new Map<
      string,
      {
        dateLabel: string;
        dateSort: number;
        vehicle: string;
        distraction: number;
        fatigue: number;
        yawning: number;
        total: number;
      }
    >();

    alertRows.forEach((row) => {
      if (!row.parsedDate || row.vehicle === '—') return;
      const key = `${row.dateLabel}-${row.vehicle}`;
      const existing =
        grouped.get(key) ?? {
          dateLabel: row.dateLabel,
          dateSort: row.parsedDate.getTime(),
          vehicle: row.vehicle,
          distraction: 0,
          fatigue: 0,
          yawning: 0,
          total: 0,
        };
      const category = toAlertCategory(row.alertType);
      if (category === 'distraction') existing.distraction += 1;
      if (category === 'fatigue') existing.fatigue += 1;
      if (category === 'yawning') existing.yawning += 1;
      existing.total += 1;
      grouped.set(key, existing);
    });

    return Array.from(grouped.values()).sort((a, b) => {
      if (a.dateSort !== b.dateSort) return b.dateSort - a.dateSort;
      return a.vehicle.localeCompare(b.vehicle);
    });
  }, [alertRows]);

  const trendData = useMemo(() => {
    const counts = new Map<string, { key: string; date: Date; count: number }>();
    alertRows.forEach((row) => {
      if (!row.parsedDate) return;
      const dayKey = toDayKey(row.parsedDate);
      const existing = counts.get(dayKey);
      if (existing) {
        existing.count += 1;
      } else {
        const dayDate = new Date(row.parsedDate.getFullYear(), row.parsedDate.getMonth(), row.parsedDate.getDate());
        counts.set(dayKey, { key: dayKey, date: dayDate, count: 1 });
      }
    });
    return Array.from(counts.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [alertRows]);

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

  const activePoint = pinnedPoint ?? hoverPoint;

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
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-medium">Daily alert trend</h2>
                  <p className="text-sm text-slate-400">Daily totals for the filtered alert set.</p>
                </div>
                <p className="text-sm text-slate-400">{stats.total.toLocaleString()} alerts</p>
              </div>
              {trendData.length === 0 ? (
                <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-300">
                  No daily trend data available yet.
                </div>
              ) : (
                <div className="relative mt-6 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <svg
                    viewBox={trendPoints.viewBox}
                    className="h-[280px] w-full"
                    role="img"
                    aria-label="Daily alert trend"
                    onMouseLeave={() => setHoverPoint(null)}
                  >
                    <defs>
                      <linearGradient id="simple-trend-line" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="#8b5cf6" />
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
                            stroke="rgba(148, 163, 184, 0.2)"
                            strokeDasharray="4 6"
                          />
                          <text
                            x={trendPoints.padding.left - 12}
                            y={y + 4}
                            fontSize="12"
                            textAnchor="end"
                            fill="rgba(148, 163, 184, 0.7)"
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
                      stroke="rgba(148, 163, 184, 0.4)"
                    />
                    <line
                      x1={trendPoints.padding.left}
                      x2={trendPoints.width - trendPoints.padding.right}
                      y1={trendPoints.height - trendPoints.padding.bottom}
                      y2={trendPoints.height - trendPoints.padding.bottom}
                      stroke="rgba(148, 163, 184, 0.4)"
                    />
                    <path d={trendPoints.path} fill="none" stroke="url(#simple-trend-line)" strokeWidth="3" />
                    {trendPoints.points.map((point, index) => (
                      <circle
                        key={`point-${index}`}
                        cx={point.x}
                        cy={point.y}
                        r={6}
                        fill="rgba(15, 23, 42, 0.85)"
                        stroke="#c4b5fd"
                        strokeWidth="3"
                        onMouseEnter={() => setHoverPoint(point)}
                        onClick={() => setPinnedPoint((current) => (current?.x === point.x ? null : point))}
                      />
                    ))}
                    {xAxisLabels.map((label) => (
                      <text
                        key={`label-${label.label}`}
                        x={
                          trendPoints.padding.left +
                          label.position * (trendPoints.width - trendPoints.padding.left - trendPoints.padding.right)
                        }
                        y={trendPoints.height - trendPoints.padding.bottom + 24}
                        fontSize="12"
                        textAnchor="middle"
                        fill="rgba(148, 163, 184, 0.7)"
                      >
                        {label.label}
                      </text>
                    ))}
                  </svg>
                  {activePoint ? (
                    <div
                      className="pointer-events-none absolute rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white shadow-lg"
                      style={{
                        left: `${(activePoint.x / trendPoints.width) * 100}%`,
                        top: `${(activePoint.y / trendPoints.height) * 100}%`,
                        transform: 'translate(-50%, -140%)',
                      }}
                    >
                      <p className="font-semibold">{activePoint.label}</p>
                      <p className="text-slate-300">{activePoint.count} alerts</p>
                    </div>
                  ) : null}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
              <div>
                <h2 className="text-lg font-medium">Alerts by vehicle and date</h2>
                <p className="text-sm text-slate-400">
                  Tip: Shift-click (or Ctrl/Cmd-click) additional columns to sort by multiple columns.
                </p>
              </div>
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
                <div className="max-h-[520px] overflow-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0 z-10 text-left">
                      <tr>
                        <th className="bg-blue-500/90 px-4 py-3 font-semibold text-white">Date</th>
                        <th className="bg-cyan-300/90 px-4 py-3 font-semibold text-slate-900">Vehicle Number</th>
                        <th className="bg-blue-300/90 px-4 py-3 text-right font-semibold text-slate-900">
                          Distraction
                        </th>
                        <th className="bg-amber-300/90 px-4 py-3 text-right font-semibold text-slate-900">Fatigue</th>
                        <th className="bg-emerald-300/90 px-4 py-3 text-right font-semibold text-slate-900">
                          Yawning
                        </th>
                        <th className="bg-rose-300/90 px-4 py-3 text-right font-semibold text-slate-900">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alertTableRows.length === 0 ? (
                        <tr>
                          <td className="px-4 py-6 text-center text-slate-400" colSpan={6}>
                            No alert data available.
                          </td>
                        </tr>
                      ) : (
                        alertTableRows.map((row) => (
                          <tr key={`${row.dateLabel}-${row.vehicle}`} className="border-t border-slate-800">
                            <td className="bg-slate-950/40 px-4 py-3 font-semibold text-slate-100">
                              {row.dateLabel}
                            </td>
                            <td className="bg-slate-900/40 px-4 py-3 text-slate-100">{row.vehicle}</td>
                            <td className="bg-blue-950/30 px-4 py-3 text-right text-blue-200">
                              {row.distraction}
                            </td>
                            <td className="bg-amber-950/20 px-4 py-3 text-right text-amber-200">{row.fatigue}</td>
                            <td className="bg-emerald-950/20 px-4 py-3 text-right text-emerald-200">
                              {row.yawning}
                            </td>
                            <td className="bg-rose-950/20 px-4 py-3 text-right font-semibold text-rose-200">
                              {row.total}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

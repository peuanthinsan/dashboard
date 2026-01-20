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

const toDayLabel = (date: Date) => toDayKey(date);

const remarkCategories = ['Fatigue', 'Yawning', 'Distraction'] as const;
type RemarkCategory = (typeof remarkCategories)[number];

type TrendPoint = {
  x: number;
  y: number;
  count: number;
  label: string;
};

type TableRow = {
  id: string;
  dateKey: string;
  dateLabel: string;
  dateValue: Date;
  vehicle: string;
  fatigue: number;
  yawning: number;
  distraction: number;
  total: number;
};

type SortField = 'date' | 'vehicle' | 'fatigue' | 'yawning' | 'distraction' | 'total';
type SortDirection = 'asc' | 'desc';
type SortCriterion = {
  field: SortField;
  direction: SortDirection;
};

export default function SimpleDashboard({ dashboardName, sheetId, sheetGid }: DashboardProps) {
  const { rows, loading, error, lastUpdated, refresh } = useGoogleSheet({ sheetId, gid: sheetGid });
  const [hoverPoint, setHoverPoint] = useState<TrendPoint | null>(null);
  const [pinnedPoint, setPinnedPoint] = useState<TrendPoint | null>(null);
  const [sortCriteria, setSortCriteria] = useState<SortCriterion[]>([]);

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

  const filteredAlerts = useMemo(() => {
    return rows
      .map((row, index) => {
        const alertType = String(findValue(row, ['Alert Type']) ?? '');
        if (normalizeLabel(alertType) !== 'eye closing-a2') return null;
        const remarkValue = String(findValue(row, ['Remarks']) ?? '');
        const normalizedRemark = normalizeLabel(remarkValue);
        const remarkCategory = remarkCategories.find((category) =>
          normalizedRemark.includes(normalizeLabel(category)),
        ) as RemarkCategory | undefined;
        if (!remarkCategory) return null;
        const vehicle = String(findValue(row, ['Vehicle No', 'Vehicle No TH']) ?? '—');
        const dateValue = findValue(row, ['Alert Date Time', 'Track Time', 'Date']);
        const parsedDate = parseDate(dateValue);
        if (!parsedDate) return null;
        return {
          id: `${index}-${vehicle}-${parsedDate.getTime()}`,
          vehicle,
          remarkCategory,
          parsedDate,
        };
      })
      .filter((alert): alert is NonNullable<typeof alert> => Boolean(alert));
  }, [rows]);

  const tableRows = useMemo<TableRow[]>(() => {
    const grouped = new Map<string, TableRow>();
    filteredAlerts.forEach((alert) => {
      const dateKey = toDayKey(alert.parsedDate);
      const key = `${dateKey}-${alert.vehicle}`;
      const existing = grouped.get(key);
      if (existing) {
        if (alert.remarkCategory === 'Fatigue') existing.fatigue += 1;
        if (alert.remarkCategory === 'Yawning') existing.yawning += 1;
        if (alert.remarkCategory === 'Distraction') existing.distraction += 1;
        existing.total += 1;
      } else {
        grouped.set(key, {
          id: key,
          dateKey,
          dateLabel: toDayLabel(alert.parsedDate),
          dateValue: alert.parsedDate,
          vehicle: alert.vehicle,
          fatigue: alert.remarkCategory === 'Fatigue' ? 1 : 0,
          yawning: alert.remarkCategory === 'Yawning' ? 1 : 0,
          distraction: alert.remarkCategory === 'Distraction' ? 1 : 0,
          total: 1,
        });
      }
    });
    return Array.from(grouped.values());
  }, [filteredAlerts]);

  const sortedTableRows = useMemo(() => {
    if (sortCriteria.length === 0) {
      return [...tableRows].sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    }
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    const getSortValue = (row: TableRow, field: SortField) => {
      switch (field) {
        case 'date':
          return row.dateValue.getTime();
        case 'vehicle':
          return row.vehicle;
        case 'fatigue':
          return row.fatigue;
        case 'yawning':
          return row.yawning;
        case 'distraction':
          return row.distraction;
        case 'total':
          return row.total;
        default:
          return null;
      }
    };
    const compareValues = (aValue: string | number | null, bValue: string | number | null) => {
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      if (typeof aValue === 'number' && typeof bValue === 'number') return aValue - bValue;
      return collator.compare(String(aValue), String(bValue));
    };
    return [...tableRows].sort((a, b) => {
      for (const criterion of sortCriteria) {
        const order = criterion.direction === 'asc' ? 1 : -1;
        const comparison = compareValues(getSortValue(a, criterion.field), getSortValue(b, criterion.field));
        if (comparison !== 0) return comparison * order;
      }
      return 0;
    });
  }, [sortCriteria, tableRows]);

  const trendData = useMemo(() => {
    const counts = new Map<string, { key: string; date: Date; count: number }>();
    filteredAlerts.forEach((row) => {
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
  }, [filteredAlerts]);

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

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-medium">Daily alert trend</h2>
                  <p className="text-sm text-slate-400">
                    Eye Closing-A2 alerts with Fatigue, Yawning, or Distraction remarks.
                  </p>
                </div>
                <span className="text-sm text-slate-400">{filteredAlerts.length} alerts</span>
              </div>
              <div className="relative mt-4">
                {trendData.length === 0 ? (
                  <p className="text-sm text-slate-400">No alert activity available for the selected filters.</p>
                ) : (
                  <svg
                    viewBox={trendPoints.viewBox}
                    className="h-72 w-full"
                    preserveAspectRatio="none"
                    role="img"
                    aria-label="Daily alert trend"
                  >
                    <defs>
                      <linearGradient id="simple-trend-line" x1="0" x2="1" y1="0" y2="0">
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
                    <path d={trendPoints.path} fill="none" stroke="url(#simple-trend-line)" strokeWidth="3" />
                    {trendPoints.points.map((point, index) => (
                      <circle
                        key={`point-${index}`}
                        cx={point.x}
                        cy={point.y}
                        r="5"
                        fill="#0f172a"
                        stroke="#c4b5fd"
                        strokeWidth="2"
                        className="cursor-pointer transition"
                        onMouseEnter={() => setHoverPoint(point)}
                        onMouseLeave={() => {
                          if (!pinnedPoint) {
                            setHoverPoint(null);
                          }
                        }}
                        onClick={() => {
                          setPinnedPoint((current) => (current?.label === point.label ? null : point));
                          setHoverPoint(point);
                        }}
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
                {activePoint ? (
                  <div
                    className="pointer-events-none absolute rounded-lg border border-indigo-400/40 bg-slate-950/90 px-3 py-2 text-xs text-indigo-100 shadow-lg"
                    style={{
                      left: `${(activePoint.x / trendPoints.width) * 100}%`,
                      top: `${(activePoint.y / trendPoints.height) * 100}%`,
                      transform: 'translate(-50%, -120%)',
                    }}
                  >
                    <div className="font-semibold">{activePoint.count} alerts</div>
                    <div className="text-[11px] text-slate-300">{activePoint.label}</div>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-medium">Alerts by vehicle and date</h2>
                  <p className="text-sm text-slate-400">
                    Eye Closing-A2 alerts grouped by remark for each vehicle.
                  </p>
                </div>
                <span className="text-sm text-slate-400">{sortedTableRows.length} rows</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                <span>Shift-click column headers to add multiple sorts.</span>
                <span>
                  {sortedTableRows.length === 0 ? 'No alerts to show.' : 'Sorted alert totals for the time range.'}
                </span>
              </div>
              {sortCriteria.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="uppercase tracking-[0.2em] text-slate-500">Sorted by</span>
                  {sortCriteria.map((criterion, index) => (
                    <button
                      key={`${criterion.field}-${criterion.direction}`}
                      type="button"
                      onClick={() =>
                        setSortCriteria((current) => current.filter((_, currentIndex) => currentIndex !== index))
                      }
                      className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-100"
                    >
                      {criterion.field} {criterion.direction} ×
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSortCriteria([])}
                    className="text-xs font-semibold text-indigo-300 hover:text-indigo-200"
                  >
                    Clear sorting
                  </button>
                </div>
              ) : null}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs uppercase tracking-[0.2em] text-slate-400">
                      {(
                        [
                          { label: 'Date', field: 'date' },
                          { label: 'Vehicle number', field: 'vehicle' },
                          { label: 'Distraction', field: 'distraction', tint: 'bg-slate-900/50 text-indigo-200' },
                          { label: 'Fatigue', field: 'fatigue', tint: 'bg-slate-900/50 text-amber-200' },
                          { label: 'Yawning', field: 'yawning', tint: 'bg-slate-900/50 text-emerald-200' },
                          { label: 'Total', field: 'total', tint: 'bg-slate-900/50 text-rose-200' },
                        ] as const
                      ).map((column) => {
                        const sortIndex = sortCriteria.findIndex((criterion) => criterion.field === column.field);
                        const sortDirection = sortIndex >= 0 ? sortCriteria[sortIndex].direction : null;
                        const sortBadge =
                          sortIndex >= 0
                            ? `${sortDirection === 'asc' ? 'Asc' : 'Desc'}${
                                sortCriteria.length > 1 ? ` ${sortIndex + 1}` : ''
                              }`
                            : 'Sort';
                        return (
                          <th key={column.field} className={`py-3 pr-4 ${column.tint ?? ''}`}>
                            <button
                              type="button"
                              onClick={(event) => {
                                setSortCriteria((current) => {
                                  const existingIndex = current.findIndex(
                                    (criterion) => criterion.field === column.field,
                                  );
                                  const multiSort = event.shiftKey;
                                  const nextCriteria = multiSort ? [...current] : [];
                                  if (existingIndex === -1) {
                                    return [...nextCriteria, { field: column.field, direction: 'asc' }];
                                  }
                                  const existing = current[existingIndex];
                                  if (multiSort) {
                                    nextCriteria.splice(existingIndex, 1);
                                  }
                                  if (existing.direction === 'asc') {
                                    if (multiSort) {
                                      nextCriteria.splice(existingIndex, 0, {
                                        field: column.field,
                                        direction: 'desc',
                                      });
                                      return nextCriteria;
                                    }
                                    return [{ field: column.field, direction: 'desc' }];
                                  }
                                  return nextCriteria;
                                });
                              }}
                              className="flex items-center gap-2 text-left hover:text-slate-200"
                            >
                              <span>{column.label}</span>
                              <span className="text-[11px] text-slate-500">{sortBadge}</span>
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTableRows.map((row) => (
                      <tr key={row.id} className="border-b border-slate-900/80 text-slate-200">
                        <td className="py-3 pr-4 text-slate-300">{row.dateLabel}</td>
                        <td className="py-3 pr-4 font-semibold text-white">{row.vehicle}</td>
                        <td className="py-3 pr-4 bg-slate-950/40 text-indigo-200">{row.distraction}</td>
                        <td className="py-3 pr-4 bg-slate-950/40 text-amber-200">{row.fatigue}</td>
                        <td className="py-3 pr-4 bg-slate-950/40 text-emerald-200">{row.yawning}</td>
                        <td className="py-3 pr-4 bg-slate-950/40 text-rose-200">{row.total}</td>
                      </tr>
                    ))}
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

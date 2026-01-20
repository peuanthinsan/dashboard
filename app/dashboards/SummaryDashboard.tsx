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

const toDisplayString = (value: unknown) => {
  if (value == null || value === '') return '—';
  return String(value);
};

const parseDate = (value: unknown) => {
  if (!value) return null;
  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const toMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const toMonthLabel = (date: Date) =>
  date.toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });

const buildCounts = (rows: Record<string, any>[], labels: string[]) => {
  const totals = new Map<string, number>();
  rows.forEach((row) => {
    const value = findValue(row, labels);
    const key = value == null || value === '' ? 'Unspecified' : String(value).trim() || 'Unspecified';
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

const buildDeltaSummary = (current: number, previous: number) => {
  const delta = current - previous;
  const isIncrease = delta >= 0;
  const deltaLabel = delta === 0 ? 'No change from last month' : `${isIncrease ? '▲' : '▼'} ${Math.abs(delta)} from last month`;
  let percentLabel = '0% change';
  if (previous === 0 && current > 0) {
    percentLabel = '100% increase';
  } else if (previous > 0) {
    const percent = (delta / previous) * 100;
    percentLabel = `${percent.toFixed(1)}% change`;
  }
  return { delta, deltaLabel, percentLabel, isIncrease };
};

export default function SummaryDashboard({ dashboardName, sheetId, sheetGid }: DashboardProps) {
  const { rows, loading, error, lastUpdated, refresh } = useGoogleSheet({ sheetId, gid: sheetGid });

  const [alertFilter, setAlertFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [fleetFilter, setFleetFilter] = useState('all');
  const [remarkFilter, setRemarkFilter] = useState('all');
  const [vehicleFilter, setVehicleFilter] = useState('all');

  const alertRows = useMemo(() => {
    return rows.map((row) => {
      const alertType = toDisplayString(findValue(row, ['Alert Type']));
      const driver = toDisplayString(findValue(row, ['Driver Name']));
      const fleet = toDisplayString(findValue(row, ['Fleet']));
      const remarks = toDisplayString(findValue(row, ['Remarks']));
      const vehicle = toDisplayString(findValue(row, ['Vehicle No', 'Vehicle No TH']));
      const dateValue = findValue(row, ['Alert Date Time', 'Track Time', 'Date']);
      const parsedDate = parseDate(dateValue);
      const monthKey = parsedDate ? toMonthKey(parsedDate) : null;
      const monthLabel = parsedDate ? toMonthLabel(parsedDate) : 'Unknown month';
      return {
        alertType,
        driver,
        fleet,
        remarks,
        vehicle,
        monthKey,
        monthLabel,
        dateValue,
      };
    });
  }, [rows]);

  const alertOptions = useMemo(() => {
    const unique = new Set<string>();
    alertRows.forEach((row) => {
      if (row.alertType && row.alertType !== '—') unique.add(row.alertType);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [alertRows]);

  const fleetOptions = useMemo(() => {
    const unique = new Set<string>();
    alertRows.forEach((row) => {
      if (row.fleet && row.fleet !== '—') unique.add(row.fleet);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [alertRows]);

  const remarkOptions = useMemo(() => {
    const unique = new Set<string>();
    alertRows.forEach((row) => {
      if (row.remarks && row.remarks !== '—') unique.add(row.remarks);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [alertRows]);

  const vehicleOptions = useMemo(() => {
    const unique = new Set<string>();
    alertRows.forEach((row) => {
      if (row.vehicle && row.vehicle !== '—') unique.add(row.vehicle);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [alertRows]);

  const monthOptions = useMemo(() => {
    const unique = new Map<string, string>();
    alertRows.forEach((row) => {
      if (row.monthKey && row.monthLabel) {
        unique.set(row.monthKey, row.monthLabel);
      }
    });
    return Array.from(unique.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [alertRows]);

  const baseFilteredRows = useMemo(() => {
    return alertRows.filter((row) => {
      if (alertFilter !== 'all' && row.alertType !== alertFilter) return false;
      if (fleetFilter !== 'all' && row.fleet !== fleetFilter) return false;
      if (remarkFilter !== 'all' && row.remarks !== remarkFilter) return false;
      if (vehicleFilter !== 'all' && row.vehicle !== vehicleFilter) return false;
      return true;
    });
  }, [alertFilter, alertRows, fleetFilter, remarkFilter, vehicleFilter]);

  const activeMonthKey = monthFilter === 'all' ? null : monthFilter;

  const activeMonthLabel =
    activeMonthKey
      ? monthOptions.find((option) => option.key === activeMonthKey)?.label ?? 'All months'
      : 'All months';

  const currentRows = useMemo(() => {
    if (!activeMonthKey) return baseFilteredRows;
    return baseFilteredRows.filter((row) => row.monthKey === activeMonthKey);
  }, [activeMonthKey, baseFilteredRows]);

  const previousMonthKey = useMemo(() => {
    if (!activeMonthKey) return null;
    const [yearValue, monthValue] = activeMonthKey.split('-').map(Number);
    if (!yearValue || !monthValue) return null;
    const previous = new Date(yearValue, monthValue - 2, 1);
    return toMonthKey(previous);
  }, [activeMonthKey]);

  const previousRows = useMemo(() => {
    if (!previousMonthKey) return [];
    return baseFilteredRows.filter((row) => row.monthKey === previousMonthKey);
  }, [baseFilteredRows, previousMonthKey]);

  const fleetSummary = useMemo(() => buildCounts(currentRows, ['fleet']), [currentRows]);
  const remarkSummary = useMemo(() => buildCounts(currentRows, ['remarks']), [currentRows]);
  const vehicleSummary = useMemo(() => buildCounts(currentRows, ['vehicle']), [currentRows]);
  const topFleets = fleetSummary.slice(0, 6);
  const topRemarks = remarkSummary.slice(0, 6);
  const topVehicles = vehicleSummary.slice(0, 6);
  const maxFleetTotal = topFleets[0]?.total ?? 0;
  const maxRemarkTotal = topRemarks[0]?.total ?? 0;
  const maxVehicleTotal = topVehicles[0]?.total ?? 0;

  const countMatches = (targetLabel: string, field: 'remarks' | 'alertType', dataset: typeof currentRows) => {
    const normalizedTarget = normalizeLabel(targetLabel);
    return dataset.reduce((total, row) => {
      const value = field === 'remarks' ? row.remarks : row.alertType;
      if (!value || value === '—') return total;
      const normalizedValue = normalizeLabel(value);
      return normalizedValue.includes(normalizedTarget) ? total + 1 : total;
    }, 0);
  };

  const highlightItems = useMemo(() => {
    type HighlightItem = {
      label: string;
      field: 'remarks' | 'alertType';
      current: number;
      previous: number;
    };
    const remarkTargets = [
      'Fatigue',
      'Yawning',
      'Distraction',
      'Smoking',
      'Mobile Phone',
      'Seatbelt',
      'Eating/Drinking',
    ];
    const items: HighlightItem[] = remarkTargets.map((label) => ({
      label,
      field: 'remarks' as const,
      current: countMatches(label, 'remarks', currentRows),
      previous: countMatches(label, 'remarks', previousRows),
    }));
    items.push({
      label: 'Forward collision',
      field: 'alertType',
      current: countMatches('Forward Collision', 'alertType', currentRows),
      previous: countMatches('Forward Collision', 'alertType', previousRows),
    });
    return items;
  }, [currentRows, previousRows]);

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
          <div className="flex flex-col gap-6">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-medium">Filters</h2>
                  <p className="text-sm text-slate-400">
                    Narrow alerts by alert type, remark, month, fleet, or vehicle.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAlertFilter('all');
                    setMonthFilter('all');
                    setFleetFilter('all');
                    setRemarkFilter('all');
                    setVehicleFilter('all');
                  }}
                  className="text-sm font-semibold text-indigo-300 hover:text-indigo-200"
                >
                  Reset filters
                </button>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Alert type</label>
                  <select
                    value={alertFilter}
                    onChange={(event) => setAlertFilter(event.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                  >
                    <option value="all">All alert types</option>
                    {alertOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Filter by month</label>
                  <select
                    value={monthFilter}
                    onChange={(event) => setMonthFilter(event.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                  >
                    <option value="all">All months</option>
                    {monthOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Filter by fleet</label>
                  <select
                    value={fleetFilter}
                    onChange={(event) => setFleetFilter(event.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                  >
                    <option value="all">All fleets</option>
                    {fleetOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Filter by remark</label>
                  <select
                    value={remarkFilter}
                    onChange={(event) => setRemarkFilter(event.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                  >
                    <option value="all">All remarks</option>
                    {remarkOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Filter by vehicle</label>
                  <select
                    value={vehicleFilter}
                    onChange={(event) => setVehicleFilter(event.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                  >
                    <option value="all">All vehicles</option>
                    {vehicleOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
              <h2 className="text-lg font-medium">Alert remark highlights</h2>
              <p className="text-sm text-slate-400">
                Showing {activeMonthLabel} totals with change versus last month.
              </p>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {highlightItems.map((item) => {
                  const summary = buildDeltaSummary(item.current, item.previous);
                  return (
                    <div key={item.label} className="rounded-2xl border border-indigo-500/20 bg-slate-900/40 p-4">
                      <div className="text-sm text-slate-300">{item.label}</div>
                      <div className="mt-2 text-2xl font-semibold text-white">{item.current}</div>
                      <div
                        className={`mt-3 text-sm ${summary.isIncrease ? 'text-emerald-300' : 'text-rose-300'}`}
                      >
                        {summary.deltaLabel}
                      </div>
                      <div className="text-xs text-slate-400">{summary.percentLabel}</div>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-3">
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

              <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
                <h2 className="text-lg font-medium">Remarks volume</h2>
                <p className="text-sm text-slate-400">Most frequent remark tags in the filtered alerts.</p>
                <div className="mt-4 space-y-3">
                  {topRemarks.length === 0 ? (
                    <p className="text-sm text-slate-400">No remark data available.</p>
                  ) : (
                    topRemarks.map((row) => (
                      <div key={row.label} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-200">{row.label}</span>
                          <span className="text-slate-400">{row.total}</span>
                        </div>
                        <Bar value={row.total} max={maxRemarkTotal} />
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
                <h2 className="text-lg font-medium">Vehicle volume</h2>
                <p className="text-sm text-slate-400">Top vehicles based on alert activity.</p>
                <div className="mt-4 space-y-3">
                  {topVehicles.length === 0 ? (
                    <p className="text-sm text-slate-400">No vehicle data available.</p>
                  ) : (
                    topVehicles.map((row) => (
                      <div key={row.label} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-200">{row.label}</span>
                          <span className="text-slate-400">{row.total}</span>
                        </div>
                        <Bar value={row.total} max={maxVehicleTotal} />
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

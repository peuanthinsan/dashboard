'use client';

import { useMemo, useState } from 'react';
import useGoogleSheet from './useGoogleSheet';

type DashboardProps = {
  dashboardName: string;
  sheetId: string;
  sheetGid: string;
};

const normalizeLabel = (value: string) => value.trim().toLowerCase();

const ALERT_TYPE_LABELS = ['Alert Type', 'Alert'];
const FLEET_LABELS = ['Fleet', 'Fleet Name'];
const REMARK_LABELS = ['Remark', 'Remarks', 'Alert Remark', 'Alert Remarks'];
const VEHICLE_LABELS = ['Vehicle No', 'Vehicle No.', 'Vehicle', 'Vehicle Number'];
const MONTH_LABELS = ['Month', 'Alert Month'];
const DATE_LABELS = ['Alert Date', 'Date', 'Timestamp', 'Event Time'];
const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

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

const parseDate = (value: unknown) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const stringValue = String(value).trim();
  if (!stringValue) return null;
  const parsed = new Date(stringValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatMonthLabel = (value: unknown) => {
  const parsed = parseDate(value);
  if (parsed) return MONTH_FORMATTER.format(parsed);
  if (!value) return null;
  return String(value).trim() || null;
};

const getMonthLabel = (row: Record<string, any>) => {
  const monthValue = findValue(row, MONTH_LABELS) ?? findValue(row, DATE_LABELS);
  return formatMonthLabel(monthValue);
};

const formatDelta = (value: number) => (value > 0 ? `+${value}` : `${value}`);

const buildOptions = (rows: Record<string, any>[], labels: string[], fallbackLabel: string) => {
  const values = new Set<string>();
  rows.forEach((row) => {
    const value = findValue(row, labels);
    if (value === null || value === undefined) return;
    const label = String(value).trim();
    if (label) values.add(label);
  });
  return [fallbackLabel, ...Array.from(values).sort((a, b) => a.localeCompare(b))];
};

const buildMonthOptions = (rows: Record<string, any>[]) => {
  const map = new Map<string, Date | null>();
  rows.forEach((row) => {
    const raw = findValue(row, MONTH_LABELS) ?? findValue(row, DATE_LABELS);
    if (!raw) return;
    const label = formatMonthLabel(raw);
    if (!label) return;
    if (!map.has(label)) {
      map.set(label, parseDate(raw));
    }
  });
  const sorted = Array.from(map.entries()).sort((a, b) => {
    const [labelA, dateA] = a;
    const [labelB, dateB] = b;
    if (dateA && dateB) return dateA.getTime() - dateB.getTime();
    if (dateA) return -1;
    if (dateB) return 1;
    return labelA.localeCompare(labelB);
  });
  return ['All months', ...sorted.map(([label]) => label)];
};

const buildSummaryCount = (rows: Record<string, any>[], labels: string[], target: string) => {
  const normalizedTarget = normalizeLabel(target);
  return rows.filter((row) => {
    const value = findValue(row, labels);
    if (!value) return false;
    return normalizeLabel(String(value)) === normalizedTarget;
  }).length;
};

const Bar = ({ value, max }: { value: number; max: number }) => {
  const width = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="h-2 w-full rounded-full bg-slate-800">
      <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${width}%` }} />
    </div>
  );
};

const FilterSelect = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) => (
  <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
    {label}
    <select
      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  </label>
);

export default function SummaryDashboard({ dashboardName, sheetId, sheetGid }: DashboardProps) {
  const { rows, loading, error, lastUpdated, refresh } = useGoogleSheet({ sheetId, gid: sheetGid });

  const [alertTypeFilter, setAlertTypeFilter] = useState('All alert types');
  const [monthFilter, setMonthFilter] = useState('All months');
  const [fleetFilter, setFleetFilter] = useState('All fleets');
  const [remarkFilter, setRemarkFilter] = useState('All remarks');
  const [vehicleFilter, setVehicleFilter] = useState('All vehicles');

  const alertTypeOptions = useMemo(
    () => buildOptions(rows, ALERT_TYPE_LABELS, 'All alert types'),
    [rows],
  );
  const fleetOptions = useMemo(() => buildOptions(rows, FLEET_LABELS, 'All fleets'), [rows]);
  const remarkOptions = useMemo(() => buildOptions(rows, REMARK_LABELS, 'All remarks'), [rows]);
  const vehicleOptions = useMemo(() => buildOptions(rows, VEHICLE_LABELS, 'All vehicles'), [rows]);
  const monthOptions = useMemo(() => buildMonthOptions(rows), [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (alertTypeFilter !== 'All alert types') {
        const value = findValue(row, ALERT_TYPE_LABELS);
        if (!value || normalizeLabel(String(value)) !== normalizeLabel(alertTypeFilter)) return false;
      }
      if (fleetFilter !== 'All fleets') {
        const value = findValue(row, FLEET_LABELS);
        if (!value || normalizeLabel(String(value)) !== normalizeLabel(fleetFilter)) return false;
      }
      if (remarkFilter !== 'All remarks') {
        const value = findValue(row, REMARK_LABELS);
        if (!value || normalizeLabel(String(value)) !== normalizeLabel(remarkFilter)) return false;
      }
      if (vehicleFilter !== 'All vehicles') {
        const value = findValue(row, VEHICLE_LABELS);
        if (!value || normalizeLabel(String(value)) !== normalizeLabel(vehicleFilter)) return false;
      }
      if (monthFilter !== 'All months') {
        const monthLabel = getMonthLabel(row);
        if (!monthLabel || normalizeLabel(monthLabel) !== normalizeLabel(monthFilter)) return false;
      }
      return true;
    });
  }, [alertTypeFilter, fleetFilter, monthFilter, remarkFilter, rows, vehicleFilter]);

  const baseRowsForMonthCompare = useMemo(() => {
    return rows.filter((row) => {
      if (alertTypeFilter !== 'All alert types') {
        const value = findValue(row, ALERT_TYPE_LABELS);
        if (!value || normalizeLabel(String(value)) !== normalizeLabel(alertTypeFilter)) return false;
      }
      if (fleetFilter !== 'All fleets') {
        const value = findValue(row, FLEET_LABELS);
        if (!value || normalizeLabel(String(value)) !== normalizeLabel(fleetFilter)) return false;
      }
      if (remarkFilter !== 'All remarks') {
        const value = findValue(row, REMARK_LABELS);
        if (!value || normalizeLabel(String(value)) !== normalizeLabel(remarkFilter)) return false;
      }
      if (vehicleFilter !== 'All vehicles') {
        const value = findValue(row, VEHICLE_LABELS);
        if (!value || normalizeLabel(String(value)) !== normalizeLabel(vehicleFilter)) return false;
      }
      return true;
    });
  }, [alertTypeFilter, fleetFilter, remarkFilter, rows, vehicleFilter]);

  const alertTypeSummary = useMemo(() => buildCounts(filteredRows, ALERT_TYPE_LABELS), [filteredRows]);
  const remarkSummary = useMemo(() => buildCounts(filteredRows, REMARK_LABELS), [filteredRows]);
  const fleetSummary = useMemo(() => buildCounts(filteredRows, FLEET_LABELS), [filteredRows]);
  const topAlertTypes = alertTypeSummary.slice(0, 6);
  const topRemarks = remarkSummary.slice(0, 6);
  const topFleets = fleetSummary.slice(0, 6);
  const maxAlertTotal = topAlertTypes[0]?.total ?? 0;
  const maxRemarkTotal = topRemarks[0]?.total ?? 0;
  const maxFleetTotal = topFleets[0]?.total ?? 0;

  const availableMonths = useMemo(() => {
    const map = new Map<string, Date | null>();
    baseRowsForMonthCompare.forEach((row) => {
      const raw = findValue(row, MONTH_LABELS) ?? findValue(row, DATE_LABELS);
      if (!raw) return;
      const label = formatMonthLabel(raw);
      if (!label) return;
      if (!map.has(label)) {
        map.set(label, parseDate(raw));
      }
    });
    return Array.from(map.entries()).sort((a, b) => {
      const dateA = a[1];
      const dateB = b[1];
      if (dateA && dateB) return dateA.getTime() - dateB.getTime();
      if (dateA) return -1;
      if (dateB) return 1;
      return a[0].localeCompare(b[0]);
    });
  }, [baseRowsForMonthCompare]);

  const activeMonthLabel = useMemo(() => {
    if (monthFilter !== 'All months') return monthFilter;
    return availableMonths.at(-1)?.[0] ?? null;
  }, [availableMonths, monthFilter]);

  const previousMonthLabel = useMemo(() => {
    if (!activeMonthLabel) return null;
    const index = availableMonths.findIndex(([label]) => label === activeMonthLabel);
    if (index <= 0) return null;
    return availableMonths[index - 1]?.[0] ?? null;
  }, [activeMonthLabel, availableMonths]);

  const currentMonthRows = useMemo(() => {
    if (!activeMonthLabel) return [] as Record<string, any>[];
    return baseRowsForMonthCompare.filter((row) => {
      const monthLabel = getMonthLabel(row);
      return monthLabel && normalizeLabel(monthLabel) === normalizeLabel(activeMonthLabel);
    });
  }, [activeMonthLabel, baseRowsForMonthCompare]);

  const previousMonthRows = useMemo(() => {
    if (!previousMonthLabel) return [] as Record<string, any>[];
    return baseRowsForMonthCompare.filter((row) => {
      const monthLabel = getMonthLabel(row);
      return monthLabel && normalizeLabel(monthLabel) === normalizeLabel(previousMonthLabel);
    });
  }, [baseRowsForMonthCompare, previousMonthLabel]);

  const summaryItems = useMemo(
    () => [
      { label: 'Fatigue', type: 'remark' as const },
      { label: 'Yawning', type: 'remark' as const },
      { label: 'Distraction', type: 'remark' as const },
      { label: 'Smoking', type: 'remark' as const },
      { label: 'Mobile Phone', type: 'remark' as const },
      { label: 'Seatbelt', type: 'remark' as const },
      { label: 'Eating/Drinking', type: 'remark' as const },
      { label: 'Forward Collision', type: 'alert' as const },
    ],
    [],
  );

  const summaryCards = useMemo(() => {
    return summaryItems.map((item) => {
      const current =
        item.type === 'remark'
          ? buildSummaryCount(currentMonthRows, REMARK_LABELS, item.label)
          : buildSummaryCount(currentMonthRows, ALERT_TYPE_LABELS, item.label);
      const previous =
        item.type === 'remark'
          ? buildSummaryCount(previousMonthRows, REMARK_LABELS, item.label)
          : buildSummaryCount(previousMonthRows, ALERT_TYPE_LABELS, item.label);
      const delta = current - previous;
      const percentChange = previous === 0 ? null : (delta / previous) * 100;
      return {
        label: item.label,
        current,
        delta,
        percentChange,
      };
    });
  }, [currentMonthRows, previousMonthRows, summaryItems]);

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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium">Filters</h2>
                  <p className="text-sm text-slate-400">
                    Narrow alerts by alert type, remark, month, fleet, or vehicle.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAlertTypeFilter('All alert types');
                    setMonthFilter('All months');
                    setFleetFilter('All fleets');
                    setRemarkFilter('All remarks');
                    setVehicleFilter('All vehicles');
                  }}
                  className="text-sm font-medium text-indigo-300 hover:text-indigo-200"
                >
                  Reset filters
                </button>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <FilterSelect
                  label="Alert type"
                  value={alertTypeFilter}
                  options={alertTypeOptions}
                  onChange={setAlertTypeFilter}
                />
                <FilterSelect label="Filter by month" value={monthFilter} options={monthOptions} onChange={setMonthFilter} />
                <FilterSelect label="Filter by fleet" value={fleetFilter} options={fleetOptions} onChange={setFleetFilter} />
                <FilterSelect label="Filter by remark" value={remarkFilter} options={remarkOptions} onChange={setRemarkFilter} />
                <FilterSelect
                  label="Filter by vehicle"
                  value={vehicleFilter}
                  options={vehicleOptions}
                  onChange={setVehicleFilter}
                />
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-3">
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
                <h2 className="text-lg font-medium">Remarks volume</h2>
                <p className="text-sm text-slate-400">Which remarks appear most frequently based on the filters.</p>
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
            </div>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium">Alert remark highlights</h2>
                  {activeMonthLabel ? (
                    <p className="text-sm text-slate-400">
                      Showing {activeMonthLabel} totals with change versus last month.
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400">No month data available for comparison.</p>
                  )}
                </div>
                {previousMonthLabel ? (
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Compared to {previousMonthLabel}
                  </span>
                ) : null}
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map((card) => {
                  const isIncrease = card.delta > 0;
                  const isDecrease = card.delta < 0;
                  const deltaColor = isIncrease
                    ? 'text-emerald-300'
                    : isDecrease
                      ? 'text-rose-300'
                      : 'text-slate-400';
                  const percentLabel =
                    card.percentChange === null
                      ? 'No prior month data'
                      : `${card.percentChange > 0 ? '+' : ''}${card.percentChange.toFixed(1)}% change`;
                  return (
                    <div
                      key={card.label}
                      className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-5 shadow-sm"
                    >
                      <div className="text-sm text-slate-300">{card.label}</div>
                      <div className="mt-2 text-2xl font-semibold text-white">{card.current}</div>
                      <div className={`mt-3 text-sm font-medium ${deltaColor}`}>
                        {card.delta === 0 ? 'No change from last month' : `${formatDelta(card.delta)} from last month`}
                      </div>
                      <div className="text-xs text-slate-400">{percentLabel}</div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
              <h2 className="text-lg font-medium">Latest alert samples</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {filteredRows.length === 0 ? (
                  <p className="text-sm text-slate-400">No alerts found for the current filters.</p>
                ) : (
                  filteredRows.slice(0, 9).map((row, index) => {
                    const vehicle = findValue(row, VEHICLE_LABELS);
                    const alertType = findValue(row, ALERT_TYPE_LABELS);
                    const driver = findValue(row, ['Driver Name', 'Driver']);
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
                  })
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

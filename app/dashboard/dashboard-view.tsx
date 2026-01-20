'use client';

import { useMemo, useState } from 'react';
import type { DashboardTemplate } from './constants';
import { findHeader, parseDate } from './utils';
import RefreshButton from './refresh-button';

type DashboardData = {
  headers: string[];
  rows: Record<string, string>[];
};

type FilterOption = {
  key: string;
  label: string;
  values: string[];
};

type DashboardViewProps = {
  template: DashboardTemplate;
  title: string;
  data: DashboardData;
  lastUpdatedLabel: string;
};

const filterConfigs: Record<DashboardTemplate, string[]> = {
  Summary: ['remark', 'month', 'vehicle'],
  Detail: ['alertType', 'month', 'fleet', 'remark', 'vehicle'],
  Simple: ['month', 'vehicle'],
};

export default function DashboardView({
  template,
  title,
  data,
  lastUpdatedLabel,
}: DashboardViewProps) {
  const dateHeader = useMemo(
    () => findHeader(data.headers, ['date', 'alert time', 'timestamp']),
    [data.headers],
  );
  const remarkHeader = useMemo(
    () => findHeader(data.headers, ['remark', 'alert type', 'alert']),
    [data.headers],
  );
  const vehicleHeader = useMemo(
    () => findHeader(data.headers, ['vehicle', 'vehicle number']),
    [data.headers],
  );
  const fleetHeader = useMemo(
    () => findHeader(data.headers, ['fleet', 'company', 'organization']),
    [data.headers],
  );
  const alertTypeHeader = useMemo(
    () => findHeader(data.headers, ['alert type', 'type']),
    [data.headers],
  );

  const options = useMemo(() => {
    const rows = data.rows;
    const uniqueValues = (header: string | null) => {
      if (!header) return [];
      const values = Array.from(new Set(rows.map((row) => row[header]).filter(Boolean)));
      values.sort((a, b) => a.localeCompare(b));
      return values;
    };
    const monthValues = Array.from(
      new Set(
        rows
          .map((row) => {
            if (!dateHeader) return null;
            const date = parseDate(row[dateHeader]);
            if (!date) return null;
            return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
          })
          .filter(Boolean) as string[],
      ),
    ).sort((a, b) => a.localeCompare(b));

    const base: FilterOption[] = [];
    if (remarkHeader) {
      base.push({ key: 'remark', label: 'Remark type', values: uniqueValues(remarkHeader) });
    }
    if (alertTypeHeader && alertTypeHeader !== remarkHeader) {
      base.push({ key: 'alertType', label: 'Alert type', values: uniqueValues(alertTypeHeader) });
    }
    if (fleetHeader) {
      base.push({ key: 'fleet', label: 'Fleet', values: uniqueValues(fleetHeader) });
    }
    if (vehicleHeader) {
      base.push({ key: 'vehicle', label: 'Vehicle', values: uniqueValues(vehicleHeader) });
    }
    if (monthValues.length > 0) {
      base.push({ key: 'month', label: 'Month', values: monthValues });
    }
    return base;
  }, [data.rows, dateHeader, remarkHeader, alertTypeHeader, fleetHeader, vehicleHeader]);

  const filters = useMemo(() => {
    const config = filterConfigs[template];
    return config
      .map((key) => options.find((option) => option.key === key))
      .filter(Boolean) as FilterOption[];
  }, [options, template]);

  const [filterState, setFilterState] = useState<Record<string, string>>({});

  const filteredRows = useMemo(() => {
    return data.rows.filter((row) => {
      return Object.entries(filterState).every(([key, value]) => {
        if (!value) return true;
        if (key === 'month' && dateHeader) {
          const date = parseDate(row[dateHeader]);
          if (!date) return false;
          const monthLabel = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
          return monthLabel === value;
        }
        if (key === 'remark' && remarkHeader) {
          return row[remarkHeader] === value;
        }
        if (key === 'alertType' && alertTypeHeader) {
          return row[alertTypeHeader] === value;
        }
        if (key === 'fleet' && fleetHeader) {
          return row[fleetHeader] === value;
        }
        if (key === 'vehicle' && vehicleHeader) {
          return row[vehicleHeader] === value;
        }
        return true;
      });
    });
  }, [
    data.rows,
    filterState,
    dateHeader,
    remarkHeader,
    alertTypeHeader,
    fleetHeader,
    vehicleHeader,
  ]);

  const remarkCounts = useMemo(() => {
    if (!remarkHeader) return [];
    const counts = new Map<string, number>();
    filteredRows.forEach((row) => {
      const key = row[remarkHeader] || 'Unknown';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredRows, remarkHeader]);

  const dailyTrend = useMemo(() => {
    if (!dateHeader) return [];
    const counts = new Map<string, number>();
    filteredRows.forEach((row) => {
      const date = parseDate(row[dateHeader]);
      if (!date) return;
      const label = date.toISOString().slice(0, 10);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredRows, dateHeader]);

  const vehicleCounts = useMemo(() => {
    if (!vehicleHeader) return [];
    const counts = new Map<string, number>();
    filteredRows.forEach((row) => {
      const key = row[vehicleHeader] || 'Unknown';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [filteredRows, vehicleHeader]);

  const fleetCounts = useMemo(() => {
    if (!fleetHeader) return [];
    const counts = new Map<string, number>();
    filteredRows.forEach((row) => {
      const key = row[fleetHeader] || 'Unknown';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [filteredRows, fleetHeader]);

  const highlightCards = remarkCounts.slice(0, template === 'Detail' ? 6 : 3);
  const tableHeaders = useMemo(() => {
    const priority = [dateHeader, vehicleHeader, remarkHeader, alertTypeHeader, fleetHeader];
    const unique = priority.filter(
      (value, index, array) => value && array.indexOf(value) === index,
    ) as string[];
    if (unique.length >= 4) return unique.slice(0, 4);
    return data.headers.slice(0, 4);
  }, [data.headers, dateHeader, vehicleHeader, remarkHeader, alertTypeHeader, fleetHeader]);

  const handleReset = () => setFilterState({});

  return (
    <div className="flex min-h-screen flex-col gap-6 bg-slate-50 px-6 py-10 text-slate-900">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">{title}</h1>
            <p className="text-sm text-slate-500">
              Explore alert trends across your vehicles and remarks.
            </p>
            <p className="text-xs text-slate-400">Last updated {lastUpdatedLabel}</p>
          </div>
          <div className="self-start">
            <RefreshButton />
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
            <p className="text-sm text-slate-500">
              Narrow alerts by remark, vehicle, and time period.
            </p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="text-sm font-semibold text-blue-500 hover:text-blue-600"
          >
            Reset filters
          </button>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {filters.map((filter) => (
            <label key={filter.key} className="flex flex-col gap-2 text-xs text-slate-500">
              {filter.label}
              <select
                value={filterState[filter.key] ?? ''}
                onChange={(event) =>
                  setFilterState((prev) => ({ ...prev, [filter.key]: event.target.value }))
                }
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
              >
                <option value="">All</option>
                {filter.values.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Monthly remark highlights</h2>
          <p className="text-sm text-slate-500">
            Showing current totals across the selected filters.
          </p>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {highlightCards.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              No data available for the selected filters.
            </div>
          ) : (
            highlightCards.map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4 shadow-sm"
              >
                <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
                <p className="mt-2 text-xs text-emerald-600">+{value} total alerts</p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Daily alert trend</h2>
        <div className="mt-4 h-56 w-full">
          {dailyTrend.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              No daily trend data available.
            </div>
          ) : (
            <svg viewBox="0 0 100 40" className="h-full w-full">
              <polyline
                fill="none"
                stroke="#a78bfa"
                strokeWidth="1.8"
                points={dailyTrend
                  .map(([, count], index) => {
                    const max = Math.max(...dailyTrend.map((item) => item[1]), 1);
                    const x = dailyTrend.length === 1 ? 50 : (index / (dailyTrend.length - 1)) * 100;
                    const y = 36 - (count / max) * 30;
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />
            </svg>
          )}
        </div>
      </section>

      {template !== 'Simple' && (
        <section className="mx-auto w-full max-w-6xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">
            {template === 'Detail' ? 'Remarks by fleet' : 'Alert mix by vehicle'}
          </h2>
          <div className="mt-4 grid gap-3">
            {(template === 'Detail' ? fleetCounts : vehicleCounts).map(([label, value]) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-28 truncate text-xs text-slate-500">{label}</div>
                <div className="h-3 flex-1 rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-blue-400"
                    style={{
                      width: `${Math.min(
                        100,
                        (value /
                          Math.max(
                            ...(template === 'Detail' ? fleetCounts : vehicleCounts).map(
                              (item) => item[1],
                            ),
                          )) *
                          100,
                      )}%`,
                    }}
                  />
                </div>
                <div className="w-10 text-right text-xs text-slate-500">{value}</div>
              </div>
            ))}
            {(template === 'Detail' ? fleetCounts : vehicleCounts).length === 0 && (
              <div className="text-sm text-slate-500">No vehicle data available.</div>
            )}
          </div>
        </section>
      )}

      {template === 'Detail' && (
        <section className="mx-auto w-full max-w-6xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Top vehicles by alert count</h2>
          <div className="mt-4 grid gap-3">
            {vehicleCounts.map(([label, value]) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-32 truncate text-xs text-slate-500">{label}</div>
                <div className="h-3 flex-1 rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-400"
                    style={{
                      width: `${Math.min(
                        100,
                        (value / Math.max(...vehicleCounts.map((item) => item[1]), 1)) * 100,
                      )}%`,
                    }}
                  />
                </div>
                <div className="w-10 text-right text-xs text-slate-500">{value}</div>
              </div>
            ))}
            {vehicleCounts.length === 0 && (
              <div className="text-sm text-slate-500">No vehicle data available.</div>
            )}
          </div>
        </section>
      )}

      <section className="mx-auto w-full max-w-6xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Alerts by vehicle and date</h2>
            <p className="text-xs text-slate-400">
              Tip: Export the data to your sheet for deeper analysis.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
            {filteredRows.length} rows
          </span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
                {tableHeaders.map((header) => (
                  <th key={header} className="px-3 py-2 font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.slice(0, 10).map((row, index) => (
                <tr key={`${row[tableHeaders[0]]}-${index}`} className="border-b">
                  {tableHeaders.map((header) => (
                    <td key={header} className="px-3 py-2 text-slate-600">
                      {row[header] || '—'}
                    </td>
                  ))}
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-center text-sm text-slate-500" colSpan={4}>
                    No alert data found for these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

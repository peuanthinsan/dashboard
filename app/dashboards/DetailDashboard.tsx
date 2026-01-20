'use client';

import { useMemo, useState } from 'react';
import useGoogleSheet from './useGoogleSheet';

type DashboardProps = {
  dashboardName: string;
  sheetId: string;
  sheetGid: string;
};

type AlertRow = {
  id: string;
  vehicle: string;
  driver: string;
  alertType: string;
  time: string;
  speed: string;
  remarks: string;
  fleet: string;
  videoUrl: string;
  monthKey: string | null;
  monthLabel: string;
  dateValue: unknown;
  parsedDate: Date | null;
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

const toDayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const toDateLabel = (value: unknown) => {
  if (!value) return '—';
  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toLocaleString();
};

export default function DetailDashboard({ dashboardName, sheetId, sheetGid }: DashboardProps) {
  const { rows, loading, error, lastUpdated, refresh } = useGoogleSheet({ sheetId, gid: sheetGid });
  const [alertSearch, setAlertSearch] = useState('');
  const [alertFilters, setAlertFilters] = useState<string[]>([]);
  const [monthSearch, setMonthSearch] = useState('');
  const [monthFilters, setMonthFilters] = useState<string[]>([]);
  const [fleetSearch, setFleetSearch] = useState('');
  const [fleetFilters, setFleetFilters] = useState<string[]>([]);
  const [remarkSearch, setRemarkSearch] = useState('');
  const [remarkFilters, setRemarkFilters] = useState<string[]>([]);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [vehicleFilters, setVehicleFilters] = useState<string[]>([]);

  const alertRows = useMemo<AlertRow[]>(() => {
    return rows.map((row, index) => {
      const timeValue = findValue(row, ['Alert Date Time', 'Track Time', 'Date']);
      const parsedDate = parseDate(timeValue);
      const monthKey = parsedDate ? toMonthKey(parsedDate) : null;
      const monthLabel = parsedDate ? toMonthLabel(parsedDate) : 'Unknown month';
      return {
        id: `${index}-${findValue(row, ['Vehicle No']) ?? 'vehicle'}`,
        vehicle: toDisplayString(findValue(row, ['Vehicle No', 'Vehicle No TH'])),
        driver: toDisplayString(findValue(row, ['Driver Name'])),
        alertType: toDisplayString(findValue(row, ['Alert Type'])),
        time: toDateLabel(timeValue),
        speed: toDisplayString(findValue(row, ['Speed'])),
        remarks: toDisplayString(findValue(row, ['Remarks'])),
        fleet: toDisplayString(findValue(row, ['Fleet'])),
        videoUrl: toDisplayString(findValue(row, ['videoURL', 'Videoit'])),
        monthKey,
        monthLabel,
        dateValue: timeValue,
        parsedDate,
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

  const filteredAlertOptions = useMemo(() => {
    const trimmedSearch = alertSearch.trim();
    if (!trimmedSearch) return alertOptions;
    const normalizedSearch = normalizeLabel(trimmedSearch);
    return alertOptions.filter((option) => normalizeLabel(option).includes(normalizedSearch));
  }, [alertOptions, alertSearch]);

  const fleetOptions = useMemo(() => {
    const unique = new Set<string>();
    alertRows.forEach((row) => {
      if (row.fleet && row.fleet !== '—') unique.add(row.fleet);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [alertRows]);

  const filteredFleetOptions = useMemo(() => {
    const trimmedSearch = fleetSearch.trim();
    if (!trimmedSearch) return fleetOptions;
    const normalizedSearch = normalizeLabel(trimmedSearch);
    return fleetOptions.filter((option) => normalizeLabel(option).includes(normalizedSearch));
  }, [fleetOptions, fleetSearch]);

  const remarkOptions = useMemo(() => {
    const unique = new Set<string>();
    alertRows.forEach((row) => {
      if (row.remarks && row.remarks !== '—') unique.add(row.remarks);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [alertRows]);

  const filteredRemarkOptions = useMemo(() => {
    const trimmedSearch = remarkSearch.trim();
    if (!trimmedSearch) return remarkOptions;
    const normalizedSearch = normalizeLabel(trimmedSearch);
    return remarkOptions.filter((option) => normalizeLabel(option).includes(normalizedSearch));
  }, [remarkOptions, remarkSearch]);

  const vehicleOptions = useMemo(() => {
    const unique = new Set<string>();
    alertRows.forEach((row) => {
      if (row.vehicle && row.vehicle !== '—') unique.add(row.vehicle);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [alertRows]);

  const filteredVehicleOptions = useMemo(() => {
    const trimmedSearch = vehicleSearch.trim();
    if (!trimmedSearch) return vehicleOptions;
    const normalizedSearch = normalizeLabel(trimmedSearch);
    return vehicleOptions.filter((option) => normalizeLabel(option).includes(normalizedSearch));
  }, [vehicleOptions, vehicleSearch]);

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

  const filteredMonthOptions = useMemo(() => {
    const trimmedSearch = monthSearch.trim();
    if (!trimmedSearch) return monthOptions;
    const normalizedSearch = normalizeLabel(trimmedSearch);
    return monthOptions.filter((option) => normalizeLabel(option.label).includes(normalizedSearch));
  }, [monthOptions, monthSearch]);

  const baseFilteredRows = useMemo(() => {
    const normalizedAlertFilters = alertFilters.map((alert) => normalizeLabel(alert));
    const normalizedFleetFilters = fleetFilters.map((fleet) => normalizeLabel(fleet));
    const normalizedRemarkFilters = remarkFilters.map((remark) => normalizeLabel(remark));
    const normalizedVehicleFilters = vehicleFilters.map((vehicle) => normalizeLabel(vehicle));
    return alertRows.filter((row) => {
      if (normalizedAlertFilters.length > 0) {
        const normalizedAlert = normalizeLabel(row.alertType);
        if (!normalizedAlertFilters.includes(normalizedAlert)) return false;
      }
      if (normalizedFleetFilters.length > 0) {
        const normalizedFleet = normalizeLabel(row.fleet);
        if (!normalizedFleetFilters.includes(normalizedFleet)) return false;
      }
      if (normalizedRemarkFilters.length > 0) {
        const normalizedRemark = normalizeLabel(row.remarks);
        if (!normalizedRemarkFilters.includes(normalizedRemark)) return false;
      }
      if (normalizedVehicleFilters.length > 0) {
        const normalizedVehicle = normalizeLabel(row.vehicle);
        if (!normalizedVehicleFilters.includes(normalizedVehicle)) return false;
      }
      return true;
    });
  }, [alertFilters, alertRows, fleetFilters, remarkFilters, vehicleFilters]);

  const filteredAlerts = useMemo(() => {
    if (monthFilters.length === 0) return baseFilteredRows;
    return baseFilteredRows.filter((row) => row.monthKey && monthFilters.includes(row.monthKey));
  }, [baseFilteredRows, monthFilters]);

  const trendData = useMemo(() => {
    const counts = new Map<string, { key: string; date: Date; count: number }>();
    filteredAlerts.forEach((row) => {
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
  }, [filteredAlerts]);

  const maxTrendValue = trendData.reduce((max, item) => Math.max(max, item.count), 0);
  const trendPoints = useMemo(() => {
    const width = 1000;
    const height = 260;
    const padding = { top: 24, right: 24, bottom: 36, left: 56 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    if (trendData.length === 0) {
      return { points: [], path: '', viewBox: `0 0 ${width} ${height}`, padding };
    }
    const maxValue = Math.max(1, maxTrendValue);
    const points = trendData.map((item, index) => {
      const x =
        trendData.length === 1
          ? padding.left + plotWidth / 2
          : padding.left + (index / (trendData.length - 1)) * plotWidth;
      const y = padding.top + (1 - item.count / maxValue) * plotHeight;
      return { x, y, count: item.count };
    });
    const path = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(' ');
    return { points, path, viewBox: `0 0 ${width} ${height}`, padding };
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
      const dataIndex =
        labelCount === 1 ? 0 : Math.round(position * (trendData.length - 1));
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
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Detail dashboard</p>
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
            Loading detailed alerts…
          </div>
        ) : (
          <>
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
                    setAlertSearch('');
                    setAlertFilters([]);
                    setMonthSearch('');
                    setMonthFilters([]);
                    setFleetSearch('');
                    setFleetFilters([]);
                    setRemarkSearch('');
                    setRemarkFilters([]);
                    setVehicleSearch('');
                    setVehicleFilters([]);
                  }}
                  className="text-sm font-semibold text-indigo-300 hover:text-indigo-200"
                >
                  Reset filters
                </button>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Search alert types</label>
                  <input
                    type="text"
                    value={alertSearch}
                    onChange={(event) => setAlertSearch(event.target.value)}
                    placeholder="Search alerts..."
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                  />
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/40 p-2 text-sm">
                    {filteredAlertOptions.length === 0 ? (
                      <p className="text-xs text-slate-500">No alert types found.</p>
                    ) : (
                      <ul className="space-y-1">
                        {filteredAlertOptions.map((option) => {
                          const isSelected = alertFilters.includes(option);
                          return (
                            <li key={option}>
                              <button
                                type="button"
                                onClick={() => {
                                  setAlertFilters((current) =>
                                    isSelected ? current.filter((value) => value !== option) : [...current, option],
                                  );
                                }}
                                className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left transition ${
                                  isSelected
                                    ? 'bg-indigo-500/20 text-indigo-100'
                                    : 'text-slate-200 hover:bg-slate-800'
                                }`}
                              >
                                <span>{option}</span>
                                <span className="text-xs text-slate-400">{isSelected ? 'Selected' : 'Add'}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  {alertFilters.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {alertFilters.map((alert) => (
                        <button
                          key={alert}
                          type="button"
                          onClick={() => setAlertFilters((current) => current.filter((value) => value !== alert))}
                          className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2 py-1 text-xs text-indigo-100"
                        >
                          {alert} ×
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Search months</label>
                  <input
                    type="text"
                    value={monthSearch}
                    onChange={(event) => setMonthSearch(event.target.value)}
                    placeholder="Search months..."
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                  />
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/40 p-2 text-sm">
                    {filteredMonthOptions.length === 0 ? (
                      <p className="text-xs text-slate-500">No months found.</p>
                    ) : (
                      <ul className="space-y-1">
                        {filteredMonthOptions.map((option) => {
                          const isSelected = monthFilters.includes(option.key);
                          return (
                            <li key={option.key}>
                              <button
                                type="button"
                                onClick={() => {
                                  setMonthFilters((current) =>
                                    isSelected ? current.filter((value) => value !== option.key) : [...current, option.key],
                                  );
                                }}
                                className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left transition ${
                                  isSelected
                                    ? 'bg-indigo-500/20 text-indigo-100'
                                    : 'text-slate-200 hover:bg-slate-800'
                                }`}
                              >
                                <span>{option.label}</span>
                                <span className="text-xs text-slate-400">{isSelected ? 'Selected' : 'Add'}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  {monthFilters.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {monthFilters.map((monthKey) => {
                        const monthLabel = monthOptions.find((option) => option.key === monthKey)?.label ?? monthKey;
                        return (
                          <button
                            key={monthKey}
                            type="button"
                            onClick={() => setMonthFilters((current) => current.filter((value) => value !== monthKey))}
                            className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2 py-1 text-xs text-indigo-100"
                          >
                            {monthLabel} ×
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Search fleets</label>
                  <input
                    type="text"
                    value={fleetSearch}
                    onChange={(event) => setFleetSearch(event.target.value)}
                    placeholder="Search fleets..."
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                  />
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/40 p-2 text-sm">
                    {filteredFleetOptions.length === 0 ? (
                      <p className="text-xs text-slate-500">No fleets found.</p>
                    ) : (
                      <ul className="space-y-1">
                        {filteredFleetOptions.map((option) => {
                          const isSelected = fleetFilters.includes(option);
                          return (
                            <li key={option}>
                              <button
                                type="button"
                                onClick={() => {
                                  setFleetFilters((current) =>
                                    isSelected ? current.filter((value) => value !== option) : [...current, option],
                                  );
                                }}
                                className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left transition ${
                                  isSelected
                                    ? 'bg-indigo-500/20 text-indigo-100'
                                    : 'text-slate-200 hover:bg-slate-800'
                                }`}
                              >
                                <span>{option}</span>
                                <span className="text-xs text-slate-400">{isSelected ? 'Selected' : 'Add'}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  {fleetFilters.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {fleetFilters.map((fleet) => (
                        <button
                          key={fleet}
                          type="button"
                          onClick={() => setFleetFilters((current) => current.filter((value) => value !== fleet))}
                          className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2 py-1 text-xs text-indigo-100"
                        >
                          {fleet} ×
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Search remark types</label>
                  <input
                    type="text"
                    value={remarkSearch}
                    onChange={(event) => setRemarkSearch(event.target.value)}
                    placeholder="Search remarks..."
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                  />
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/40 p-2 text-sm">
                    {filteredRemarkOptions.length === 0 ? (
                      <p className="text-xs text-slate-500">No remarks found.</p>
                    ) : (
                      <ul className="space-y-1">
                        {filteredRemarkOptions.map((option) => {
                          const isSelected = remarkFilters.includes(option);
                          return (
                            <li key={option}>
                              <button
                                type="button"
                                onClick={() => {
                                  setRemarkFilters((current) =>
                                    isSelected ? current.filter((value) => value !== option) : [...current, option],
                                  );
                                }}
                                className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left transition ${
                                  isSelected
                                    ? 'bg-indigo-500/20 text-indigo-100'
                                    : 'text-slate-200 hover:bg-slate-800'
                                }`}
                              >
                                <span>{option}</span>
                                <span className="text-xs text-slate-400">{isSelected ? 'Selected' : 'Add'}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  {remarkFilters.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {remarkFilters.map((remark) => (
                        <button
                          key={remark}
                          type="button"
                          onClick={() => setRemarkFilters((current) => current.filter((value) => value !== remark))}
                          className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2 py-1 text-xs text-indigo-100"
                        >
                          {remark} ×
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Search vehicle number</label>
                  <input
                    type="text"
                    value={vehicleSearch}
                    onChange={(event) => setVehicleSearch(event.target.value)}
                    placeholder="Search vehicles..."
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                  />
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/40 p-2 text-sm">
                    {filteredVehicleOptions.length === 0 ? (
                      <p className="text-xs text-slate-500">No vehicles found.</p>
                    ) : (
                      <ul className="space-y-1">
                        {filteredVehicleOptions.map((option) => {
                          const isSelected = vehicleFilters.includes(option);
                          return (
                            <li key={option}>
                              <button
                                type="button"
                                onClick={() => {
                                  setVehicleFilters((current) =>
                                    isSelected ? current.filter((value) => value !== option) : [...current, option],
                                  );
                                }}
                                className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left transition ${
                                  isSelected
                                    ? 'bg-indigo-500/20 text-indigo-100'
                                    : 'text-slate-200 hover:bg-slate-800'
                                }`}
                              >
                                <span>{option}</span>
                                <span className="text-xs text-slate-400">{isSelected ? 'Selected' : 'Add'}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  {vehicleFilters.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {vehicleFilters.map((vehicle) => (
                        <button
                          key={vehicle}
                          type="button"
                          onClick={() =>
                            setVehicleFilters((current) => current.filter((value) => value !== vehicle))
                          }
                          className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2 py-1 text-xs text-indigo-100"
                        >
                          {vehicle} ×
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-medium">Daily alert trend</h2>
                  <p className="text-sm text-slate-400">Daily totals for the filtered alert set.</p>
                </div>
                <span className="text-sm text-slate-400">{filteredAlerts.length} alerts</span>
              </div>
              <div className="mt-4">
                {trendData.length === 0 ? (
                  <p className="text-sm text-slate-400">No alert activity available for the selected filters.</p>
                ) : (
                  <svg
                    viewBox={trendPoints.viewBox}
                    className="h-64 w-full"
                    role="img"
                    aria-label="Daily alert trend"
                  >
                    <defs>
                      <linearGradient id="trend-line" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="#a78bfa" />
                        <stop offset="100%" stopColor="#c4b5fd" />
                      </linearGradient>
                    </defs>
                    <rect
                      x="0"
                      y="0"
                      width="100%"
                      height="100%"
                      fill="transparent"
                      rx="16"
                    />
                    {yAxisTicks.map((tick) => {
                      const y =
                        trendPoints.padding.top +
                        tick.position * (260 - trendPoints.padding.top - trendPoints.padding.bottom);
                      return (
                        <g key={`tick-${tick.value}`}>
                          <line
                            x1={trendPoints.padding.left}
                            x2={1000 - trendPoints.padding.right}
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
                      y2={260 - trendPoints.padding.bottom}
                      stroke="#334155"
                    />
                    <line
                      x1={trendPoints.padding.left}
                      x2={1000 - trendPoints.padding.right}
                      y1={260 - trendPoints.padding.bottom}
                      y2={260 - trendPoints.padding.bottom}
                      stroke="#334155"
                    />
                    <path d={trendPoints.path} fill="none" stroke="url(#trend-line)" strokeWidth="3" />
                    {trendPoints.points.map((point, index) => (
                      <circle
                        key={`point-${index}`}
                        cx={point.x}
                        cy={point.y}
                        r="5"
                        fill="#0f172a"
                        stroke="#c4b5fd"
                        strokeWidth="2"
                      />
                    ))}
                    {xAxisLabels.map((label) => {
                      const x =
                        trendPoints.padding.left +
                        label.position * (1000 - trendPoints.padding.left - trendPoints.padding.right);
                      return (
                        <text
                          key={`label-${label.label}-${label.position}`}
                          x={x}
                          y={260 - trendPoints.padding.bottom + 20}
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
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">Alerts</h2>
                <span className="text-sm text-slate-400">{filteredAlerts.length} rows</span>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs uppercase tracking-[0.2em] text-slate-400">
                      <th className="py-3 pr-4">Alert time</th>
                      <th className="py-3 pr-4">Vehicle</th>
                      <th className="py-3 pr-4">Driver</th>
                      <th className="py-3 pr-4">Alert type</th>
                      <th className="py-3 pr-4">Speed</th>
                      <th className="py-3 pr-4">Fleet</th>
                      <th className="py-3 pr-4">Remarks</th>
                      <th className="py-3">Video</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAlerts.slice(0, 200).map((row) => (
                      <tr key={row.id} className="border-b border-slate-900/80 text-slate-200">
                        <td className="py-3 pr-4 text-slate-300">{row.time}</td>
                        <td className="py-3 pr-4 font-semibold text-white">{row.vehicle}</td>
                        <td className="py-3 pr-4">{row.driver}</td>
                        <td className="py-3 pr-4">{row.alertType}</td>
                        <td className="py-3 pr-4">{row.speed}</td>
                        <td className="py-3 pr-4">{row.fleet}</td>
                        <td className="py-3 pr-4">{row.remarks}</td>
                        <td className="py-3">
                          {row.videoUrl !== '—' ? (
                            <a
                              href={row.videoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-300 hover:text-indigo-200"
                            >
                              View
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredAlerts.length > 200 ? (
                <p className="mt-3 text-xs text-slate-400">Showing the first 200 alerts.</p>
              ) : null}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

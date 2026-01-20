'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import useGoogleSheet from './useGoogleSheet';

type DashboardProps = {
  dashboardName: string;
  sheetId: string;
  sheetGid: string;
  organizationName?: string | null;
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

type TrendPoint = {
  x: number;
  y: number;
  count: number;
  label: string;
};

type SortField = 'time' | 'vehicle' | 'driver' | 'alertType' | 'speed' | 'fleet' | 'remarks';
type SortDirection = 'asc' | 'desc';
type SortCriterion = {
  field: SortField;
  direction: SortDirection;
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

export default function DetailDashboard({
  dashboardName,
  sheetId,
  sheetGid,
  organizationName,
}: DashboardProps) {
  const { rows, loading, error, lastUpdated, refresh } = useGoogleSheet({ sheetId, gid: sheetGid });
  const normalizedOrganizationName = useMemo(
    () => (organizationName ? normalizeLabel(organizationName) : null),
    [organizationName],
  );
  const currentMonthKey = useMemo(() => toMonthKey(new Date()), []);
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
  const [hoverPoint, setHoverPoint] = useState<TrendPoint | null>(null);
  const [pinnedPoint, setPinnedPoint] = useState<TrendPoint | null>(null);
  const [sortCriteria, setSortCriteria] = useState<SortCriterion[]>([]);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const didSetDefaultMonth = useRef(false);

  const alertRows = useMemo<AlertRow[]>(() => {
    const mappedRows = rows.map((row, index) => {
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
    if (!normalizedOrganizationName) {
      return mappedRows;
    }
    return mappedRows.filter((row) => normalizeLabel(row.fleet) === normalizedOrganizationName);
  }, [normalizedOrganizationName, rows]);

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

  useEffect(() => {
    if (didSetDefaultMonth.current) return;
    if (monthOptions.length === 0) return;
    didSetDefaultMonth.current = true;
    if (monthOptions.some((option) => option.key === currentMonthKey)) {
      setMonthFilters([currentMonthKey]);
    }
  }, [currentMonthKey, monthOptions]);

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

  const sortedAlerts = useMemo(() => {
    if (sortCriteria.length === 0) return filteredAlerts;
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    const getSortValue = (row: AlertRow, field: SortField) => {
      switch (field) {
        case 'time':
          return row.parsedDate ? row.parsedDate.getTime() : null;
        case 'vehicle':
          return row.vehicle;
        case 'driver':
          return row.driver;
        case 'alertType':
          return row.alertType;
        case 'speed': {
          const numeric = Number.parseFloat(String(row.speed).replace(/[^0-9.]/g, ''));
          return Number.isNaN(numeric) ? null : numeric;
        }
        case 'fleet':
          return row.fleet;
        case 'remarks':
          return row.remarks;
        default:
          return null;
      }
    };
    const compareValues = (aValue: string | number | null, bValue: string | number | null) => {
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return aValue - bValue;
      }
      return collator.compare(String(aValue), String(bValue));
    };
    return [...filteredAlerts].sort((a, b) => {
      for (const criterion of sortCriteria) {
        const order = criterion.direction === 'asc' ? 1 : -1;
        const comparison = compareValues(getSortValue(a, criterion.field), getSortValue(b, criterion.field));
        if (comparison !== 0) return comparison * order;
      }
      return 0;
    });
  }, [filteredAlerts, sortCriteria]);

  const totalAlerts = sortedAlerts.length;
  const totalPages = Math.max(1, Math.ceil(totalAlerts / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = totalAlerts === 0 ? 0 : (currentPage - 1) * pageSize;
  const endIndex = totalAlerts === 0 ? 0 : Math.min(startIndex + pageSize, totalAlerts);
  const paginatedAlerts = sortedAlerts.slice(startIndex, endIndex);

  useEffect(() => {
    setPage(1);
  }, [alertFilters, monthFilters, fleetFilters, remarkFilters, vehicleFilters]);

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
      const dataIndex =
        labelCount === 1 ? 0 : Math.round(position * (trendData.length - 1));
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
              <div className="mt-4 space-y-3 text-xs text-slate-300">
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
                  <span className="uppercase tracking-[0.2em] text-slate-500">Filter alert types</span>
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <div className="flex flex-wrap gap-2">
                      {alertFilters.map((alert) => (
                        <button
                          key={alert}
                          type="button"
                          onClick={() => setAlertFilters((current) => current.filter((value) => value !== alert))}
                          className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-100"
                        >
                          {alert} ×
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        list="alert-type-options"
                        value={alertSearch}
                        onChange={(event) => setAlertSearch(event.target.value)}
                        placeholder={alertOptions.length === 0 ? 'No alert types available' : 'Search alert types'}
                        className="min-w-[220px] rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                      />
                      <datalist id="alert-type-options">
                        {filteredAlertOptions.map((option) => (
                          <option key={option} value={option} />
                        ))}
                      </datalist>
                      <button
                        type="button"
                        onClick={() => {
                          const trimmed = alertSearch.trim();
                          if (!trimmed) return;
                          const matched = alertOptions.find(
                            (option) => normalizeLabel(option) === normalizeLabel(trimmed),
                          );
                          if (!matched) return;
                          setAlertFilters((current) => (current.includes(matched) ? current : [...current, matched]));
                          setAlertSearch('');
                          setPage(1);
                        }}
                        className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAlertFilters([]);
                      setPage(1);
                    }}
                    className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
                  >
                    Clear
                  </button>
                  {alertFilters.length > 0 ? (
                    <span className="text-slate-500">{alertFilters.length} selected</span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
                  <span className="uppercase tracking-[0.2em] text-slate-500">Filter months</span>
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <div className="flex flex-wrap gap-2">
                      {monthFilters.map((monthKey) => {
                        const monthLabel = monthOptions.find((option) => option.key === monthKey)?.label ?? monthKey;
                        return (
                          <button
                            key={monthKey}
                            type="button"
                            onClick={() => setMonthFilters((current) => current.filter((value) => value !== monthKey))}
                            className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-100"
                          >
                            {monthLabel} ×
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        list="month-options"
                        value={monthSearch}
                        onChange={(event) => setMonthSearch(event.target.value)}
                        placeholder={monthOptions.length === 0 ? 'No months available' : 'Search months'}
                        className="min-w-[220px] rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                      />
                      <datalist id="month-options">
                        {filteredMonthOptions.map((option) => (
                          <option key={option.key} value={option.label} />
                        ))}
                      </datalist>
                      <button
                        type="button"
                        onClick={() => {
                          const trimmed = monthSearch.trim();
                          if (!trimmed) return;
                          const matched = monthOptions.find(
                            (option) =>
                              option.key === trimmed || normalizeLabel(option.label) === normalizeLabel(trimmed),
                          );
                          if (!matched) return;
                          setMonthFilters((current) =>
                            current.includes(matched.key) ? current : [...current, matched.key],
                          );
                          setMonthSearch('');
                          setPage(1);
                        }}
                        className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMonthFilters([]);
                      setPage(1);
                    }}
                    className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
                  >
                    Clear
                  </button>
                  {monthFilters.length > 0 ? (
                    <span className="text-slate-500">{monthFilters.length} selected</span>
                  ) : null}
                </div>
                {organizationName ? null : (
                  <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
                    <span className="uppercase tracking-[0.2em] text-slate-500">Filter fleets</span>
                    <div className="flex flex-1 flex-wrap items-center gap-2">
                      <div className="flex flex-wrap gap-2">
                        {fleetFilters.map((fleet) => (
                          <button
                            key={fleet}
                            type="button"
                            onClick={() => setFleetFilters((current) => current.filter((value) => value !== fleet))}
                            className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-100"
                          >
                            {fleet} ×
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          list="fleet-options"
                          value={fleetSearch}
                          onChange={(event) => setFleetSearch(event.target.value)}
                          placeholder={fleetOptions.length === 0 ? 'No fleets available' : 'Search fleets'}
                          className="min-w-[220px] rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                        />
                        <datalist id="fleet-options">
                          {filteredFleetOptions.map((option) => (
                            <option key={option} value={option} />
                          ))}
                        </datalist>
                        <button
                          type="button"
                          onClick={() => {
                            const trimmed = fleetSearch.trim();
                            if (!trimmed) return;
                            const matched = fleetOptions.find(
                              (option) => normalizeLabel(option) === normalizeLabel(trimmed),
                            );
                            if (!matched) return;
                            setFleetFilters((current) =>
                              current.includes(matched) ? current : [...current, matched],
                            );
                            setFleetSearch('');
                            setPage(1);
                          }}
                          className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFleetFilters([]);
                        setPage(1);
                      }}
                      className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
                    >
                      Clear
                    </button>
                    {fleetFilters.length > 0 ? (
                      <span className="text-slate-500">{fleetFilters.length} selected</span>
                    ) : null}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
                  <span className="uppercase tracking-[0.2em] text-slate-500">Filter remark types</span>
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <div className="flex flex-wrap gap-2">
                      {remarkFilters.map((remark) => (
                        <button
                          key={remark}
                          type="button"
                          onClick={() => setRemarkFilters((current) => current.filter((value) => value !== remark))}
                          className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-100"
                        >
                          {remark} ×
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        list="remark-options"
                        value={remarkSearch}
                        onChange={(event) => setRemarkSearch(event.target.value)}
                        placeholder={remarkOptions.length === 0 ? 'No remarks available' : 'Search remarks'}
                        className="min-w-[220px] rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                      />
                      <datalist id="remark-options">
                        {filteredRemarkOptions.map((option) => (
                          <option key={option} value={option} />
                        ))}
                      </datalist>
                      <button
                        type="button"
                        onClick={() => {
                          const trimmed = remarkSearch.trim();
                          if (!trimmed) return;
                          const matched = remarkOptions.find(
                            (option) => normalizeLabel(option) === normalizeLabel(trimmed),
                          );
                          if (!matched) return;
                          setRemarkFilters((current) => (current.includes(matched) ? current : [...current, matched]));
                          setRemarkSearch('');
                          setPage(1);
                        }}
                        className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRemarkFilters([]);
                      setPage(1);
                    }}
                    className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
                  >
                    Clear
                  </button>
                  {remarkFilters.length > 0 ? (
                    <span className="text-slate-500">{remarkFilters.length} selected</span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
                  <span className="uppercase tracking-[0.2em] text-slate-500">Filter vehicles</span>
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <div className="flex flex-wrap gap-2">
                      {vehicleFilters.map((vehicle) => (
                        <button
                          key={vehicle}
                          type="button"
                          onClick={() =>
                            setVehicleFilters((current) => current.filter((value) => value !== vehicle))
                          }
                          className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-100"
                        >
                          {vehicle} ×
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        list="vehicle-options"
                        value={vehicleSearch}
                        onChange={(event) => setVehicleSearch(event.target.value)}
                        placeholder={vehicleOptions.length === 0 ? 'No vehicles available' : 'Search vehicles'}
                        className="min-w-[220px] rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                      />
                      <datalist id="vehicle-options">
                        {filteredVehicleOptions.map((option) => (
                          <option key={option} value={option} />
                        ))}
                      </datalist>
                      <button
                        type="button"
                        onClick={() => {
                          const trimmed = vehicleSearch.trim();
                          if (!trimmed) return;
                          const matched = vehicleOptions.find(
                            (option) => normalizeLabel(option) === normalizeLabel(trimmed),
                          );
                          if (!matched) return;
                          setVehicleFilters((current) => (current.includes(matched) ? current : [...current, matched]));
                          setVehicleSearch('');
                          setPage(1);
                        }}
                        className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setVehicleFilters([]);
                      setPage(1);
                    }}
                    className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
                  >
                    Clear
                  </button>
                  {vehicleFilters.length > 0 ? (
                    <span className="text-slate-500">{vehicleFilters.length} selected</span>
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
                    onMouseMove={(event) => {
                      if (trendPoints.points.length === 0) return;
                      const { left, top, width, height } = event.currentTarget.getBoundingClientRect();
                      const x = ((event.clientX - left) / width) * trendPoints.width;
                      const y = ((event.clientY - top) / height) * trendPoints.height;
                      let closestPoint: TrendPoint | null = null;
                      let closestDistance = Number.POSITIVE_INFINITY;
                      trendPoints.points.forEach((point) => {
                        const distance = Math.hypot(point.x - x, point.y - y);
                        if (distance < closestDistance) {
                          closestDistance = distance;
                          closestPoint = point;
                        }
                      });
                      if (!closestPoint) return;
                      if (closestDistance <= 24) {
                        setHoverPoint(closestPoint);
                      } else if (!pinnedPoint) {
                        setHoverPoint(null);
                      }
                    }}
                    onMouseLeave={() => {
                      if (!pinnedPoint) {
                        setHoverPoint(null);
                      }
                    }}
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
                    <path d={trendPoints.path} fill="none" stroke="url(#trend-line)" strokeWidth="3" />
                    {trendPoints.points.map((point, index) => (
                      <g key={`point-${index}`}>
                        <circle cx={point.x} cy={point.y} r="10" fill="transparent" />
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r="5"
                          fill="#0f172a"
                          stroke="#c4b5fd"
                          strokeWidth="2"
                          className="cursor-pointer transition"
                          onMouseEnter={() => setHoverPoint(point)}
                          onFocus={() => setHoverPoint(point)}
                          onClick={() => {
                            setPinnedPoint((current) => (current?.label === point.label ? null : point));
                            setHoverPoint(point);
                          }}
                        />
                      </g>
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
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">Alerts</h2>
                <span className="text-sm text-slate-400">{totalAlerts} rows</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="uppercase tracking-[0.2em] text-slate-500">Rows</span>
                    <select
                      value={pageSize}
                      onChange={(event) => {
                        setPageSize(Number(event.target.value));
                        setPage(1);
                      }}
                      className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                    >
                      {[25, 50, 100].map((size) => (
                        <option key={size} value={size}>
                          {size} per page
                        </option>
                      ))}
                    </select>
                  </div>
                  <span>Shift-click column headers to add multiple sorts.</span>
                </div>
                <span>
                  {totalAlerts === 0 ? 'No alerts to show.' : `Showing ${startIndex + 1}-${endIndex} of ${totalAlerts}`}
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
                <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs uppercase tracking-[0.2em] text-slate-400">
                      {(
                        [
                          { label: 'Alert time', field: 'time' },
                          { label: 'Vehicle', field: 'vehicle' },
                          { label: 'Driver', field: 'driver' },
                          { label: 'Alert type', field: 'alertType' },
                          { label: 'Speed', field: 'speed' },
                          { label: 'Fleet', field: 'fleet' },
                          { label: 'Remarks', field: 'remarks' },
                        ] as const
                      ).map((column) => {
                        const sortIndex = sortCriteria.findIndex((criterion) => criterion.field === column.field);
                        const sortDirection =
                          sortIndex >= 0 ? sortCriteria[sortIndex].direction : null;
                        const sortBadge =
                          sortIndex >= 0
                            ? `${sortDirection === 'asc' ? 'Asc' : 'Desc'}${
                                sortCriteria.length > 1 ? ` ${sortIndex + 1}` : ''
                              }`
                            : 'Sort';
                        return (
                          <th key={column.field} className="py-3 pr-4">
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
                                      nextCriteria.splice(existingIndex, 0, { field: column.field, direction: 'desc' });
                                      return nextCriteria;
                                    }
                                    return [{ field: column.field, direction: 'desc' }];
                                  }
                                  return nextCriteria;
                                });
                                setPage(1);
                              }}
                              className="flex items-center gap-2 text-left hover:text-slate-200"
                            >
                              <span>{column.label}</span>
                              <span className="text-[11px] text-slate-500">{sortBadge}</span>
                            </button>
                          </th>
                        );
                      })}
                      <th className="py-3">Video</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedAlerts.map((row) => (
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
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={currentPage === 1}
                    className="rounded-md border border-slate-800 px-3 py-1 text-xs text-slate-200 disabled:cursor-not-allowed disabled:text-slate-600"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-md border border-slate-800 px-3 py-1 text-xs text-slate-200 disabled:cursor-not-allowed disabled:text-slate-600"
                  >
                    Next
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

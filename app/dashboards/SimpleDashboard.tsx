'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import useGoogleSheet from './useGoogleSheet';
import { loadStoredFilters, saveStoredFilters } from './filterStorage';

type DashboardProps = {
  dashboardId: string;
  dashboardName: string;
  sheetId: string;
  sheetGid: string;
  dashboardNotes?: string | null;
  organizationName?: string | null;
};

type TrendPoint = {
  x: number;
  y: number;
  count: number;
  label: string;
};

type AlertSummaryRow = {
  id: string;
  dateKey: string;
  dateLabel: string;
  vehicle: string;
  distraction: number;
  fatigue: number;
  yawning: number;
  total: number;
  sortDate: number | null;
};

type SortField = 'date' | 'vehicle' | 'distraction' | 'fatigue' | 'yawning' | 'total';
type SortDirection = 'asc' | 'desc';
type SortCriterion = {
  field: SortField;
  direction: SortDirection;
};
type RemarkFilter = 'all' | 'fatigue' | 'yawning' | 'distraction';
type SimpleFilterState = {
  dateRange: { from: string; to: string };
  vehicleFilters: string[];
  driverFilters: string[];
  trendRemarkFilter: RemarkFilter;
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

export default function SimpleDashboard({
  dashboardId,
  dashboardName,
  sheetId,
  sheetGid,
  dashboardNotes,
  organizationName,
}: DashboardProps) {
  const { rows, loading, error, lastUpdated, refresh } = useGoogleSheet({ sheetId, gid: sheetGid });
  const normalizedOrganizationName = useMemo(
    () => (organizationName ? normalizeLabel(organizationName) : null),
    [organizationName],
  );
  const [hoverPoint, setHoverPoint] = useState<TrendPoint | null>(null);
  const defaultSortCriteria = useMemo<SortCriterion[]>(
    () => [{ field: 'date', direction: 'desc' }],
    [],
  );
  const [sortCriteria, setSortCriteria] = useState<SortCriterion[]>(defaultSortCriteria);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [trendRemarkFilter, setTrendRemarkFilter] = useState<RemarkFilter>('all');
  const [vehicleFilters, setVehicleFilters] = useState<string[]>([]);
  const [vehicleQuery, setVehicleQuery] = useState('');
  const [driverFilters, setDriverFilters] = useState<string[]>([]);
  const [driverQuery, setDriverQuery] = useState('');
  const storageKey = useMemo(() => dashboardId, [dashboardId]);

  useEffect(() => {
    const stored = loadStoredFilters<SimpleFilterState>(storageKey);
    if (!stored) return;
    if (stored.dateRange) {
      setDateRange({
        from: typeof stored.dateRange.from === 'string' ? stored.dateRange.from : '',
        to: typeof stored.dateRange.to === 'string' ? stored.dateRange.to : '',
      });
    }
    if (Array.isArray(stored.vehicleFilters)) {
      setVehicleFilters(stored.vehicleFilters.filter((value) => typeof value === 'string'));
    }
    if (Array.isArray(stored.driverFilters)) {
      setDriverFilters(stored.driverFilters.filter((value) => typeof value === 'string'));
    }
    if (stored.trendRemarkFilter && ['all', 'fatigue', 'yawning', 'distraction'].includes(stored.trendRemarkFilter)) {
      setTrendRemarkFilter(stored.trendRemarkFilter);
    }
    setPage(1);
  }, [storageKey]);

  useEffect(() => {
    saveStoredFilters(storageKey, {
      dateRange,
      vehicleFilters,
      driverFilters,
      trendRemarkFilter,
    });
  }, [dateRange, driverFilters, storageKey, trendRemarkFilter, vehicleFilters]);

  const baseAlerts = useMemo(() => {
    const allowedRemarks = new Set(['fatigue', 'yawning', 'distraction']);
    return rows
      .map((row) => {
        const alertType = String(findValue(row, ['Alert Type']) ?? '');
        const remarks = String(findValue(row, ['Remarks']) ?? '');
        const dateValue = findValue(row, ['Alert Date Time', 'Track Time', 'Date']);
        const parsedDate = parseDate(dateValue);
        return {
          alertType,
          remarks,
          parsedDate,
          vehicle: String(findValue(row, ['Vehicle No', 'Vehicle No TH']) ?? '—'),
          driver: String(findValue(row, ['Driver Name']) ?? '—'),
          fleet: String(findValue(row, ['Fleet']) ?? ''),
        };
      })
      .filter((row) => {
        if (!normalizedOrganizationName) return true;
        return normalizeLabel(row.fleet) === normalizedOrganizationName;
      })
      .filter((row) => {
        if (normalizeLabel(row.alertType) !== normalizeLabel('Eye Closing-A2')) return false;
        return allowedRemarks.has(normalizeLabel(row.remarks));
      })
      .filter((row) => row.parsedDate);
  }, [normalizedOrganizationName, rows]);

  const dateBounds = useMemo(() => {
    let minDate: Date | null = null;
    let maxDate: Date | null = null;
    baseAlerts.forEach((row) => {
      if (!row.parsedDate) return;
      if (!minDate || row.parsedDate < minDate) minDate = row.parsedDate;
      if (!maxDate || row.parsedDate > maxDate) maxDate = row.parsedDate;
    });
    return {
      min: minDate ? toDayKey(minDate) : '',
      max: maxDate ? toDayKey(maxDate) : '',
    };
  }, [baseAlerts]);

  const dateFilteredAlerts = useMemo(() => {
    const startDate = dateRange.from ? new Date(`${dateRange.from}T00:00:00`) : null;
    const endDate = dateRange.to ? new Date(`${dateRange.to}T23:59:59.999`) : null;
    return baseAlerts.filter((row) => {
      if (!row.parsedDate) return false;
      if (startDate && row.parsedDate < startDate) return false;
      if (endDate && row.parsedDate > endDate) return false;
      return true;
    });
  }, [baseAlerts, dateRange.from, dateRange.to]);

  const vehicleOptions = useMemo(() => {
    const vehicles = new Set<string>();
    dateFilteredAlerts.forEach((row) => {
      if (row.vehicle && row.vehicle !== '—') vehicles.add(row.vehicle);
    });
    return Array.from(vehicles).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [dateFilteredAlerts]);

  useEffect(() => {
    setVehicleFilters((current) => current.filter((vehicle) => vehicleOptions.includes(vehicle)));
  }, [vehicleOptions]);

  const driverOptions = useMemo(() => {
    const drivers = new Set<string>();
    dateFilteredAlerts.forEach((row) => {
      if (row.driver && row.driver !== '—') drivers.add(row.driver);
    });
    return Array.from(drivers).sort((a, b) => a.localeCompare(b));
  }, [dateFilteredAlerts]);

  useEffect(() => {
    setDriverFilters((current) => current.filter((driver) => driverOptions.includes(driver)));
  }, [driverOptions]);

  const filteredAlerts = useMemo(() => {
    let alerts = dateFilteredAlerts;
    if (vehicleFilters.length > 0) {
      const activeVehicles = new Set(vehicleFilters);
      alerts = alerts.filter((row) => activeVehicles.has(row.vehicle));
    }
    if (driverFilters.length > 0) {
      const activeDrivers = new Set(driverFilters);
      alerts = alerts.filter((row) => activeDrivers.has(row.driver));
    }
    return alerts;
  }, [dateFilteredAlerts, vehicleFilters, driverFilters]);

  const filteredVehicleOptions = useMemo(() => {
    const query = vehicleQuery.trim().toLowerCase();
    if (!query) return vehicleOptions;
    return vehicleOptions.filter((vehicle) => vehicle.toLowerCase().includes(query));
  }, [vehicleOptions, vehicleQuery]);

  const filteredDriverOptions = useMemo(() => {
    const query = driverQuery.trim().toLowerCase();
    if (!query) return driverOptions;
    return driverOptions.filter((driver) => driver.toLowerCase().includes(query));
  }, [driverOptions, driverQuery]);

  const stats = useMemo(() => {
    const vehicles = new Set<string>();
    const drivers = new Set<string>();
    let latestTimestamp = 0;
    let latestLabel = '—';
    const remarkTotals = {
      fatigue: 0,
      yawning: 0,
      distraction: 0,
    };

    filteredAlerts.forEach((row) => {
      const vehicle = row.vehicle;
      if (vehicle) vehicles.add(String(vehicle));
      if (row.driver && row.driver !== '—') drivers.add(row.driver);
      if (row.parsedDate) {
        const timestamp = row.parsedDate.getTime();
        if (timestamp > latestTimestamp) {
          latestTimestamp = timestamp;
          latestLabel = row.parsedDate.toLocaleString();
        }
      }
      const remark = normalizeLabel(row.remarks);
      if (remark === 'fatigue') remarkTotals.fatigue += 1;
      if (remark === 'yawning') remarkTotals.yawning += 1;
      if (remark === 'distraction') remarkTotals.distraction += 1;
    });

    return {
      total: filteredAlerts.length,
      vehicles: vehicles.size,
      drivers: drivers.size,
      latest: latestLabel,
      remarks: remarkTotals,
    };
  }, [filteredAlerts]);

  const summarizedRows = useMemo<AlertSummaryRow[]>(() => {
    const grouped = new Map<string, AlertSummaryRow>();
    filteredAlerts.forEach((row) => {
      const dateLabel = row.parsedDate ? toDayKey(row.parsedDate) : '—';
      const dateKey = row.parsedDate ? toDayKey(row.parsedDate) : `unknown-${row.vehicle}`;
      const groupKey = `${dateKey}-${row.vehicle}`;
      const existing = grouped.get(groupKey) ?? {
        id: groupKey,
        dateKey,
        dateLabel,
        vehicle: row.vehicle,
        distraction: 0,
        fatigue: 0,
        yawning: 0,
        total: 0,
        sortDate: row.parsedDate ? row.parsedDate.getTime() : null,
      };
      const remark = normalizeLabel(row.remarks);
      if (remark === 'fatigue') existing.fatigue += 1;
      if (remark === 'yawning') existing.yawning += 1;
      if (remark === 'distraction') existing.distraction += 1;
      existing.total += 1;
      grouped.set(groupKey, existing);
    });
    return Array.from(grouped.values());
  }, [filteredAlerts]);

  const sortedSummaries = useMemo(() => {
    if (sortCriteria.length === 0) return summarizedRows;
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    const getSortValue = (row: AlertSummaryRow, field: SortField) => {
      switch (field) {
        case 'date':
          return row.sortDate;
        case 'vehicle':
          return row.vehicle;
        case 'distraction':
          return row.distraction;
        case 'fatigue':
          return row.fatigue;
        case 'yawning':
          return row.yawning;
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
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return aValue - bValue;
      }
      return collator.compare(String(aValue), String(bValue));
    };
    return [...summarizedRows].sort((a, b) => {
      for (const criterion of sortCriteria) {
        const order = criterion.direction === 'asc' ? 1 : -1;
        const comparison = compareValues(getSortValue(a, criterion.field), getSortValue(b, criterion.field));
        if (comparison !== 0) return comparison * order;
      }
      return 0;
    });
  }, [sortCriteria, summarizedRows]);

  const totalSummaries = sortedSummaries.length;
  const totalPages = Math.max(1, Math.ceil(totalSummaries / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = totalSummaries === 0 ? 0 : (currentPage - 1) * pageSize;
  const endIndex = totalSummaries === 0 ? 0 : Math.min(startIndex + pageSize, totalSummaries);
  const paginatedSummaries = sortedSummaries.slice(startIndex, endIndex);

  useEffect(() => {
    setPage(1);
  }, [pageSize, sortCriteria, sortedSummaries.length]);

  const trendData = useMemo(() => {
    const counts = new Map<string, { key: string; date: Date; count: number }>();
    filteredAlerts.forEach((row) => {
      if (!row.parsedDate) return;
      const remark = normalizeLabel(row.remarks);
      if (trendRemarkFilter !== 'all' && remark !== trendRemarkFilter) return;
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
  }, [filteredAlerts, trendRemarkFilter]);

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

  const activePoint = hoverPoint;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-[1252px] flex-col gap-8">
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Link
                href="/dashboard"
                className="mb-2 inline-flex w-fit items-center gap-2 text-sm text-slate-300 transition hover:text-white"
              >
                <span aria-hidden="true">←</span>
                Back to dashboards
              </Link>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Simple Dashboard
              </p>
              <h1 className="text-2xl font-semibold sm:text-3xl">{dashboardName}</h1>
            </div>
            <button
              type="button"
              onClick={refresh}
              className="w-full rounded-lg border border-slate-700 px-4 py-2 text-sm text-white hover:border-slate-500 sm:w-auto"
            >
              Refresh data
            </button>
          </div>
          {lastUpdated ? (
            <p className="text-xs text-slate-400">Last updated {lastUpdated.toLocaleString()}</p>
          ) : null}
          {dashboardNotes ? (
            <div className="mt-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-200">
              {dashboardNotes}
            </div>
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
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-medium">Filters</h2>
                  <p className="text-sm text-slate-400">Narrow alerts by date range or vehicle.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDateRange({ from: '', to: '' });
                    setVehicleFilters([]);
                    setVehicleQuery('');
                    setDriverFilters([]);
                    setDriverQuery('');
                    setPage(1);
                  }}
                  className="text-sm font-semibold text-indigo-300 hover:text-indigo-200"
                >
                  Reset filters
                </button>
              </div>
              <div className="mt-4 space-y-3 text-xs text-slate-300">
                <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 sm:flex-row sm:items-center">
                  <span className="uppercase tracking-[0.2em] text-slate-500">Filter dates</span>
                  <label className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <span className="text-slate-400">From</span>
                    <input
                      type="date"
                      value={dateRange.from}
                      min={dateBounds.min}
                      max={dateRange.to || dateBounds.max}
                      onChange={(event) => {
                        setDateRange((current) => ({ ...current, from: event.target.value }));
                        setPage(1);
                      }}
                      className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                    />
                  </label>
                  <label className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <span className="text-slate-400">To</span>
                    <input
                      type="date"
                      value={dateRange.to}
                      min={dateRange.from || dateBounds.min}
                      max={dateBounds.max}
                      onChange={(event) => {
                        setDateRange((current) => ({ ...current, to: event.target.value }));
                        setPage(1);
                      }}
                      className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setDateRange({ from: '', to: '' });
                      setPage(1);
                    }}
                    className="w-full rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500 sm:w-auto"
                  >
                    Clear
                  </button>
                  {dateBounds.min && dateBounds.max ? (
                    <span className="text-slate-500">
                      Data from {dateBounds.min} to {dateBounds.max}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-xs text-slate-300 sm:flex-row sm:items-center">
                  <span className="uppercase tracking-[0.2em] text-slate-500">Filter vehicles</span>
                  <div className="flex w-full flex-1 flex-wrap items-center gap-2">
                    <div className="flex flex-wrap gap-2">
                      {vehicleFilters.map((vehicle) => (
                        <button
                          key={vehicle}
                          type="button"
                          onClick={() => {
                            setVehicleFilters((current) => current.filter((item) => item !== vehicle));
                            setPage(1);
                          }}
                          className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-100"
                        >
                          {vehicle} ×
                        </button>
                      ))}
                    </div>
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                      <input
                        list="vehicle-options"
                        value={vehicleQuery}
                        onChange={(event) => setVehicleQuery(event.target.value)}
                        placeholder={vehicleOptions.length === 0 ? 'No vehicles available' : 'Search vehicle number'}
                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 sm:min-w-[220px] sm:w-auto"
                      />
                      <datalist id="vehicle-options">
                        {filteredVehicleOptions.map((vehicle) => (
                          <option key={vehicle} value={vehicle} />
                        ))}
                      </datalist>
                      <button
                        type="button"
                        onClick={() => {
                          const trimmed = vehicleQuery.trim();
                          if (!trimmed) return;
                          const matched = vehicleOptions.find(
                            (vehicle) => vehicle.toLowerCase() === trimmed.toLowerCase(),
                          );
                          if (!matched) return;
                          setVehicleFilters((current) =>
                            current.includes(matched) ? current : [...current, matched],
                          );
                          setVehicleQuery('');
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
                    className="w-full rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500 sm:w-auto"
                  >
                    Clear
                  </button>
                  {vehicleFilters.length > 0 ? (
                    <span className="text-slate-500">{vehicleFilters.length} selected</span>
                  ) : null}
                </div>
                {driverOptions.length > 0 ? (
                  <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-xs text-slate-300 sm:flex-row sm:items-center">
                    <span className="uppercase tracking-[0.2em] text-slate-500">Filter drivers</span>
                    <div className="flex w-full flex-1 flex-wrap items-center gap-2">
                      <div className="flex flex-wrap gap-2">
                        {driverFilters.map((driver) => (
                          <button
                            key={driver}
                            type="button"
                            onClick={() => {
                              setDriverFilters((current) => current.filter((item) => item !== driver));
                              setPage(1);
                            }}
                            className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-100"
                          >
                            {driver} ×
                          </button>
                        ))}
                      </div>
                      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                        <input
                          list="driver-options"
                          value={driverQuery}
                          onChange={(event) => setDriverQuery(event.target.value)}
                          placeholder={driverOptions.length === 0 ? 'No drivers available' : 'Search driver name'}
                          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 sm:min-w-[220px] sm:w-auto"
                        />
                        <datalist id="driver-options">
                          {filteredDriverOptions.map((driver) => (
                            <option key={driver} value={driver} />
                          ))}
                        </datalist>
                        <button
                          type="button"
                          onClick={() => {
                            const trimmed = driverQuery.trim();
                            if (!trimmed) return;
                            const matched = driverOptions.find(
                              (driver) => driver.toLowerCase() === trimmed.toLowerCase(),
                            );
                            if (!matched) return;
                            setDriverFilters((current) =>
                              current.includes(matched) ? current : [...current, matched],
                            );
                            setDriverQuery('');
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
                        setDriverFilters([]);
                        setPage(1);
                      }}
                      className="w-full rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500 sm:w-auto"
                    >
                      Clear
                    </button>
                    {driverFilters.length > 0 ? (
                      <span className="text-slate-500">{driverFilters.length} selected</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-medium">Daily alert trend</h2>
                  <p className="text-sm text-slate-400">Eye Closing-A2 alerts for fatigue, yawning, and distraction.</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <span className="uppercase tracking-[0.2em] text-slate-500">Show</span>
                {(
                  [
                    { label: 'All remarks', value: 'all' },
                    { label: 'Fatigue', value: 'fatigue' },
                    { label: 'Yawning', value: 'yawning' },
                    { label: 'Distraction', value: 'distraction' },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTrendRemarkFilter(option.value)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      trendRemarkFilter === option.value
                        ? 'border-indigo-400/70 bg-indigo-500/20 text-indigo-100'
                        : 'border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="mt-6 overflow-x-auto">
                {trendData.length === 0 ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-6 text-sm text-slate-300">
                    No daily alert data available yet.
                  </div>
                ) : (
                  <div className="relative min-w-[640px] overflow-visible">
                    <svg
                      viewBox={trendPoints.viewBox}
                      className="h-[300px] w-full"
                      role="img"
                      aria-label="Daily alert trend"
                    >
                      <defs>
                        <linearGradient id="trend-line" x1="0" x2="1" y1="0" y2="0">
                          <stop offset="0%" stopColor="#A855F7" />
                          <stop offset="100%" stopColor="#C4B5FD" />
                        </linearGradient>
                      </defs>
                      {yAxisTicks.map((tick) => {
                        const y =
                          trendPoints.padding.top +
                          tick.position * (trendPoints.height - trendPoints.padding.top - trendPoints.padding.bottom);
                        return (
                          <g key={tick.value}>
                            <line
                              x1={trendPoints.padding.left}
                              x2={trendPoints.width - trendPoints.padding.right}
                              y1={y}
                              y2={y}
                              stroke="rgba(148, 163, 184, 0.2)"
                              strokeDasharray="6 6"
                            />
                            <text
                              x={trendPoints.padding.left - 12}
                              y={y + 4}
                              fill="#94a3b8"
                              textAnchor="end"
                              fontSize="11"
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
                        stroke="rgba(148, 163, 184, 0.5)"
                      />
                      <line
                        x1={trendPoints.padding.left}
                        x2={trendPoints.width - trendPoints.padding.right}
                        y1={trendPoints.height - trendPoints.padding.bottom}
                        y2={trendPoints.height - trendPoints.padding.bottom}
                        stroke="rgba(148, 163, 184, 0.5)"
                      />
                      <path d={trendPoints.path} fill="none" stroke="url(#trend-line)" strokeWidth="3" />
                      {trendPoints.points.map((point, index) => (
                        <circle
                          key={`${point.x}-${point.y}-${index}`}
                          cx={point.x}
                          cy={point.y}
                          r={index === trendPoints.points.length - 1 ? 6 : 5}
                          fill="#0f172a"
                          stroke="#C4B5FD"
                          strokeWidth="3"
                          onMouseEnter={() => setHoverPoint(point)}
                          onMouseLeave={() => setHoverPoint(null)}
                          className="cursor-pointer"
                        />
                      ))}
                      {xAxisLabels.map((label, index) => {
                        const x =
                          trendPoints.padding.left +
                          label.position * (trendPoints.width - trendPoints.padding.left - trendPoints.padding.right);
                        return (
                          <text
                            key={`${label.label}-${index}`}
                            x={x}
                            y={trendPoints.height - trendPoints.padding.bottom + 24}
                            fill="#94a3b8"
                            textAnchor="middle"
                            fontSize="11"
                          >
                            {label.label}
                          </text>
                        );
                      })}
                    </svg>
                    {activePoint ? (
                      <div
                        className="pointer-events-none absolute rounded-lg border border-indigo-400/40 bg-slate-950/90 px-3 py-2 text-xs text-indigo-100 shadow-lg"
                        style={{
                          left: `${(activePoint.x / trendPoints.width) * 100}%`,
                          top: `${(Math.max(activePoint.y - 32, trendPoints.padding.top + 12) / trendPoints.height) * 100}%`,
                          transform: 'translate(-50%, -100%)',
                        }}
                      >
                        <div className="font-semibold">{activePoint.count} alerts</div>
                        <div className="text-[11px] text-slate-300">{activePoint.label}</div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-medium">Alert remark highlights</h2>
                  <p className="text-sm text-slate-400">Eye Closing-A2 alerts by remark.</p>
                </div>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {(
                  [
                    { label: 'Fatigue', value: stats.remarks.fatigue, accent: 'text-amber-200' },
                    { label: 'Yawning', value: stats.remarks.yawning, accent: 'text-emerald-200' },
                    { label: 'Distraction', value: stats.remarks.distraction, accent: 'text-indigo-200' },
                  ] as const
                ).map((card) => (
                  <div
                    key={card.label}
                    className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 shadow-sm"
                  >
                    <p className="text-sm font-medium text-slate-200">{card.label}</p>
                    <p className={`mt-3 text-4xl font-semibold ${card.accent}`}>
                      {card.value.toLocaleString()}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">Alerts</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-medium">Alerts by vehicle and date</h2>
                  <p className="text-sm text-slate-400">
                    Eye Closing-A2 alerts with fatigue, yawning, and distraction remarks.
                  </p>
                </div>
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
                  <span>Shift-click column headers to sort by multiple columns.</span>
                </div>
                <span>
                  {totalSummaries === 0
                    ? 'No alerts to show.'
                    : `Showing ${startIndex + 1}-${endIndex} of ${totalSummaries}`}
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
                    onClick={() => setSortCriteria(defaultSortCriteria)}
                    className="text-xs font-semibold text-indigo-300 hover:text-indigo-200"
                  >
                    Reset sorting
                  </button>
                </div>
              ) : null}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs uppercase tracking-[0.2em] text-slate-400">
                      {(
                        [
                          { label: 'Date', field: 'date' },
                          { label: 'Vehicle number', field: 'vehicle' },
                          { label: 'Fatigue', field: 'fatigue' },
                          { label: 'Yawning', field: 'yawning' },
                          { label: 'Distraction', field: 'distraction' },
                          { label: 'Total', field: 'total' },
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
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedSummaries.map((row) => (
                      <tr key={row.id} className="border-b border-slate-900/80 text-slate-200">
                        <td className="py-3 pr-4 text-slate-300">{row.dateLabel}</td>
                        <td className="py-3 pr-4 font-semibold text-white">{row.vehicle}</td>
                        <td className="py-3 pr-4 text-amber-200">{row.fatigue}</td>
                        <td className="py-3 pr-4 text-emerald-200">{row.yawning}</td>
                        <td className="py-3 pr-4 text-indigo-200">{row.distraction}</td>
                        <td className="py-3 pr-4 text-rose-200">{row.total}</td>
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

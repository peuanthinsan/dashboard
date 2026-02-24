'use client';

import { useEffect, useMemo, useState } from 'react';
import useGoogleSheet from './useGoogleSheet';
import { formatDateKeyGB, formatDateTimeGB } from './dateFormat';
import { chipClassName, chipMutedClassName, FilterChip } from './FilterChip';
import { loadStoredFilters, saveStoredFilters } from './filterStorage';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import FilterGroup from './FilterGroup';
import LoadingState from './LoadingState';
import {
  buildTrendGeometry,
  buildXAxisLabels,
  buildYAxisTicks,
  findValue,
  normalizeLabel,
  parseDate,
  toDayKey,
} from './dashboardDataUtils';

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

export default function SimpleDashboard({
  dashboardId,
  dashboardName,
  sheetId,
  sheetGid,
  dashboardNotes,
  organizationName,
}: DashboardProps) {
  const { rows, loading, error, lastUpdated } = useGoogleSheet({ sheetId, gid: sheetGid });
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

  const handleSearchAdd = <T,>(
    searchValue: string,
    findMatch: (trimmed: string) => T | undefined,
    onMatch: (match: T) => void,
    clearSearch: () => void,
  ) => {
    const trimmed = searchValue.trim();
    if (!trimmed) return;
    const matched = findMatch(trimmed);
    if (!matched) return;
    onMatch(matched);
    clearSearch();
  };

  const resetFilters = () => {
    setDateRange({ from: '', to: '' });
    setVehicleFilters([]);
    setVehicleQuery('');
    setDriverFilters([]);
    setDriverQuery('');
    setPage(1);
  };

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
          latestLabel = formatDateTimeGB(row.parsedDate);
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
      const dateLabel = row.parsedDate ? row.parsedDate.toLocaleDateString('en-GB') : '—';
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
  const trendPoints = useMemo(() => buildTrendGeometry(trendData, maxTrendValue), [maxTrendValue, trendData]);
  const yAxisTicks = useMemo(() => buildYAxisTicks(maxTrendValue), [maxTrendValue]);
  const xAxisLabels = useMemo(() => buildXAxisLabels(trendData), [trendData]);

  const activePoint = hoverPoint;

  return (
    <DashboardShell
      title={dashboardName}
      subtitle="Simple dashboard"
      lastUpdated={lastUpdated}
      notes={dashboardNotes}
    >
      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <LoadingState message="Loading dashboard data…" detail="Gathering alert activity and trends." />
      ) : (
        <>
          <section className={dashboardSectionClass}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-medium">Filters</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Narrow alerts by date range or vehicle.
                </p>
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="text-sm font-semibold text-indigo-300 hover:text-indigo-200"
              >
                Reset filters
              </button>
            </div>
            <div className="mt-4 space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <FilterGroup
                label="Filter dates"
                onClear={() => {
                  setDateRange({ from: '', to: '' });
                  setPage(1);
                }}
                helper={
                  dateBounds.min && dateBounds.max
                    ? `Data from ${formatDateKeyGB(dateBounds.min)} to ${formatDateKeyGB(dateBounds.max)}`
                    : null
                }
              >
                <label className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <span className="text-slate-500 dark:text-slate-400">From</span>
                  <input
                    type="date"
                    lang="en-GB"
                    value={dateRange.from}
                    min={dateBounds.min}
                    max={dateRange.to || dateBounds.max}
                    onChange={(event) => {
                      setDateRange((current) => ({ ...current, from: event.target.value }));
                      setPage(1);
                    }}
                    className="date-range-input rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-700 dark:text-slate-200 dark:[color-scheme:dark]"
                  />
                </label>
                <label className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <span className="text-slate-500 dark:text-slate-400">To</span>
                  <input
                    type="date"
                    lang="en-GB"
                    value={dateRange.to}
                    min={dateRange.from || dateBounds.min}
                    max={dateBounds.max}
                    onChange={(event) => {
                      setDateRange((current) => ({ ...current, to: event.target.value }));
                      setPage(1);
                    }}
                    className="date-range-input rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-700 dark:text-slate-200 dark:[color-scheme:dark]"
                  />
                </label>
              </FilterGroup>
              <FilterGroup
                label="Filter vehicles"
                onClear={() => {
                  setVehicleFilters([]);
                  setPage(1);
                }}
                count={vehicleFilters.length}
              >
                <div className="flex flex-wrap gap-2">
                  {vehicleFilters.map((vehicle) => (
                    <FilterChip
                      key={vehicle}
                      onClick={() => {
                        setVehicleFilters((current) => current.filter((item) => item !== vehicle));
                        setPage(1);
                      }}
                    >
                      {vehicle} ×
                    </FilterChip>
                  ))}
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <input
                    list="vehicle-options"
                    value={vehicleQuery}
                    onChange={(event) => setVehicleQuery(event.target.value)}
                    placeholder={vehicleOptions.length === 0 ? 'No vehicles available' : 'Search vehicle number'}
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-700 dark:text-slate-200 sm:min-w-[220px] sm:w-auto"
                  />
                  <datalist id="vehicle-options">
                    {filteredVehicleOptions.map((vehicle) => (
                      <option key={vehicle} value={vehicle} />
                    ))}
                  </datalist>
                  <button
                    type="button"
                    onClick={() =>
                      handleSearchAdd(
                        vehicleQuery,
                        (trimmed) =>
                          vehicleOptions.find((vehicle) => vehicle.toLowerCase() === trimmed.toLowerCase()),
                        (matched) =>
                          setVehicleFilters((current) => (current.includes(matched) ? current : [...current, matched])),
                        () => {
                          setVehicleQuery('');
                          setPage(1);
                        },
                      )
                    }
                    className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs text-slate-700 dark:text-slate-200 hover:border-slate-500"
                  >
                    Add
                  </button>
                </div>
              </FilterGroup>
              {driverOptions.length > 0 ? (
                <FilterGroup
                  label="Filter drivers"
                  onClear={() => {
                    setDriverFilters([]);
                    setPage(1);
                  }}
                  count={driverFilters.length}
                >
                  <div className="flex flex-wrap gap-2">
                    {driverFilters.map((driver) => (
                      <FilterChip
                        key={driver}
                        onClick={() => {
                          setDriverFilters((current) => current.filter((item) => item !== driver));
                          setPage(1);
                        }}
                      >
                        {driver} ×
                      </FilterChip>
                    ))}
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <input
                      list="driver-options"
                      value={driverQuery}
                      onChange={(event) => setDriverQuery(event.target.value)}
                      placeholder={driverOptions.length === 0 ? 'No drivers available' : 'Search driver name'}
                      className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-700 dark:text-slate-200 sm:min-w-[220px] sm:w-auto"
                    />
                    <datalist id="driver-options">
                      {filteredDriverOptions.map((driver) => (
                        <option key={driver} value={driver} />
                      ))}
                    </datalist>
                    <button
                      type="button"
                      onClick={() =>
                        handleSearchAdd(
                          driverQuery,
                          (trimmed) =>
                            driverOptions.find((driver) => driver.toLowerCase() === trimmed.toLowerCase()),
                          (matched) =>
                            setDriverFilters((current) => (current.includes(matched) ? current : [...current, matched])),
                          () => {
                            setDriverQuery('');
                            setPage(1);
                          },
                        )
                      }
                      className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs text-slate-700 dark:text-slate-200 hover:border-slate-500"
                    >
                      Add
                    </button>
                  </div>
                </FilterGroup>
              ) : null}
            </div>
          </section>

            <section className={dashboardSectionClass}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-medium">Daily alert trend</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Eye Closing-A2 alerts for fatigue, yawning, and distraction.</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
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
                    className={
                      trendRemarkFilter === option.value ? chipClassName : chipMutedClassName
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="mt-6 overflow-x-auto">
                {trendData.length === 0 ? (
                  <div className="rounded-xl border border-cyan-300/40 dark:border-cyan-500/40 bg-gradient-to-br from-cyan-100/80 via-sky-50 to-violet-100/70 dark:bg-gradient-to-br dark:from-slate-900/80 dark:via-cyan-950/40 dark:to-violet-950/40 p-6 text-sm text-slate-700 dark:text-slate-200">
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
                          r={index === trendPoints.points.length - 1 ? 4 : 3}
                          fill="#0f172a"
                          stroke="#C4B5FD"
                          strokeWidth="2"
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
                        className="pointer-events-none absolute rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-lg dark:border-indigo-400/40 dark:bg-slate-950/90 dark:text-indigo-100"
                        style={{
                          left: `${(activePoint.x / trendPoints.width) * 100}%`,
                          top: `${(Math.max(activePoint.y - 32, trendPoints.padding.top + 12) / trendPoints.height) * 100}%`,
                          transform: 'translate(-50%, -100%)',
                        }}
                      >
                        <div className="font-semibold">{activePoint.count} alerts</div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300">{activePoint.label}</div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </section>

            <section className={dashboardSectionClass}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-medium">Alert remark highlights</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Eye Closing-A2 alerts by remark.</p>
                </div>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {(
                  [
                    {
                      label: 'Fatigue',
                      value: stats.remarks.fatigue,
                      accent: 'text-amber-500 dark:text-amber-200',
                    },
                    {
                      label: 'Yawning',
                      value: stats.remarks.yawning,
                      accent: 'text-emerald-500 dark:text-emerald-200',
                    },
                    {
                      label: 'Distraction',
                      value: stats.remarks.distraction,
                      accent: 'text-indigo-500 dark:text-indigo-200',
                    },
                  ] as const
                ).map((card) => (
                  <div
                    key={card.label}
                    className="rounded-2xl border border-violet-300/40 dark:border-violet-500/40 bg-gradient-to-br from-violet-100/80 via-fuchsia-50 to-cyan-100/70 dark:bg-gradient-to-br dark:from-slate-900/85 dark:via-violet-950/45 dark:to-cyan-950/35 p-5 shadow-lg shadow-violet-500/10"
                  >
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{card.label}</p>
                    <p className={`mt-3 text-4xl font-semibold ${card.accent}`}>
                      {card.value.toLocaleString()}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">Alerts</p>
                  </div>
                ))}
              </div>
            </section>

            <section className={dashboardSectionClass}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-medium">Alerts by vehicle and date</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Eye Closing-A2 alerts with fatigue, yawning, and distraction remarks.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="uppercase tracking-[0.2em] text-slate-500">Rows</span>
                    <select
                      value={pageSize}
                      onChange={(event) => {
                        setPageSize(Number(event.target.value));
                        setPage(1);
                      }}
                      className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-700 dark:text-slate-200"
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
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="uppercase tracking-[0.2em] text-slate-500">Sorted by</span>
                  {sortCriteria.map((criterion, index) => (
                    <FilterChip
                      key={`${criterion.field}-${criterion.direction}`}
                      onClick={() =>
                        setSortCriteria((current) => current.filter((_, currentIndex) => currentIndex !== index))
                      }
                    >
                      {criterion.field} {criterion.direction} ×
                    </FilterChip>
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
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
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
                              className="flex items-center gap-2 text-left hover:text-slate-700 dark:text-slate-200"
                            >
                              <span>{column.label}</span>
                              <span
                                className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-500 dark:text-indigo-200"
                              >
                                {sortBadge}
                              </span>
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedSummaries.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-slate-200 text-slate-700 dark:border-slate-900/80 dark:text-slate-200"
                      >
                        <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{row.dateLabel}</td>
                        <td className="py-3 pr-4 font-semibold text-slate-900 dark:text-white">
                          {row.vehicle}
                        </td>
                        <td className="py-3 pr-4 text-amber-500 dark:text-amber-200">
                          {row.fatigue}
                        </td>
                        <td className="py-3 pr-4 text-emerald-500 dark:text-emerald-200">
                          {row.yawning}
                        </td>
                        <td className="py-3 pr-4 text-indigo-500 dark:text-indigo-200">
                          {row.distraction}
                        </td>
                        <td className="py-3 pr-4 text-rose-500 dark:text-rose-200">{row.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={currentPage === 1}
                    className="rounded-md border border-slate-200 dark:border-slate-800 px-3 py-1 text-xs text-slate-700 dark:text-slate-200 disabled:cursor-not-allowed disabled:text-slate-600"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-md border border-slate-200 dark:border-slate-800 px-3 py-1 text-xs text-slate-700 dark:text-slate-200 disabled:cursor-not-allowed disabled:text-slate-600"
                  >
                    Next
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
    </DashboardShell>
  );
}

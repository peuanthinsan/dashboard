'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import useGoogleSheet from './useGoogleSheet';
import { formatDateTimeGB } from './dateFormat';
import { loadStoredFilters, saveStoredFilters } from './filterStorage';
import { chipClassName, chipMutedClassName, FilterChip } from './FilterChip';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import FilterGroup from './FilterGroup';
import LoadingState from './LoadingState';
import PieBreakdownCard from './PieBreakdownCard';
import {
  ALLOWED_ALERT_TYPES,
  ALLOWED_REMARK_TARGETS,
  buildTrendGeometry,
  buildXAxisLabels,
  buildYAxisTicks,
  findValue,
  hasRemark,
  normalizeLabel,
  parseDate,
  toDayKey,
  toDisplayString,
  toMonthKey,
  toMonthLabel,
} from './dashboardDataUtils';

type DashboardProps = {
  dashboardId: string;
  dashboardName: string;
  sheetId: string;
  sheetGid: string;
  dashboardNotes?: string | null;
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
type DetailFilterState = {
  monthFilters: string[];
  fleetFilters: string[];
  remarkFilters: string[];
  vehicleFilters: string[];
  driverFilters: string[];
  trendRemarkFilter: string;
};


const buildCounts = (rows: AlertRow[], field: 'fleet' | 'remarks' | 'vehicle') => {
  const totals = new Map<string, number>();
  rows.forEach((row) => {
    const value = row[field];
    const key = value == null || value === '' ? 'Unspecified' : String(value).trim() || 'Unspecified';
    totals.set(key, (totals.get(key) ?? 0) + 1);
  });
  return Array.from(totals.entries())
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total);
};

const toDateLabel = (value: unknown) => {
  if (!value) return '—';
  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return formatDateTimeGB(parsed);
};

export default function DetailDashboard({
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
  const currentMonthKey = useMemo(() => toMonthKey(new Date()), []);
  const [monthSearch, setMonthSearch] = useState('');
  const [monthFilters, setMonthFilters] = useState<string[]>([]);
  const [fleetSearch, setFleetSearch] = useState('');
  const [fleetFilters, setFleetFilters] = useState<string[]>([]);
  const [remarkSearch, setRemarkSearch] = useState('');
  const [remarkFilters, setRemarkFilters] = useState<string[]>([]);
  const [trendRemarkFilter, setTrendRemarkFilter] = useState('all');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [vehicleFilters, setVehicleFilters] = useState<string[]>([]);
  const [driverSearch, setDriverSearch] = useState('');
  const [driverFilters, setDriverFilters] = useState<string[]>([]);
  const [hoverPoint, setHoverPoint] = useState<TrendPoint | null>(null);
  const [pinnedPoint, setPinnedPoint] = useState<TrendPoint | null>(null);
  const [sortCriteria, setSortCriteria] = useState<SortCriterion[]>([
    { field: 'time', direction: 'desc' },
  ]);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const didSetDefaultMonth = useRef(false);
  const storageKey = useMemo(() => dashboardId, [dashboardId]);

  useEffect(() => {
    const stored = loadStoredFilters<DetailFilterState>(storageKey);
    if (!stored) return;
    didSetDefaultMonth.current = true;
    if (Array.isArray(stored.monthFilters)) {
      setMonthFilters(stored.monthFilters.filter((value) => typeof value === 'string'));
    }
    if (Array.isArray(stored.fleetFilters)) {
      setFleetFilters(stored.fleetFilters.filter((value) => typeof value === 'string'));
    }
    if (Array.isArray(stored.remarkFilters)) {
      setRemarkFilters(stored.remarkFilters.filter((value) => typeof value === 'string'));
    }
    if (Array.isArray(stored.vehicleFilters)) {
      setVehicleFilters(stored.vehicleFilters.filter((value) => typeof value === 'string'));
    }
    if (Array.isArray(stored.driverFilters)) {
      setDriverFilters(stored.driverFilters.filter((value) => typeof value === 'string'));
    }
    if (typeof stored.trendRemarkFilter === 'string') {
      setTrendRemarkFilter(stored.trendRemarkFilter);
    }
  }, [storageKey]);

  useEffect(() => {
    saveStoredFilters(storageKey, {
      monthFilters,
      fleetFilters,
      remarkFilters,
      vehicleFilters,
      driverFilters,
      trendRemarkFilter,
    });
  }, [
    driverFilters,
    fleetFilters,
    monthFilters,
    remarkFilters,
    storageKey,
    trendRemarkFilter,
    vehicleFilters,
  ]);

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
    setMonthSearch('');
    setMonthFilters([]);
    setFleetSearch('');
    setFleetFilters([]);
    setRemarkSearch('');
    setRemarkFilters([]);
    setVehicleSearch('');
    setVehicleFilters([]);
    setDriverSearch('');
    setDriverFilters([]);
  };

  const allowedAlertTypes = useMemo(() => ALLOWED_ALERT_TYPES, []);
  const allowedRemarkTargets = useMemo(() => ALLOWED_REMARK_TARGETS, []);

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
    const remarkRows = mappedRows.filter((row) => hasRemark(row.remarks));
    if (!normalizedOrganizationName) {
      return remarkRows;
    }
    return remarkRows.filter((row) => normalizeLabel(row.fleet) === normalizedOrganizationName);
  }, [normalizedOrganizationName, rows]);

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
    const normalizedTargets = allowedRemarkTargets.map((label) => normalizeLabel(label));
    const matching = new Set<string>();
    alertRows.forEach((row) => {
      if (!row.remarks || row.remarks === '—') return;
      const normalizedValue = normalizeLabel(row.remarks);
      normalizedTargets.forEach((target, index) => {
        if (normalizedValue.includes(target)) {
          matching.add(allowedRemarkTargets[index]);
        }
      });
    });
    return Array.from(matching).sort((a, b) => a.localeCompare(b));
  }, [alertRows, allowedRemarkTargets]);

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

  const driverOptions = useMemo(() => {
    const unique = new Set<string>();
    alertRows.forEach((row) => {
      if (row.driver && row.driver !== '—') unique.add(row.driver);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [alertRows]);

  const filteredDriverOptions = useMemo(() => {
    const trimmedSearch = driverSearch.trim();
    if (!trimmedSearch) return driverOptions;
    const normalizedSearch = normalizeLabel(trimmedSearch);
    return driverOptions.filter((option) => normalizeLabel(option).includes(normalizedSearch));
  }, [driverOptions, driverSearch]);

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
    if (monthFilters.length > 0) {
      didSetDefaultMonth.current = true;
      return;
    }
    didSetDefaultMonth.current = true;
    if (monthOptions.some((option) => option.key === currentMonthKey)) {
      setMonthFilters([currentMonthKey]);
    }
  }, [currentMonthKey, monthFilters, monthOptions]);

  const baseFilteredRows = useMemo(() => {
    const normalizedAllowedAlertTypes = allowedAlertTypes.map((alert) => normalizeLabel(alert));
    const normalizedFleetFilters = fleetFilters.map((fleet) => normalizeLabel(fleet));
    const normalizedRemarkFilters = remarkFilters.map((remark) => normalizeLabel(remark));
    const normalizedVehicleFilters = vehicleFilters.map((vehicle) => normalizeLabel(vehicle));
    const normalizedDriverFilters = driverFilters.map((driver) => normalizeLabel(driver));
    return alertRows.filter((row) => {
      if (!row.alertType || row.alertType === '—') return false;
      const normalizedAlertType = normalizeLabel(row.alertType);
      if (!normalizedAllowedAlertTypes.includes(normalizedAlertType)) return false;
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
      if (normalizedDriverFilters.length > 0) {
        const normalizedDriver = normalizeLabel(row.driver);
        if (!normalizedDriverFilters.includes(normalizedDriver)) return false;
      }
      return true;
    });
  }, [alertRows, allowedAlertTypes, fleetFilters, remarkFilters, vehicleFilters, driverFilters]);

  const filteredAlerts = useMemo(() => {
    if (monthFilters.length === 0) return baseFilteredRows;
    return baseFilteredRows.filter((row) => row.monthKey && monthFilters.includes(row.monthKey));
  }, [baseFilteredRows, monthFilters]);

  const fleetSummary = useMemo(() => buildCounts(filteredAlerts, 'fleet').slice(0, 6), [filteredAlerts]);
  const remarkSummary = useMemo(() => buildCounts(filteredAlerts, 'remarks').slice(0, 6), [filteredAlerts]);
  const vehicleSummary = useMemo(() => buildCounts(filteredAlerts, 'vehicle').slice(0, 6), [filteredAlerts]);

  const availableTrendRemarkOptions = useMemo(() => {
    const normalizedTargets = allowedRemarkTargets.map((label) => normalizeLabel(label));
    const matching = new Set<string>();
    filteredAlerts.forEach((row) => {
      if (!row.remarks || row.remarks === '—') return;
      const normalizedValue = normalizeLabel(row.remarks);
      normalizedTargets.forEach((target, index) => {
        if (normalizedValue.includes(target)) {
          matching.add(allowedRemarkTargets[index]);
        }
      });
    });
    return [
      { label: 'All remarks', value: 'all' },
      ...Array.from(matching)
        .sort((a, b) => a.localeCompare(b))
        .map((option) => ({ label: option, value: option })),
    ];
  }, [allowedRemarkTargets, filteredAlerts]);

  useEffect(() => {
    if (trendRemarkFilter === 'all') return;
    if (availableTrendRemarkOptions.some((option) => option.value === trendRemarkFilter)) return;
    setTrendRemarkFilter('all');
  }, [availableTrendRemarkOptions, trendRemarkFilter]);

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
  }, [monthFilters, fleetFilters, remarkFilters, vehicleFilters, driverFilters]);

  const trendData = useMemo(() => {
    const counts = new Map<string, { key: string; date: Date; count: number }>();
    filteredAlerts.forEach((row) => {
      if (!row.parsedDate) return;
      if (trendRemarkFilter !== 'all') {
        const normalizedRemark = normalizeLabel(row.remarks);
        const normalizedFilter = normalizeLabel(trendRemarkFilter);
        if (!normalizedRemark.includes(normalizedFilter)) return;
      }
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

  const activePoint = pinnedPoint ?? hoverPoint;

  return (
    <DashboardShell
      title={dashboardName}
      subtitle="Detail dashboard"
      lastUpdated={lastUpdated}
      notes={dashboardNotes}
    >
      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <LoadingState message="Loading detailed alerts…" detail="Building the latest alert timeline." />
      ) : (
        <>
          <section className={dashboardSectionClass}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-medium">Filters</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Narrow alerts by remark, month, fleet, or vehicle.
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
                label="Filter months"
                onClear={() => {
                  setMonthFilters([]);
                  setPage(1);
                }}
                count={monthFilters.length}
              >
                <div className="flex flex-wrap gap-2">
                  {monthFilters.map((monthKey) => {
                    const monthLabel = monthOptions.find((option) => option.key === monthKey)?.label ?? monthKey;
                    return (
                      <FilterChip
                        key={monthKey}
                        onClick={() => setMonthFilters((current) => current.filter((value) => value !== monthKey))}
                      >
                        {monthLabel} ×
                      </FilterChip>
                    );
                  })}
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <input
                    list="month-options"
                    value={monthSearch}
                    onChange={(event) => setMonthSearch(event.target.value)}
                    placeholder={monthOptions.length === 0 ? 'No months available' : 'Search months'}
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-700 dark:text-slate-200 sm:min-w-[220px] sm:w-auto"
                  />
                  <datalist id="month-options">
                    {filteredMonthOptions.map((option) => (
                      <option key={option.key} value={option.label} />
                    ))}
                  </datalist>
                  <button
                    type="button"
                    onClick={() =>
                      handleSearchAdd(
                        monthSearch,
                        (trimmed) =>
                          monthOptions.find(
                            (option) =>
                              option.key === trimmed || normalizeLabel(option.label) === normalizeLabel(trimmed),
                          ),
                        (matched) =>
                          setMonthFilters((current) =>
                            current.includes(matched.key) ? current : [...current, matched.key],
                          ),
                        () => {
                          setMonthSearch('');
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
              {organizationName ? null : (
                <FilterGroup
                  label="Filter fleets"
                  onClear={() => {
                    setFleetFilters([]);
                    setPage(1);
                  }}
                  count={fleetFilters.length}
                >
                  <div className="flex flex-wrap gap-2">
                    {fleetFilters.map((fleet) => (
                      <FilterChip
                        key={fleet}
                        onClick={() => setFleetFilters((current) => current.filter((value) => value !== fleet))}
                      >
                        {fleet} ×
                      </FilterChip>
                    ))}
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <input
                      list="fleet-options"
                      value={fleetSearch}
                      onChange={(event) => setFleetSearch(event.target.value)}
                      placeholder={fleetOptions.length === 0 ? 'No fleets available' : 'Search fleets'}
                      className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-700 dark:text-slate-200 sm:min-w-[220px] sm:w-auto"
                    />
                    <datalist id="fleet-options">
                      {filteredFleetOptions.map((option) => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                    <button
                      type="button"
                      onClick={() =>
                        handleSearchAdd(
                          fleetSearch,
                          (trimmed) => fleetOptions.find((option) => normalizeLabel(option) === normalizeLabel(trimmed)),
                          (matched) =>
                            setFleetFilters((current) => (current.includes(matched) ? current : [...current, matched])),
                          () => {
                            setFleetSearch('');
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
              )}
              <FilterGroup
                label="Filter remark types"
                onClear={() => {
                  setRemarkFilters([]);
                  setPage(1);
                }}
                count={remarkFilters.length}
              >
                <div className="flex flex-wrap gap-2">
                  {remarkFilters.map((remark) => (
                    <FilterChip
                      key={remark}
                      onClick={() => setRemarkFilters((current) => current.filter((value) => value !== remark))}
                    >
                      {remark} ×
                    </FilterChip>
                  ))}
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <input
                    list="remark-options"
                    value={remarkSearch}
                    onChange={(event) => setRemarkSearch(event.target.value)}
                    placeholder={remarkOptions.length === 0 ? 'No remarks available' : 'Search remarks'}
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-700 dark:text-slate-200 sm:min-w-[220px] sm:w-auto"
                  />
                  <datalist id="remark-options">
                    {filteredRemarkOptions.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                  <button
                    type="button"
                    onClick={() =>
                      handleSearchAdd(
                        remarkSearch,
                        (trimmed) =>
                          remarkOptions.find((option) => normalizeLabel(option) === normalizeLabel(trimmed)),
                        (matched) =>
                          setRemarkFilters((current) => (current.includes(matched) ? current : [...current, matched])),
                        () => {
                          setRemarkSearch('');
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
                      onClick={() => setVehicleFilters((current) => current.filter((value) => value !== vehicle))}
                    >
                      {vehicle} ×
                    </FilterChip>
                  ))}
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <input
                    list="vehicle-options"
                    value={vehicleSearch}
                    onChange={(event) => setVehicleSearch(event.target.value)}
                    placeholder={vehicleOptions.length === 0 ? 'No vehicles available' : 'Search vehicles'}
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-700 dark:text-slate-200 sm:min-w-[220px] sm:w-auto"
                  />
                  <datalist id="vehicle-options">
                    {filteredVehicleOptions.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                  <button
                    type="button"
                    onClick={() =>
                      handleSearchAdd(
                        vehicleSearch,
                        (trimmed) =>
                          vehicleOptions.find((option) => normalizeLabel(option) === normalizeLabel(trimmed)),
                        (matched) =>
                          setVehicleFilters((current) => (current.includes(matched) ? current : [...current, matched])),
                        () => {
                          setVehicleSearch('');
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
                        onClick={() => setDriverFilters((current) => current.filter((value) => value !== driver))}
                      >
                        {driver} ×
                      </FilterChip>
                    ))}
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <input
                      list="driver-options"
                      value={driverSearch}
                      onChange={(event) => setDriverSearch(event.target.value)}
                      placeholder={driverOptions.length === 0 ? 'No drivers available' : 'Search drivers'}
                      className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-700 dark:text-slate-200 sm:min-w-[220px] sm:w-auto"
                    />
                    <datalist id="driver-options">
                      {filteredDriverOptions.map((option) => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                    <button
                      type="button"
                      onClick={() =>
                        handleSearchAdd(
                          driverSearch,
                          (trimmed) =>
                            driverOptions.find((option) => normalizeLabel(option) === normalizeLabel(trimmed)),
                          (matched) =>
                            setDriverFilters((current) => (current.includes(matched) ? current : [...current, matched])),
                          () => {
                            setDriverSearch('');
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
              <div>
                <h2 className="bg-gradient-to-r from-sky-500 via-violet-500 to-emerald-500 bg-clip-text text-lg font-semibold text-transparent">Alert distribution</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Colorful pie charts for top fleets, remarks, and vehicles.</p>
              </div>
              <div className="mt-5 grid gap-6 lg:grid-cols-3">
                <div className="rounded-2xl border border-sky-300/60 bg-gradient-to-br from-sky-100/90 via-cyan-100/80 to-blue-100/80 p-4 shadow-[0_20px_42px_-30px_rgba(14,165,233,0.85)] dark:border-sky-400/40 dark:bg-gradient-to-br dark:from-sky-950/35 dark:via-cyan-950/30 dark:to-blue-950/30">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Fleet volume</h3>
                  <div className="mt-3">
                    <PieBreakdownCard items={fleetSummary} emptyMessage="No fleet data available." />
                  </div>
                </div>
                <div className="rounded-2xl border border-violet-300/60 bg-gradient-to-br from-fuchsia-100/90 via-violet-100/80 to-indigo-100/80 p-4 shadow-[0_20px_42px_-30px_rgba(139,92,246,0.85)] dark:border-violet-400/40 dark:bg-gradient-to-br dark:from-fuchsia-950/35 dark:via-violet-950/30 dark:to-indigo-950/30">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Remarks volume</h3>
                  <div className="mt-3">
                    <PieBreakdownCard items={remarkSummary} emptyMessage="No remark data available." />
                  </div>
                </div>
                <div className="rounded-2xl border border-emerald-300/60 bg-gradient-to-br from-emerald-100/90 via-lime-100/80 to-teal-100/80 p-4 shadow-[0_20px_42px_-30px_rgba(16,185,129,0.85)] dark:border-emerald-400/40 dark:bg-gradient-to-br dark:from-emerald-950/35 dark:via-lime-950/25 dark:to-teal-950/30">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Vehicle volume</h3>
                  <div className="mt-3">
                    <PieBreakdownCard items={vehicleSummary} emptyMessage="No vehicle data available." />
                  </div>
                </div>
              </div>
            </section>

            <section className={dashboardSectionClass}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-medium">Daily alert trend</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Daily totals for the filtered alert set.</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <span className="uppercase tracking-[0.2em] text-slate-500">Show</span>
                {availableTrendRemarkOptions.map((option) => (
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
              <div className="relative mt-4 overflow-visible">
                {trendData.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">No alert activity available for the selected filters.</p>
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
                        <circle cx={point.x} cy={point.y} r="8" fill="transparent" />
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r="4"
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
            </section>

            <section className={dashboardSectionClass}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">Alerts</h2>
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
                  <span>Shift-click column headers to add multiple sorts.</span>
                </div>
                <span>
                  {totalAlerts === 0 ? 'No alerts to show.' : `Showing ${startIndex + 1}-${endIndex} of ${totalAlerts}`}
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
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
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
                      <th className="py-3">Video</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedAlerts.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-slate-200 text-slate-700 dark:border-slate-900/80 dark:text-slate-200"
                      >
                        <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{row.time}</td>
                        <td className="py-3 pr-4 font-semibold text-slate-900 dark:text-white">
                          {row.vehicle}
                        </td>
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

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useGoogleSheet from './useGoogleSheet';
import { loadStoredFilters, saveStoredFilters } from './filterStorage';
import { FilterChip } from './FilterChip';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import FilterGroup from './FilterGroup';
import LoadingState from './LoadingState';
import {
  ALLOWED_ALERT_TYPES,
  ALLOWED_REMARK_TARGETS,
  findValue,
  hasRemark,
  isExcludedAlertRemark,
  normalizeLabel,
  parseDate,
  toDisplayString,
  toMonthKey,
  toMonthLabel,
  withDerivedRemark,
} from './dashboardDataUtils';
import { type DashboardLang } from 'app/dashboard/i18n-copy';

type DashboardProps = {
  dashboardId: string;
  dashboardName: string;
  sheetId: string;
  sheetGid: string;
  dashboardNotes?: string | null;
  organizationName?: string | null;
  lang?: DashboardLang;
};

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

const PIE_COLORS = ['#f472b6', '#818cf8', '#22d3ee', '#f59e0b', '#34d399', '#f87171'];

const PieChartCard = ({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: { label: string; total: number }[];
}) => {
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  let cumulative = 0;
  const slices = rows.map((row, index) => {
    const start = cumulative;
    cumulative += row.total;
    const percent = total === 0 ? 0 : row.total / total;
    return {
      ...row,
      color: PIE_COLORS[index % PIE_COLORS.length],
      dashArray: `${Math.max(percent * 100, 0)} ${Math.max(100 - percent * 100, 0)}`,
      dashOffset: -start,
      percent,
    };
  });

  return (
    <section className={dashboardSectionClass}>
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No data available.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <div className="mx-auto w-full max-w-[200px]">
            <svg viewBox="0 0 42 42" className="h-auto w-full" role="img" aria-label={title}>
              <circle cx="21" cy="21" r="15.9" fill="transparent" stroke="#1e293b" strokeWidth="4" opacity="0.2" />
              {slices.map((slice) => (
                <circle
                  key={slice.label}
                  cx="21"
                  cy="21"
                  r="15.9"
                  fill="transparent"
                  stroke={slice.color}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={slice.dashArray}
                  strokeDashoffset={slice.dashOffset}
                />
              ))}
              <text x="21" y="20" textAnchor="middle" className="fill-slate-900 text-[3.6px] font-semibold dark:fill-white">
                {total}
              </text>
              <text x="21" y="24" textAnchor="middle" className="fill-slate-500 text-[2.8px] dark:fill-slate-400">
                alerts
              </text>
            </svg>
          </div>
          <div className="space-y-2">
            {slices.map((slice) => (
              <div key={`${slice.label}-legend`} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                  <span className="line-clamp-1">{slice.label}</span>
                </div>
                <span className="text-slate-500 dark:text-slate-400">{slice.total} ({(slice.percent * 100).toFixed(0)}%)</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
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

const formatMonthDelta = (current: number, previous: number, lang: DashboardLang) => {
  const { delta, isIncrease } = buildDeltaSummary(current, previous);
  if (delta === 0) return lang === 'th' ? 'คงที่' : 'No change';
  return `${isIncrease ? '▲' : '▼'} ${Math.abs(delta)}`;
};

export default function SummaryDashboard({
  dashboardId,
  dashboardName,
  sheetId,
  sheetGid,
  dashboardNotes,
  organizationName,
  lang = 'en',
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
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [vehicleFilters, setVehicleFilters] = useState<string[]>([]);
  const [driverSearch, setDriverSearch] = useState('');
  const [driverFilters, setDriverFilters] = useState<string[]>([]);
  const didSetDefaultMonth = useRef(false);
  const storageKey = useMemo(() => dashboardId, [dashboardId]);

  useEffect(() => {
    const stored = loadStoredFilters<{
      monthFilters: string[];
      fleetFilters: string[];
      remarkFilters: string[];
      vehicleFilters: string[];
      driverFilters: string[];
    }>(storageKey);
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
  }, [storageKey]);

  useEffect(() => {
    saveStoredFilters(storageKey, {
      monthFilters,
      fleetFilters,
      remarkFilters,
      vehicleFilters,
      driverFilters,
    });
  }, [driverFilters, fleetFilters, monthFilters, remarkFilters, storageKey, vehicleFilters]);

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

  const alertRows = useMemo(() => {
    const mappedRows = rows.map((row) => {
      const alertType = toDisplayString(findValue(row, ['Alert Type']));
      const driver = toDisplayString(findValue(row, ['Driver Name']));
      const fleet = toDisplayString(findValue(row, ['Fleet']));
      const remarks = withDerivedRemark(
        alertType,
        toDisplayString(findValue(row, ['Remarks'])),
      );
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
    const remarkRows = mappedRows.filter((row) => hasRemark(row.remarks) && !isExcludedAlertRemark(row.remarks));
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

  const activeMonthKey = monthFilters.length === 1 ? monthFilters[0] : null;

  const activeMonthLabel =
    activeMonthKey
      ? monthOptions.find((option) => option.key === activeMonthKey)?.label ?? 'All months'
      : monthFilters.length > 1
        ? 'Selected months'
        : 'All months';

  const currentRows = useMemo(() => {
    if (monthFilters.length === 0) return baseFilteredRows;
    return baseFilteredRows.filter((row) => row.monthKey && monthFilters.includes(row.monthKey));
  }, [baseFilteredRows, monthFilters]);

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
  const topRemarks = remarkSummary;
  const topVehicles = vehicleSummary;

  const countMatches = useCallback(
    (targetLabel: string, field: 'remarks' | 'alertType', dataset: typeof currentRows) => {
      const normalizedTarget = normalizeLabel(targetLabel);
      return dataset.reduce((total, row) => {
        const value = field === 'remarks' ? row.remarks : row.alertType;
        if (!value || value === '—') return total;
        const normalizedValue = normalizeLabel(value);
        if (field === 'remarks') {
          return normalizedValue.includes(normalizedTarget) ? total + 1 : total;
        }
        return normalizedValue === normalizedTarget ? total + 1 : total;
      }, 0);
    },
    [],
  );

  const highlightItems = useMemo(() => {
    type HighlightItem = {
      label: string;
      field: 'remarks' | 'alertType';
      current: number;
      previous: number;
    };
    const items: HighlightItem[] = allowedRemarkTargets.map((label) => ({
      label,
      field: 'remarks' as const,
      current: countMatches(label, 'remarks', currentRows),
      previous: countMatches(label, 'remarks', previousRows),
    }));
    items.push({
      label: 'Forward Collision-A2',
      field: 'alertType',
      current: countMatches('Forward Collision-A2', 'alertType', currentRows),
      previous: countMatches('Forward Collision-A2', 'alertType', previousRows),
    });
    return items.filter((item) => item.current > 0);
  }, [allowedRemarkTargets, countMatches, currentRows, previousRows]);

  const monthlyComparisonRows = useMemo(() => {
    const monthlyTotals = new Map<string, number>();
    baseFilteredRows.forEach((row) => {
      if (!row.monthKey) return;
      monthlyTotals.set(row.monthKey, (monthlyTotals.get(row.monthKey) ?? 0) + 1);
    });

    const sortedMonthKeys = Array.from(monthlyTotals.keys()).sort((a, b) => a.localeCompare(b));

    return sortedMonthKeys
      .map((monthKey, index) => {
        const total = monthlyTotals.get(monthKey) ?? 0;
        const previousMonthKey = sortedMonthKeys[index - 1];
        const previousTotal = previousMonthKey ? (monthlyTotals.get(previousMonthKey) ?? 0) : 0;
        const label = monthOptions.find((option) => option.key === monthKey)?.label ?? monthKey;

        return {
          monthKey,
          monthLabel: label,
          total,
          previousTotal,
          isSelected: monthFilters.includes(monthKey),
        };
      })
      .reverse();
  }, [baseFilteredRows, monthFilters, monthOptions]);

  return (
    <DashboardShell
      title={dashboardName}
      subtitle={lang === 'th' ? 'แดชบอร์ดภาพรวม' : 'Summary dashboard'}
      lang={lang}
      lastUpdated={lastUpdated}
      notes={dashboardNotes}
    >
      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <LoadingState message={lang === 'th' ? 'กำลังโหลดภาพรวม…' : 'Loading summary…'} detail={lang === 'th' ? 'กำลังสรุป KPI ระดับสูง' : 'Compiling high-level KPI totals.'} />
      ) : (
        <div className="flex flex-col gap-6">
          <section className={dashboardSectionClass}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-medium">{lang === 'th' ? 'ตัวกรอง' : 'Filters'}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {lang === 'th' ? 'กรองการแจ้งเตือนด้วยประเภทการแจ้งเตือน เดือน ฟลีท หรือรถ' : 'Narrow alerts by alert type, month, fleet, or vehicle.'}
                </p>
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="text-sm font-semibold text-indigo-300 hover:text-indigo-200"
              >
                {lang === 'th' ? 'รีเซ็ตตัวกรอง' : 'Reset filters'}
              </button>
            </div>
            <div className="mt-4 space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <FilterGroup
                label={lang === 'th' ? 'กรองเดือน' : 'Filter months'}
                lang={lang}
                onClear={() => setMonthFilters([])}
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
                    placeholder={monthOptions.length === 0 ? (lang === 'th' ? 'ไม่มีเดือนให้เลือก' : 'No months available') : (lang === 'th' ? 'ค้นหาเดือน' : 'Search months')}
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
                        () => setMonthSearch(''),
                      )
                    }
                    className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs text-slate-700 dark:text-slate-200 hover:border-slate-500"
                  >
                    {lang === 'th' ? 'เพิ่ม' : 'Add'}
                  </button>
                </div>
              </FilterGroup>
              {organizationName ? null : (
                <FilterGroup
                  label={lang === 'th' ? 'กรองฟลีท' : 'Filter fleets'}
                  lang={lang}
                  onClear={() => setFleetFilters([])}
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
                      placeholder={fleetOptions.length === 0 ? (lang === 'th' ? 'ไม่มีฟลีทให้เลือก' : 'No fleets available') : (lang === 'th' ? 'ค้นหาฟลีท' : 'Search fleets')}
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
                          () => setFleetSearch(''),
                        )
                      }
                      className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs text-slate-700 dark:text-slate-200 hover:border-slate-500"
                    >
                      {lang === 'th' ? 'เพิ่ม' : 'Add'}
                    </button>
                  </div>
                </FilterGroup>
              )}
              <FilterGroup
                label={lang === 'th' ? 'กรองประเภทการแจ้งเตือน' : 'Filter alert types'}
                lang={lang}
                onClear={() => setRemarkFilters([])}
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
                    placeholder={remarkOptions.length === 0 ? (lang === 'th' ? 'ไม่มีประเภทการแจ้งเตือนให้เลือก' : 'No alert types available') : (lang === 'th' ? 'ค้นหาประเภทการแจ้งเตือน' : 'Search alert types')}
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
                        () => setRemarkSearch(''),
                      )
                    }
                    className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs text-slate-700 dark:text-slate-200 hover:border-slate-500"
                  >
                    {lang === 'th' ? 'เพิ่ม' : 'Add'}
                  </button>
                </div>
              </FilterGroup>
              <FilterGroup
                label={lang === 'th' ? 'กรองรถ' : 'Filter vehicles'}
                lang={lang}
                onClear={() => setVehicleFilters([])}
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
                    placeholder={vehicleOptions.length === 0 ? (lang === 'th' ? 'ไม่มีรถให้เลือก' : 'No vehicles available') : (lang === 'th' ? 'ค้นหารถ' : 'Search vehicles')}
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
                        () => setVehicleSearch(''),
                      )
                    }
                    className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs text-slate-700 dark:text-slate-200 hover:border-slate-500"
                  >
                    {lang === 'th' ? 'เพิ่ม' : 'Add'}
                  </button>
                </div>
              </FilterGroup>
              {driverOptions.length > 0 ? (
                <FilterGroup
                  label={lang === 'th' ? 'กรองคนขับ' : 'Filter drivers'}
                  lang={lang}
                  onClear={() => setDriverFilters([])}
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
                      placeholder={driverOptions.length === 0 ? (lang === 'th' ? 'ไม่มีคนขับให้เลือก' : 'No drivers available') : (lang === 'th' ? 'ค้นหาคนขับ' : 'Search drivers')}
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
                          (trimmed) => driverOptions.find((option) => normalizeLabel(option) === normalizeLabel(trimmed)),
                          (matched) =>
                            setDriverFilters((current) => (current.includes(matched) ? current : [...current, matched])),
                          () => setDriverSearch(''),
                        )
                      }
                      className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs text-slate-700 dark:text-slate-200 hover:border-slate-500"
                    >
                      {lang === 'th' ? 'เพิ่ม' : 'Add'}
                    </button>
                  </div>
                </FilterGroup>
              ) : null}
            </div>
            </section>

            <section className={dashboardSectionClass}>
              <div>
                <h2 className="text-lg font-medium">{lang === 'th' ? 'สรุปไฮไลต์ประเภทการแจ้งเตือน' : 'Alert type highlights'}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {activeMonthKey
                    ? (lang === 'th' ? `แสดงยอดรวมของ ${activeMonthLabel} พร้อมการเปลี่ยนแปลงเทียบเดือนก่อน` : `Showing ${activeMonthLabel} totals with change versus last month.`)
                    : (lang === 'th' ? `แสดงยอดรวมของ ${activeMonthLabel}` : `Showing ${activeMonthLabel} totals.`)}
                </p>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {highlightItems.map((item) => {
                  const summary = buildDeltaSummary(item.current, item.previous);
                  return (
                    <div key={item.label} className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/15 via-fuchsia-500/10 to-cyan-500/15 p-4">
                      <div className="text-sm text-slate-600 dark:text-slate-300">{item.label}</div>
                      <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                        {item.current}
                      </div>
                      {activeMonthKey ? (
                        <>
                          <div
                            className={`mt-3 text-sm ${summary.isIncrease ? 'text-emerald-300' : 'text-rose-300'}`}
                          >
                            {summary.deltaLabel}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{summary.percentLabel}</div>
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className={dashboardSectionClass}>
              <div>
                <h2 className="text-lg font-medium">{lang === 'th' ? 'เปรียบเทียบรายเดือน' : 'Monthly comparison'}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {lang === 'th'
                    ? 'เปรียบเทียบจำนวนการแจ้งเตือนของทุกเดือนหลังจากใช้ตัวกรองอื่น ๆ แล้ว'
                    : 'Compare total alert volume across all months after applying non-month filters.'}
                </p>
              </div>
              {monthlyComparisonRows.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                  {lang === 'th' ? 'ไม่มีข้อมูลรายเดือนที่สามารถเปรียบเทียบได้' : 'No monthly data available to compare.'}
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
                    <thead>
                      <tr className="text-left text-slate-500 dark:text-slate-400">
                        <th className="px-3 py-2 font-medium">{lang === 'th' ? 'เดือน' : 'Month'}</th>
                        <th className="px-3 py-2 font-medium">{lang === 'th' ? 'จำนวนทั้งหมด' : 'Total alerts'}</th>
                        <th className="px-3 py-2 font-medium">{lang === 'th' ? 'เทียบเดือนก่อน' : 'Vs previous month'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {monthlyComparisonRows.map((row) => {
                        const deltaSummary = buildDeltaSummary(row.total, row.previousTotal);
                        return (
                          <tr
                            key={row.monthKey}
                            className={row.isSelected ? 'bg-indigo-500/10' : undefined}
                          >
                            <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{row.monthLabel}</td>
                            <td className="px-3 py-2 text-slate-900 dark:text-white">{row.total}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`font-medium ${deltaSummary.isIncrease ? 'text-emerald-400' : 'text-rose-400'}`}
                              >
                                {formatMonthDelta(row.total, row.previousTotal, lang)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div className="grid gap-6 lg:grid-cols-3">
              <PieChartCard
                title={lang === 'th' ? 'ปริมาณตามฟลีท' : 'Fleet volume'}
                subtitle={lang === 'th' ? 'การกระจายของฟลีทตามกิจกรรมการแจ้งเตือน' : 'Fleet distribution based on alert activity.'}
                rows={topFleets}
              />

              <PieChartCard
                title={lang === 'th' ? 'สัดส่วนประเภทการแจ้งเตือน' : 'Alert type mix'}
                subtitle={lang === 'th' ? 'ประเภทการแจ้งเตือนที่พบบ่อยที่สุดในข้อมูลที่กรองแล้ว' : 'Most frequent alert types in the filtered alerts.'}
                rows={topRemarks}
              />

              <PieChartCard
                title={lang === 'th' ? 'ปริมาณตามรถ' : 'Vehicle volume'}
                subtitle={lang === 'th' ? 'รถที่มีการแจ้งเตือนมากที่สุด' : 'Top vehicles based on alert activity.'}
                rows={topVehicles}
              />
            </div>

          </div>
        )}
    </DashboardShell>
  );
}

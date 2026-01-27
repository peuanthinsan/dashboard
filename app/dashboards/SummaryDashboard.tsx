'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const hasRemark = (value: string) => value !== '—' && value.trim() !== '';

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

export default function SummaryDashboard({
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

  const allowedAlertTypes = useMemo(
    () => [
      'Distraction-A2',
      'Eye Closing-A2',
      'OverSpeed',
      'Harsh Acceleration',
      'Harsh Brake',
      'Forward Collision-A2',
      'Seatbelt-A2',
      'Camera Cover',
    ],
    [],
  );

  const allowedRemarkTargets = useMemo(
    () => [
      'Fatigue',
      'Yawning',
      'Distraction',
      'Smoking',
      'Mobile Phone',
      'Eating/Drinking',
      'Seatbelt',
      'Camera Cover',
      'Harsh Brake',
      'Harsh Acceleration',
      'OverSpeed',
      'Maintenance',
      'Mirror Check',
      'Speed Meter Check',
    ],
    [],
  );

  const alertRows = useMemo(() => {
    const mappedRows = rows.map((row) => {
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
  const topRemarks = remarkSummary.slice(0, 6);
  const topVehicles = vehicleSummary.slice(0, 6);
  const maxFleetTotal = topFleets[0]?.total ?? 0;
  const maxRemarkTotal = topRemarks[0]?.total ?? 0;
  const maxVehicleTotal = topVehicles[0]?.total ?? 0;

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

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-[1252px] flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/dashboard"
              className="mb-2 inline-flex w-fit items-center gap-2 text-sm text-slate-300 transition hover:text-white"
            >
              <span aria-hidden="true">←</span>
              Back to dashboards
            </Link>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Summary dashboard</p>
            <h1 className="text-2xl font-semibold sm:text-3xl">{dashboardName}</h1>
            {lastUpdated ? (
              <p className="mt-1 text-xs text-slate-400">Last updated {lastUpdated.toLocaleString()}</p>
            ) : null}
            {dashboardNotes ? (
              <div className="mt-3 w-full rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-200">
                {dashboardNotes}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={refresh}
            className="w-full rounded-lg border border-slate-700 px-4 py-2 text-sm text-white hover:border-slate-500 sm:w-auto"
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
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-medium">Filters</h2>
                  <p className="text-sm text-slate-400">
                    Narrow alerts by remark, month, fleet, or vehicle.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
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
                  }}
                  className="text-sm font-semibold text-indigo-300 hover:text-indigo-200"
                >
                  Reset filters
                </button>
              </div>
              <div className="mt-4 space-y-3 text-xs text-slate-300">
                <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 sm:flex-row sm:items-center">
                  <span className="uppercase tracking-[0.2em] text-slate-500">Filter months</span>
                  <div className="flex w-full flex-1 flex-wrap items-center gap-2">
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
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                      <input
                        list="month-options"
                        value={monthSearch}
                        onChange={(event) => setMonthSearch(event.target.value)}
                        placeholder={monthOptions.length === 0 ? 'No months available' : 'Search months'}
                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 sm:min-w-[220px] sm:w-auto"
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
                        }}
                        className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMonthFilters([])}
                    className="w-full rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500 sm:w-auto"
                  >
                    Clear
                  </button>
                  {monthFilters.length > 0 ? (
                    <span className="text-slate-500">{monthFilters.length} selected</span>
                  ) : null}
                </div>
                {organizationName ? null : (
                  <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 sm:flex-row sm:items-center">
                    <span className="uppercase tracking-[0.2em] text-slate-500">Filter fleets</span>
                    <div className="flex w-full flex-1 flex-wrap items-center gap-2">
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
                      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                        <input
                          list="fleet-options"
                          value={fleetSearch}
                          onChange={(event) => setFleetSearch(event.target.value)}
                          placeholder={fleetOptions.length === 0 ? 'No fleets available' : 'Search fleets'}
                          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 sm:min-w-[220px] sm:w-auto"
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
                          }}
                          className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFleetFilters([])}
                      className="w-full rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500 sm:w-auto"
                    >
                      Clear
                    </button>
                    {fleetFilters.length > 0 ? (
                      <span className="text-slate-500">{fleetFilters.length} selected</span>
                    ) : null}
                  </div>
                )}
                <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 sm:flex-row sm:items-center">
                  <span className="uppercase tracking-[0.2em] text-slate-500">Filter remark types</span>
                  <div className="flex w-full flex-1 flex-wrap items-center gap-2">
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
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                      <input
                        list="remark-options"
                        value={remarkSearch}
                        onChange={(event) => setRemarkSearch(event.target.value)}
                        placeholder={remarkOptions.length === 0 ? 'No remarks available' : 'Search remarks'}
                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 sm:min-w-[220px] sm:w-auto"
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
                        }}
                        className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRemarkFilters([])}
                    className="w-full rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500 sm:w-auto"
                  >
                    Clear
                  </button>
                  {remarkFilters.length > 0 ? (
                    <span className="text-slate-500">{remarkFilters.length} selected</span>
                  ) : null}
                </div>
                <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 sm:flex-row sm:items-center">
                  <span className="uppercase tracking-[0.2em] text-slate-500">Filter vehicles</span>
                  <div className="flex w-full flex-1 flex-wrap items-center gap-2">
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
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                      <input
                        list="vehicle-options"
                        value={vehicleSearch}
                        onChange={(event) => setVehicleSearch(event.target.value)}
                        placeholder={vehicleOptions.length === 0 ? 'No vehicles available' : 'Search vehicles'}
                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 sm:min-w-[220px] sm:w-auto"
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
                        }}
                        className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVehicleFilters([])}
                    className="w-full rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500 sm:w-auto"
                  >
                    Clear
                  </button>
                  {vehicleFilters.length > 0 ? (
                    <span className="text-slate-500">{vehicleFilters.length} selected</span>
                  ) : null}
                </div>
                {driverOptions.length > 0 ? (
                  <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 sm:flex-row sm:items-center">
                    <span className="uppercase tracking-[0.2em] text-slate-500">Filter drivers</span>
                    <div className="flex w-full flex-1 flex-wrap items-center gap-2">
                      <div className="flex flex-wrap gap-2">
                        {driverFilters.map((driver) => (
                          <button
                            key={driver}
                            type="button"
                            onClick={() =>
                              setDriverFilters((current) => current.filter((value) => value !== driver))
                            }
                            className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-100"
                          >
                            {driver} ×
                          </button>
                        ))}
                      </div>
                      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                        <input
                          list="driver-options"
                          value={driverSearch}
                          onChange={(event) => setDriverSearch(event.target.value)}
                          placeholder={driverOptions.length === 0 ? 'No drivers available' : 'Search drivers'}
                          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 sm:min-w-[220px] sm:w-auto"
                        />
                        <datalist id="driver-options">
                          {filteredDriverOptions.map((option) => (
                            <option key={option} value={option} />
                          ))}
                        </datalist>
                        <button
                          type="button"
                          onClick={() => {
                            const trimmed = driverSearch.trim();
                            if (!trimmed) return;
                            const matched = driverOptions.find(
                              (option) => normalizeLabel(option) === normalizeLabel(trimmed),
                            );
                            if (!matched) return;
                            setDriverFilters((current) =>
                              current.includes(matched) ? current : [...current, matched],
                            );
                            setDriverSearch('');
                          }}
                          className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDriverFilters([])}
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
              <div>
                <h2 className="text-lg font-medium">Alert remark highlights</h2>
                <p className="text-sm text-slate-400">
                  {activeMonthKey
                    ? `Showing ${activeMonthLabel} totals with change versus last month.`
                    : `Showing ${activeMonthLabel} totals.`}
                </p>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {highlightItems.map((item) => {
                  const summary = buildDeltaSummary(item.current, item.previous);
                  return (
                    <div key={item.label} className="rounded-2xl border border-indigo-500/20 bg-slate-900/40 p-4">
                      <div className="text-sm text-slate-300">{item.label}</div>
                      <div className="mt-2 text-2xl font-semibold text-white">{item.current}</div>
                      {activeMonthKey ? (
                        <>
                          <div
                            className={`mt-3 text-sm ${summary.isIncrease ? 'text-emerald-300' : 'text-rose-300'}`}
                          >
                            {summary.deltaLabel}
                          </div>
                          <div className="text-xs text-slate-400">{summary.percentLabel}</div>
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-3">
              <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg sm:p-6">
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

              <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg sm:p-6">
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

              <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg sm:p-6">
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

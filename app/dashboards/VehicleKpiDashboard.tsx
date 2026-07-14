'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { type DashboardLang } from 'app/dashboard/i18n-copy';
import EmptyState from 'app/ui/EmptyState';
import FilterBar from 'app/ui/FilterBar';
import GradeBadge from 'app/ui/GradeBadge';
import InlineMonthPicker from 'app/ui/InlineMonthPicker';
import KpiCard from 'app/ui/KpiCard';
import MultiSelect from 'app/ui/MultiSelect';
import { DataTable, type Column } from 'app/ui/DataTable';
import { exportVehicleKpiXlsx } from 'app/ui/exportVehicleKpiXlsx';
import { heading2, textSecondary } from 'app/ui/design-tokens';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import LoadingState from './LoadingState';
import useGoogleSheet from './useGoogleSheet';
import { loadStoredFilters, saveStoredFilters } from './filterStorage';
import {
  ALERT_TIME_ALIASES,
  findValue,
  normalizeLabel,
  parseDate,
  resolveScopeFleetNames,
  scopeFleetSet,
  toMonthKey,
} from './dashboardDataUtils';
import {
  GRADE_COLORS,
  VEHICLE_KPI_CATEGORIES,
  aggregateVehicleKpi,
  emptyVehicleKpiCounts,
  gradeForCount,
  rollupByFleet,
  type VehicleKpiCounts,
  type VehicleKpiFleetRow,
  type VehicleKpiInputRow,
  type VehicleKpiRow,
} from './vehicleKpiUtils';

type DashboardProps = {
  dashboardId: string;
  dashboardName: string;
  sheetId: string;
  sheetGid: string;
  dashboardNotes?: string | null;
  organizationName?: string | null;
  organizationNames?: string[] | null;
  lang?: DashboardLang;
  allowedAlertTypes?: string[] | null;
  allowedRemarks?: string[] | null;
  isAdmin?: boolean;
};

type ParsedVehicleKpiRow = VehicleKpiInputRow & {
  date: Date | null;
  monthKey: string | null;
  monthLabel: string;
};

type VehicleKpiTableRow = VehicleKpiRow & VehicleKpiCounts;
type VehicleKpiFleetTableRow = VehicleKpiFleetRow & VehicleKpiCounts;

const toTrimmedString = (value: unknown): string =>
  value == null ? '' : String(value).trim();

const toNullableString = (value: unknown): string | null => {
  const text = toTrimmedString(value);
  return text || null;
};

const totalIncidents = ({ counts }: { counts: VehicleKpiCounts }): number =>
  VEHICLE_KPI_CATEGORIES.reduce((total, category) => total + counts[category.key], 0);

/** Renders the DHL five-category VehicleKPI grading view from month-scoped alert data. */
export default function VehicleKpiDashboard({
  dashboardId,
  dashboardName,
  sheetId,
  sheetGid,
  dashboardNotes,
  organizationName,
  organizationNames,
  lang = 'en',
  isAdmin = false,
}: DashboardProps) {
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const [monthFilters, setMonthFilters] = useState<string[]>([]);
  const [vehicleFilters, setVehicleFilters] = useState<string[]>([]);
  const scopeNames = useMemo(
    () => resolveScopeFleetNames(organizationName, organizationNames),
    [organizationName, organizationNames],
  );
  const scopeSet = useMemo(
    () => scopeFleetSet(organizationName, organizationNames),
    [organizationName, organizationNames],
  );
  const [fleetFilters, setFleetFilters] = useState<string[]>(() => scopeNames);
  const storageKey = useMemo(() => `${dashboardId}-vehiclekpi`, [dashboardId]);
  const didSetDefaultMonth = useRef(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const {
    rows,
    loading,
    refreshing,
    progress,
    error,
    lastUpdated,
    refresh,
    availableMonths,
  } = useGoogleSheet({
    sheetId,
    gid: sheetGid,
    monthKeys: monthFilters,
    loadMonthCatalog: true,
  });

  useEffect(() => {
    const stored = loadStoredFilters<{
      monthFilters?: string[];
      vehicleFilters?: string[];
      fleetFilters?: string[];
    }>(storageKey);
    if (!stored) return;

    const frame = requestAnimationFrame(() => {
      const storedMonths = Array.isArray(stored.monthFilters)
        ? stored.monthFilters.filter((value) => typeof value === 'string')
        : [];
      if (storedMonths.length > 0) {
        didSetDefaultMonth.current = true;
        setMonthFilters(storedMonths);
      }

      const storedVehicles = Array.isArray(stored.vehicleFilters)
        ? stored.vehicleFilters.filter((value) => typeof value === 'string')
        : [];
      setVehicleFilters(storedVehicles);

      const storedFleets = Array.isArray(stored.fleetFilters)
        ? stored.fleetFilters.filter((value) => typeof value === 'string')
        : [];
      setFleetFilters(storedFleets.length > 0 ? storedFleets : scopeNames);
    });

    return () => cancelAnimationFrame(frame);
  }, [scopeNames, storageKey]);

  useEffect(() => {
    saveStoredFilters(storageKey, { monthFilters, vehicleFilters, fleetFilters });
  }, [storageKey, monthFilters, vehicleFilters, fleetFilters]);

  const parsedRows = useMemo<ParsedVehicleKpiRow[]>(() => {
    return rows
      .map((row) => {
        const vehicle = toTrimmedString(findValue(row, ['Vehicle No', 'Vehicle']));
        const fleet = toTrimmedString(findValue(row, ['Fleet']));
        const alertType = toNullableString(findValue(row, ['Alert Type']));
        const remark = toNullableString(findValue(row, ['Remarks']));
        const date = parseDate(findValue(row, ALERT_TIME_ALIASES));
        return {
          vehicle,
          fleet,
          alertType,
          remark,
          date,
          monthKey: date ? toMonthKey(date) : null,
          monthLabel: date
            ? date.toLocaleDateString(undefined, {
                month: 'short',
                year: 'numeric',
                timeZone: 'UTC',
              })
            : 'Unknown',
        };
      })
      .filter((row) => scopeSet.size === 0 || scopeSet.has(normalizeLabel(row.fleet)));
  }, [rows, scopeSet]);

  const vehicleOptions = useMemo(
    () => Array.from(new Set(parsedRows.map((row) => row.vehicle).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    ),
    [parsedRows],
  );

  const fleetOptions = useMemo(() => {
    const fleets = new Set<string>();
    parsedRows.forEach((row) => {
      if (row.fleet) fleets.add(row.fleet);
    });
    return Array.from(fleets).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [parsedRows]);

  const monthOptions = useMemo(() => {
    if (availableMonths.length > 0) {
      return availableMonths.map((month) => ({ key: month.key, label: month.label }));
    }

    const months = new Map<string, string>();
    parsedRows.forEach((row) => {
      if (row.monthKey) months.set(row.monthKey, row.monthLabel);
    });
    return Array.from(months.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [availableMonths, parsedRows]);

  const defaultMonthKeys = useMemo(() => {
    const keys = Array.from(new Set(monthOptions.map((month) => month.key))).sort();
    const fromJune2026 = keys.filter((key) => key >= '2026-06');
    if (fromJune2026.length > 0) return fromJune2026;
    return keys.length > 0 ? [keys[keys.length - 1]!] : [];
  }, [monthOptions]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (didSetDefaultMonth.current) return;
      if (defaultMonthKeys.length === 0) return;
      if (monthFilters.length > 0) {
        didSetDefaultMonth.current = true;
        return;
      }
      didSetDefaultMonth.current = true;
      setMonthFilters(defaultMonthKeys);
    });
    return () => cancelAnimationFrame(frame);
  }, [defaultMonthKeys, monthFilters]);

  const resetFilters = () => {
    setMonthFilters(defaultMonthKeys);
    setVehicleFilters([]);
    setFleetFilters(scopeNames);
  };

  const filteredRows = useMemo(() => {
    return parsedRows.filter((row) => {
      if (monthFilters.length > 0 && (!row.monthKey || !monthFilters.includes(row.monthKey))) return false;
      if (vehicleFilters.length > 0 && !vehicleFilters.includes(row.vehicle)) return false;
      if (fleetFilters.length > 0 && !fleetFilters.includes(row.fleet)) return false;
      return true;
    });
  }, [parsedRows, monthFilters, vehicleFilters, fleetFilters]);

  const vehicleRows = useMemo<VehicleKpiRow[]>(() => {
    return Array.from(aggregateVehicleKpi(filteredRows).values()).sort((a, b) => {
      const countDifference = totalIncidents(b) - totalIncidents(a);
      return countDifference || a.vehicle.localeCompare(b.vehicle, undefined, { numeric: true });
    });
  }, [filteredRows]);

  const fleetRows = useMemo(() => rollupByFleet(vehicleRows), [vehicleRows]);

  const totals = useMemo(() => {
    const next = emptyVehicleKpiCounts();
    vehicleRows.forEach((row) => {
      VEHICLE_KPI_CATEGORIES.forEach((category) => {
        next[category.key] += row.counts[category.key];
      });
    });
    return next;
  }, [vehicleRows]);

  const vehicleTableRows = useMemo<VehicleKpiTableRow[]>(
    () => vehicleRows.map((row) => ({ ...row, ...row.counts })),
    [vehicleRows],
  );

  const fleetTableRows = useMemo<VehicleKpiFleetTableRow[]>(
    () => fleetRows.map((row) => ({ ...row, ...row.counts })),
    [fleetRows],
  );

  const categoryColumns = useMemo<Column<VehicleKpiTableRow>[]>(
    () => VEHICLE_KPI_CATEGORIES.map((category) => ({
      key: category.key,
      label: category.label,
      sortable: true,
      render: (value) => (
        <GradeBadge
          count={Number(value)}
          showNotAvailable={category.key === 'seatbelt'}
        />
      ),
    })),
    [],
  );

  const vehicleColumns = useMemo<Column<VehicleKpiTableRow>[]>(
    () => [
      { key: 'vehicle', label: 'Vehicle', sortable: true, stickyLeft: true },
      { key: 'fleet', label: 'Fleet', sortable: true },
      ...categoryColumns,
    ],
    [categoryColumns],
  );

  const fleetColumns = useMemo<Column<VehicleKpiFleetTableRow>[]>(
    () => [
      { key: 'fleet', label: 'Fleet', sortable: true, stickyLeft: true },
      ...VEHICLE_KPI_CATEGORIES.map((category) => ({
        key: category.key,
        label: category.label,
        sortable: true,
        render: (value: unknown) => (
          <GradeBadge
            count={Number(value)}
            showNotAvailable={category.key === 'seatbelt'}
          />
        ),
      })),
    ],
    [],
  );

  const activeFilterCount = useMemo(
    () => [monthFilters.length > 0, vehicleFilters.length > 0, fleetFilters.length > 0].filter(Boolean).length,
    [monthFilters, vehicleFilters, fleetFilters],
  );

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      await exportVehicleKpiXlsx({ vehicleRows, fleetRows, monthKeys: monthFilters });
    } catch (exportFailure) {
      setExportError(exportFailure instanceof Error ? exportFailure.message : 'Unable to export Excel.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <DashboardShell
        title={dashboardName}
        subtitle="Vehicle KPI dashboard"
        lang={lang}
        lastUpdated={lastUpdated}
        notes={dashboardNotes}
      >
        <div className="flex flex-col gap-6">
          <FilterBar>
            <InlineMonthPicker value={monthFilters} onChange={(value) => setMonthFilters(value as string[])} multi lang={lang} />
          </FilterBar>
          <LoadingState
            lang={lang}
            message={
              progress
                ? `Loading selected months… ${Math.round((progress.done / progress.total) * 100)}%`
                : 'Loading Vehicle KPI dashboard'
            }
            detail="Fetching vehicle safety alerts."
          />
        </div>
      </DashboardShell>
    );
  }

  if (error) {
    return (
      <DashboardShell
        title={dashboardName}
        subtitle="Vehicle KPI dashboard"
        lang={lang}
        lastUpdated={lastUpdated}
        notes={dashboardNotes}
      >
        <LoadingState lang={lang} error={error} onRetry={refresh} />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title={dashboardName}
      subtitle="Vehicle KPI dashboard"
      lang={lang}
      lastUpdated={lastUpdated}
      notes={dashboardNotes}
      isStale={lastUpdated ? nowTick - lastUpdated.getTime() > 5 * 60 * 1000 : false}
      activeFilterCount={activeFilterCount}
      dashboardId={dashboardId}
      isAdmin={isAdmin}
      actions={
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting || vehicleRows.length === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-200/60 bg-white/80 px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-card backdrop-blur-sm transition-all duration-200 hover:border-zinc-300 hover:shadow-card-hover disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700/60 dark:bg-zinc-800/80 dark:text-zinc-200 dark:hover:border-zinc-600"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {exporting ? 'Exporting…' : 'Export Excel'}
        </button>
      }
    >
      <div className="flex flex-col gap-6">
        {refreshing && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400" role="status" aria-live="polite">
            Loading more data…{progress ? ` ${Math.round((progress.done / progress.total) * 100)}%` : ''}
          </p>
        )}

        {exportError && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300" role="alert">
            {exportError}
          </p>
        )}

        <FilterBar>
          <InlineMonthPicker value={monthFilters} onChange={(value) => setMonthFilters(value as string[])} multi lang={lang} />
          <MultiSelect
            label={lang === 'th' ? 'ยานพาหนะ' : 'vehicles'}
            options={vehicleOptions}
            selected={vehicleFilters}
            onChange={setVehicleFilters}
            lang={lang}
          />
          {fleetOptions.length > 1 && (
            <MultiSelect
              label={lang === 'th' ? 'กลุ่มรถ' : 'fleets'}
              options={fleetOptions}
              selected={fleetFilters}
              onChange={setFleetFilters}
              lang={lang}
            />
          )}
          {activeFilterCount > 0 && (
            <button type="button" onClick={resetFilters} className="ml-auto text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
              {lang === 'th' ? 'รีเซ็ต' : 'Reset'}
            </button>
          )}
        </FilterBar>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {VEHICLE_KPI_CATEGORIES.map((category) => {
            const count = totals[category.key];
            const grade = gradeForCount(count);
            return (
              <KpiCard
                key={category.key}
                label={category.label}
                value={count}
                subtitle={`Grade ${grade}${category.key === 'seatbelt' && count === 0 ? ' · N/A' : ''}`}
                accentColor={GRADE_COLORS[grade]}
              />
            );
          })}
        </div>

        <section className={dashboardSectionClass}>
          <h2 className={heading2}>Fleet rollup</h2>
          <p className={`mt-1 ${textSecondary}`}>
            {fleetRows.length} fleet{fleetRows.length === 1 ? '' : 's'} in the selected range.
          </p>
          <div className="mt-4">
            {fleetTableRows.length === 0 ? (
              <EmptyState title="No fleet data" />
            ) : (
              <DataTable
                columns={fleetColumns}
                data={fleetTableRows}
                defaultSort={{ key: 'fleet', direction: 'asc' }}
                pageSize={15}
                ariaLabel="Vehicle KPI fleet rollup"
              />
            )}
          </div>
        </section>

        <section className={dashboardSectionClass}>
          <h2 className={heading2}>Vehicle grades</h2>
          <p className={`mt-1 ${textSecondary}`}>
            {vehicleRows.length} vehicle{vehicleRows.length === 1 ? '' : 's'} in the selected range.
          </p>
          <div className="mt-4">
            {vehicleTableRows.length === 0 ? (
              <EmptyState title="No vehicle data" />
            ) : (
              <DataTable
                columns={vehicleColumns}
                data={vehicleTableRows}
                defaultSort={{ key: 'speeding', direction: 'desc' }}
                pageSize={25}
                ariaLabel="Vehicle KPI grades by vehicle"
              />
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

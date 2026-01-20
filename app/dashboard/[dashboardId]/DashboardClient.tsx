'use client';

import { useMemo, useState } from 'react';
import useGoogleSheet from 'app/hooks/useGoogleSheet';

const normalizeLabel = (label: string | null | undefined) => (label ? label.trim().toLowerCase() : '');
const normalizeRemark = (value: unknown) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
const normalizeRemarkKey = (value: unknown) => {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toLowerCase();
  return normalized.replace(/(?:[-\s])?a2$/i, '');
};
const resolveRemark = (remark: unknown, alertType: unknown) => {
  const normalizedRemark = normalizeRemark(remark);
  if (normalizedRemark) {
    return String(remark).trim();
  }
  const normalizedAlertType = normalizeLabel(String(alertType ?? ''));
  if (normalizedAlertType === 'forward collision-a2') {
    return 'Forward collision';
  }
  return null;
};
const ALLOWED_ALERT_TYPES = new Set(
  ['Eye Closing-A2', 'Forward Collision-A2', 'Seatbelt-A2'].map((type) => type.toLowerCase()),
);

const formatDateLabel = (value: unknown) => {
  if (!value) return 'Unspecified';
  if (value instanceof Date) {
    return value.toLocaleDateString();
  }
  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toLocaleDateString();
};

const formatDateTimeLabel = (value: unknown) => {
  if (!value) return '';
  if (value instanceof Date) {
    return value.toLocaleString();
  }
  return String(value);
};

const formatMonthYearLabel = (value: string) => {
  if (!value) return 'Unspecified';
  const [year, month] = String(value).split('-');
  if (!year || !month) return String(value);
  const parsedYear = Number(year);
  const parsedMonthIndex = Number(month) - 1;
  const date = new Date(parsedYear, parsedMonthIndex, 1);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};

const TARGET_REMARKS = [
  'fatigue',
  'yawning',
  'distraction',
  'smoking',
  'mobile phone',
  'seatbelt',
  'eating/drinking',
  'forward collision',
];
const REMARK_LABELS: Record<string, string> = {
  fatigue: 'Fatigue',
  yawning: 'Yawning',
  distraction: 'Distraction',
  smoking: 'Smoking',
  'mobile phone': 'Mobile phone',
  seatbelt: 'Seatbelt',
  'eating/drinking': 'Eating/Drinking',
  'forward collision': 'Forward collision',
};
const EXCLUDED_REMARKS = new Set(['no video', 'false alert']);

const buildColumnFinder = (columns: Array<{ label: string; field: string; type: string }>) => {
  return ({ matches, fallbackIndex }: { matches: string[]; fallbackIndex: number | null }) => {
    const match = columns.find((column) => {
      const label = normalizeLabel(column.label);
      return matches.some((target) => label === target || label.includes(target));
    });
    if (match) return match;
    if (fallbackIndex == null) return null;
    return columns[fallbackIndex] || null;
  };
};

type DashboardClientProps = {
  sheetId: string;
  gid: string;
};

export default function DashboardClient({ sheetId, gid }: DashboardClientProps) {
  const { columns, records, formattedRows, loading, error, lastUpdated, refresh } = useGoogleSheet({
    sheetId,
    gid,
  });
  const findColumn = useMemo(() => buildColumnFinder(columns), [columns]);

  const vehicleColumn = useMemo(
    () =>
      findColumn({
        matches: ['vehicle no', 'vehicle number', 'vehicle'],
        fallbackIndex: 0,
      }),
    [findColumn],
  );
  const driverColumn = useMemo(
    () =>
      findColumn({
        matches: ['driver name', 'driver'],
        fallbackIndex: null,
      }),
    [findColumn],
  );
  const alertTypeColumn = useMemo(
    () =>
      findColumn({
        matches: ['alert type', 'alert'],
        fallbackIndex: 2,
      }),
    [findColumn],
  );
  const dateTimeColumn = useMemo(() => {
    const preferred = columns.find((column) => {
      const label = normalizeLabel(column.label);
      return label.includes('alert date time') || label.includes('track time');
    });
    if (preferred) return preferred;
    const fallback = columns.find((column) => {
      const label = normalizeLabel(column.label);
      return column.type === 'date' || column.type === 'datetime' || label === 'date' || label.includes('date');
    });
    return fallback || null;
  }, [columns]);
  const speedColumn = useMemo(
    () =>
      findColumn({
        matches: ['speed'],
        fallbackIndex: null,
      }),
    [findColumn],
  );
  const remarksColumn = useMemo(
    () =>
      findColumn({
        matches: ['remarks', 'remark'],
        fallbackIndex: null,
      }),
    [findColumn],
  );
  const fleetColumn = useMemo(
    () =>
      findColumn({
        matches: ['fleet'],
        fallbackIndex: null,
      }),
    [findColumn],
  );
  const videoColumn = useMemo(
    () =>
      findColumn({
        matches: ['videourl', 'video url', 'video'],
        fallbackIndex: null,
      }),
    [findColumn],
  );

  const [selectedAlertType, setSelectedAlertType] = useState('all');
  const [selectedMonthYear, setSelectedMonthYear] = useState('all');
  const [selectedVehicle, setSelectedVehicle] = useState('all');
  const [selectedFleet, setSelectedFleet] = useState('all');
  const [selectedRemark, setSelectedRemark] = useState('all');

  const resetFilters = () => {
    setSelectedAlertType('all');
    setSelectedMonthYear('all');
    setSelectedVehicle('all');
    setSelectedFleet('all');
    setSelectedRemark('all');
  };

  const alertRows = useMemo(() => {
    if (!vehicleColumn || !alertTypeColumn || !dateTimeColumn) return [];
    return records
      .map((row, index) => {
        const dateValue = row[dateTimeColumn.field];
        if (!(dateValue instanceof Date) || Number.isNaN(dateValue.getTime())) {
          return null;
        }
        const vehicle = row[vehicleColumn.field];
        const alertType = row[alertTypeColumn.field];
        if (!vehicle || !alertType) {
          return null;
        }
        if (!ALLOWED_ALERT_TYPES.has(String(alertType).trim().toLowerCase())) {
          return null;
        }
        const dateKey = dateValue.toISOString().slice(0, 10);
        const resolvedRemark = resolveRemark(remarksColumn ? row[remarksColumn.field] : null, alertType);
        return {
          id: `${index}-${dateKey}`,
          dateKey,
          dateValue,
          dateDisplay: formatDateLabel(dateValue),
          dateTimeDisplay: formattedRows[index]?.[dateTimeColumn.field] ?? formatDateTimeLabel(dateValue),
          monthKey: dateKey.slice(0, 7),
          vehicle: String(vehicle),
          driver: driverColumn ? row[driverColumn.field] : null,
          alertType: String(alertType),
          speed: speedColumn ? row[speedColumn.field] : null,
          remarks: resolvedRemark,
          fleet: fleetColumn ? row[fleetColumn.field] : null,
          videoUrl: videoColumn ? row[videoColumn.field] : null,
        };
      })
      .filter((row) => {
        if (!row) return false;
        const remarkValue = normalizeRemark(row.remarks);
        if (remarkValue && EXCLUDED_REMARKS.has(remarkValue)) {
          return false;
        }
        return true;
      });
  }, [
    alertTypeColumn,
    dateTimeColumn,
    driverColumn,
    fleetColumn,
    formattedRows,
    records,
    remarksColumn,
    speedColumn,
    vehicleColumn,
    videoColumn,
  ]);

  const alertTypeOptions = useMemo(() => {
    const unique = new Set<string>();
    alertRows.forEach((row) => {
      if (row.alertType) unique.add(row.alertType);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [alertRows]);

  const monthYearOptions = useMemo(() => {
    const unique = new Set<string>();
    alertRows.forEach((row) => {
      if (row.monthKey) unique.add(row.monthKey);
    });
    return Array.from(unique).sort((a, b) => b.localeCompare(a));
  }, [alertRows]);

  const vehicleOptions = useMemo(() => {
    const unique = new Set<string>();
    alertRows.forEach((row) => {
      if (row.vehicle) unique.add(row.vehicle);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [alertRows]);

  const fleetOptions = useMemo(() => {
    const unique = new Set<string>();
    alertRows.forEach((row) => {
      if (row.fleet) unique.add(String(row.fleet));
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [alertRows]);

  const remarkOptions = useMemo(() => {
    const unique = new Set<string>();
    alertRows.forEach((row) => {
      if (row.remarks) unique.add(String(row.remarks));
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [alertRows]);

  const filteredAlerts = useMemo(() => {
    let filtered = alertRows;
    if (selectedAlertType !== 'all') {
      filtered = filtered.filter((row) => row.alertType === selectedAlertType);
    }
    if (selectedMonthYear !== 'all') {
      filtered = filtered.filter((row) => row.monthKey === selectedMonthYear);
    }
    if (selectedVehicle !== 'all') {
      filtered = filtered.filter((row) => row.vehicle === selectedVehicle);
    }
    if (selectedFleet !== 'all') {
      filtered = filtered.filter((row) => row.fleet === selectedFleet);
    }
    if (selectedRemark !== 'all') {
      filtered = filtered.filter((row) => row.remarks === selectedRemark);
    }
    return filtered;
  }, [alertRows, selectedAlertType, selectedMonthYear, selectedVehicle, selectedFleet, selectedRemark]);

  const sortedAlerts = useMemo(() => {
    return [...filteredAlerts].sort((a, b) => b.dateValue.getTime() - a.dateValue.getTime());
  }, [filteredAlerts]);

  const totalAlerts = filteredAlerts.length;
  const uniqueVehicles = new Set(filteredAlerts.map((row) => row.vehicle)).size;
  const topAlertType = useMemo(() => {
    const totals = new Map<string, number>();
    filteredAlerts.forEach((row) => {
      totals.set(row.alertType, (totals.get(row.alertType) ?? 0) + 1);
    });
    let winner = '—';
    let max = 0;
    totals.forEach((value, key) => {
      if (value > max) {
        max = value;
        winner = key;
      }
    });
    return winner;
  }, [filteredAlerts]);

  const monthlyRemarkHighlights = useMemo(() => {
    const totals = new Map<string, Map<string, number>>();
    alertRows.forEach((row) => {
      const remarkValue = normalizeRemarkKey(row.remarks);
      if (!TARGET_REMARKS.includes(remarkValue)) {
        return;
      }
      if (!row.monthKey) return;
      if (!totals.has(row.monthKey)) {
        totals.set(row.monthKey, new Map());
      }
      const monthTotals = totals.get(row.monthKey);
      if (!monthTotals) return;
      monthTotals.set(remarkValue, (monthTotals.get(remarkValue) ?? 0) + 1);
    });

    const months = Array.from(totals.keys()).sort((a, b) => b.localeCompare(a));
    const currentMonth =
      selectedMonthYear !== 'all' && months.includes(selectedMonthYear) ? selectedMonthYear : months[0] ?? null;
    const previousMonth = currentMonth ? months[months.indexOf(currentMonth) + 1] ?? null : null;

    return {
      currentMonth,
      previousMonth,
      rows: TARGET_REMARKS.map((remark) => {
        const current = currentMonth ? totals.get(currentMonth)?.get(remark) ?? 0 : 0;
        const previous = previousMonth ? totals.get(previousMonth)?.get(remark) ?? 0 : 0;
        return {
          remark,
          label: REMARK_LABELS[remark],
          current,
          previous,
          delta: current - previous,
        };
      }),
    };
  }, [alertRows, selectedMonthYear]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <p className="text-sm text-slate-300">Loading sheet data…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Filters</h2>
            <p className="text-sm text-slate-400">Narrow alerts by alert type, remark, month, fleet, or vehicle.</p>
            {lastUpdated ? (
              <p className="mt-1 text-xs text-slate-500">Last updated {lastUpdated.toLocaleString()}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={refresh}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-white hover:border-slate-500"
            >
              Refresh data
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-white hover:border-slate-500"
            >
              Reset filters
            </button>
          </div>
        </div>

        {error ? (
          <p className="mt-3 text-sm text-rose-300">{error}</p>
        ) : !vehicleColumn || !alertTypeColumn || !dateTimeColumn ? (
          <p className="mt-3 text-sm text-slate-400">
            Add columns labelled &quot;Vehicle No&quot;, &quot;Alert Type&quot;, and a date/time column to view alert trends.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-5">
            <label className="flex flex-col gap-2 text-xs text-slate-400">
              Alert type
              <select
                value={selectedAlertType}
                onChange={(event) => setSelectedAlertType(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              >
                <option value="all">All alert types</option>
                {alertTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-xs text-slate-400">
              Filter by month
              <select
                value={selectedMonthYear}
                onChange={(event) => setSelectedMonthYear(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              >
                <option value="all">All months</option>
                {monthYearOptions.map((option) => (
                  <option key={option} value={option}>
                    {formatMonthYearLabel(option)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-xs text-slate-400">
              Filter by fleet
              <select
                value={selectedFleet}
                onChange={(event) => setSelectedFleet(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              >
                <option value="all">All fleets</option>
                {fleetOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-xs text-slate-400">
              Filter by remark
              <select
                value={selectedRemark}
                onChange={(event) => setSelectedRemark(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              >
                <option value="all">All remarks</option>
                {remarkOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-xs text-slate-400">
              Filter by vehicle
              <select
                value={selectedVehicle}
                onChange={(event) => setSelectedVehicle(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              >
                <option value="all">All vehicles</option>
                {vehicleOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Total alerts</p>
          <p className="mt-2 text-3xl font-semibold text-white">{totalAlerts.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Active vehicles</p>
          <p className="mt-2 text-3xl font-semibold text-white">{uniqueVehicles.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Top alert type</p>
          <p className="mt-2 text-xl font-semibold text-white">{topAlertType}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Monthly remark highlights</h2>
          {monthlyRemarkHighlights.currentMonth ? (
            <p className="text-xs text-slate-400">
              {formatMonthYearLabel(monthlyRemarkHighlights.currentMonth)} vs{' '}
              {monthlyRemarkHighlights.previousMonth
                ? formatMonthYearLabel(monthlyRemarkHighlights.previousMonth)
                : 'previous month'}
            </p>
          ) : null}
        </div>
        {!monthlyRemarkHighlights.currentMonth ? (
          <p className="mt-3 text-sm text-slate-400">No monthly remark totals are available yet.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {monthlyRemarkHighlights.rows.map((row) => {
              const deltaColor = row.delta > 0 ? 'text-emerald-300' : row.delta < 0 ? 'text-rose-300' : 'text-slate-400';
              const deltaIcon = row.delta > 0 ? '▲' : row.delta < 0 ? '▼' : '→';
              return (
                <div key={row.remark} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-xs text-slate-400">{row.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{row.current.toLocaleString()}</p>
                  <p className={`mt-2 text-xs font-semibold ${deltaColor}`}>
                    {deltaIcon} {row.delta > 0 ? '+' : ''}{row.delta.toLocaleString()} from last month
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-lg font-semibold text-white">Recent alerts</h2>
        {sortedAlerts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No alerts match the selected filters.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-3 py-2">Alert time</th>
                  <th className="px-3 py-2">Vehicle</th>
                  <th className="px-3 py-2">Driver</th>
                  <th className="px-3 py-2">Alert type</th>
                  <th className="px-3 py-2 text-right">Speed</th>
                  <th className="px-3 py-2">Remarks</th>
                  <th className="px-3 py-2">Video</th>
                </tr>
              </thead>
              <tbody>
                {sortedAlerts.map((row) => (
                  <tr key={row.id} className="border-b border-slate-900/80 text-slate-200">
                    <td className="px-3 py-3 font-medium text-white">{row.dateTimeDisplay}</td>
                    <td className="px-3 py-3">{row.vehicle}</td>
                    <td className="px-3 py-3">{row.driver || '—'}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-full border border-indigo-400/60 px-2 py-1 text-xs text-indigo-200">
                        {row.alertType}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">{row.speed != null ? row.speed.toLocaleString() : '—'}</td>
                    <td className="px-3 py-3">{row.remarks || '—'}</td>
                    <td className="px-3 py-3">
                      {row.videoUrl ? (
                        <a
                          href={String(row.videoUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-200 hover:text-indigo-100"
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
        )}
      </div>
    </div>
  );
}

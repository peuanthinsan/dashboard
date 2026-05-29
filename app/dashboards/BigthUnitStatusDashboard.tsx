'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import LoadingState from './LoadingState';
import { findValue, normalizeLabel, parseDate } from './dashboardDataUtils';
import { type DashboardLang } from 'app/dashboard/i18n-copy';
import MultiSelect from 'app/ui/MultiSelect';

type DashboardProps = {
  dashboardId: string;
  dashboardName: string;
  sheetId: string;
  dashboardNotes?: string | null;
  lang?: DashboardLang;
  isAdmin?: boolean;
};

type SheetPayload = {
  rows: Record<string, unknown>[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
};

type UnitRow = {
  vehicleNo: string;
  dateTime: string;
  gpsStatus: string;
  statusAi: string;
  deviceStatus: string;
  fleet: string;
  damageStatus: string;
  reverseBsd: string;
  front: string;
  frontBsd: string;
  rearRight: string;
  rearLeft: string;
  leftBsd: string;
  rightBsd: string;
  cabin: string;
  storage: string;
  seatVibrator: string;
  intercom: string;
  ch1Ai: string;
};

type ChRow = {
  vehicleNo: string;
  fleet: string;
  expectedCameras: number;
};

const HEALTHY_WORDS = ['online', 'normal', 'ok', 'active', 'good', 'ready', 'work'];
const FAILURE_WORDS = ['offline', 'fail', 'error', 'damage', 'abnormal', 'lost', 'no signal', 'alert'];

function toText(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function isHealthyStatus(value: string): boolean {
  const normalized = normalizeLabel(value);
  if (!normalized) return false;
  if (FAILURE_WORDS.some((word) => normalized.includes(word))) return false;
  return HEALTHY_WORDS.some((word) => normalized.includes(word));
}

function countActiveCameraStreams(row: UnitRow): number {
  const fields = [
    row.ch1Ai,
    row.front,
    row.rearRight,
    row.rearLeft,
    row.cabin,
  ];
  return fields.reduce((total, field) => total + (isHealthyStatus(field) ? 1 : 0), 0);
}

function useTabSheet(sheetId: string, tabName: string): SheetPayload {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tabName)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Unable to fetch ${tabName}`);
      const text = await response.text();
      const match = text.match(/setResponse\(([\s\S]*)\);/);
      if (!match) throw new Error(`Unable to parse ${tabName}`);
      const parsed = JSON.parse(match[1]) as {
        table?: { cols?: Array<{ label?: string }>; rows?: Array<{ c?: Array<{ f?: unknown; v?: unknown } | null> }> };
      };
      const cols = (parsed.table?.cols ?? []).map((c, i) => toText(c?.label) || `Column ${i + 1}`);
      const mappedRows = (parsed.table?.rows ?? []).map((r) => {
        const record: Record<string, unknown> = {};
        (r.c ?? []).forEach((cell, i) => {
          record[cols[i] ?? `Column ${i + 1}`] = cell?.f ?? cell?.v ?? null;
        });
        return record;
      });
      setRows(mappedRows);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to fetch ${tabName}`);
    } finally {
      setLoading(false);
    }
  }, [sheetId, tabName]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { rows, loading, error, lastUpdated, refresh };
}

export default function BigthUnitStatusDashboard({
  dashboardId,
  dashboardName,
  sheetId,
  dashboardNotes,
  lang = 'en',
  isAdmin = false,
}: DashboardProps) {
  const unitSheet = useTabSheet(sheetId, 'Unitstatus');
  const chSheet = useTabSheet(sheetId, 'CH');
  const refreshUnitSheet = unitSheet.refresh;
  const refreshChSheet = chSheet.refresh;

  useEffect(() => {
    const id = window.setInterval(() => {
      refreshUnitSheet();
      refreshChSheet();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [refreshChSheet, refreshUnitSheet]);

  const [vehicleSearch, setVehicleSearch] = useState('');
  const [fleetFilters, setFleetFilters] = useState<string[]>([]);

  const unitRows = useMemo<UnitRow[]>(
    () =>
      unitSheet.rows.map((row) => ({
        vehicleNo: toText(findValue(row, ['Vehicle No'])),
        dateTime: toText(findValue(row, ['Date & time', 'Date & time 2'])),
        gpsStatus: toText(findValue(row, ['GPS Status'])),
        statusAi: toText(findValue(row, ['Status AI'])),
        deviceStatus: toText(findValue(row, ['Device Status'])),
        fleet: toText(findValue(row, ['Fleet'])),
        damageStatus: toText(findValue(row, ['Damage Status'])),
        reverseBsd: toText(findValue(row, ['Reverse BSD'])),
        front: toText(findValue(row, ['Front'])),
        frontBsd: toText(findValue(row, ['Front BSD'])),
        rearRight: toText(findValue(row, ['Rear Right'])),
        rearLeft: toText(findValue(row, ['Rear Left'])),
        leftBsd: toText(findValue(row, ['Left BSD'])),
        rightBsd: toText(findValue(row, ['Right BSD'])),
        cabin: toText(findValue(row, ['Cabin'])),
        storage: toText(findValue(row, ['Storage'])),
        seatVibrator: toText(findValue(row, ['Seat Vibrator'])),
        intercom: toText(findValue(row, ['Intercom'])),
        ch1Ai: toText(findValue(row, ['CH1 AI'])),
      })),
    [unitSheet.rows],
  );

  const chRows = useMemo<ChRow[]>(
    () =>
      chSheet.rows.map((row) => ({
        vehicleNo: toText(findValue(row, ['Vehicle No'])),
        fleet: toText(findValue(row, ['Fleet'])),
        expectedCameras: Number(findValue(row, ['CH']) ?? 0) || 0,
      })),
    [chSheet.rows],
  );

  const fleetOptions = useMemo(() => {
    const set = new Set<string>();
    unitRows.forEach((row) => {
      if (row.fleet) set.add(row.fleet);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [unitRows]);

  const filteredRows = useMemo(() => {
    const search = normalizeLabel(vehicleSearch);
    const fleetSet = new Set(fleetFilters.map(normalizeLabel));
    return unitRows.filter((row) => {
      if (search && !normalizeLabel(row.vehicleNo).includes(search)) return false;
      if (fleetSet.size > 0 && !fleetSet.has(normalizeLabel(row.fleet))) return false;
      return true;
    });
  }, [unitRows, vehicleSearch, fleetFilters]);

  const byVehicleCamera = useMemo(() => {
    const map = new Map<string, number>();
    chRows.forEach((row) => {
      if (row.vehicleNo) map.set(row.vehicleNo, row.expectedCameras);
    });
    return map;
  }, [chRows]);

  const gpsOnline = filteredRows.filter((row) => isHealthyStatus(row.gpsStatus)).length;
  const gpsOffline = filteredRows.length - gpsOnline;

  const damageCounts = useMemo(() => {
    const matrix = new Map<string, number>();
    const keys: Array<[string, (row: UnitRow) => string]> = [
      ['Status AI', (r) => r.statusAi],
      ['Device Status', (r) => r.deviceStatus],
      ['Reverse BSD', (r) => r.reverseBsd],
      ['Front Camera', (r) => r.front],
      ['Front BSD', (r) => r.frontBsd],
      ['Rear Right', (r) => r.rearRight],
      ['Rear Left', (r) => r.rearLeft],
      ['Left BSD', (r) => r.leftBsd],
      ['Right BSD', (r) => r.rightBsd],
      ['Cabin', (r) => r.cabin],
      ['Storage', (r) => r.storage],
      ['Seat Vibrator', (r) => r.seatVibrator],
      ['Intercom', (r) => r.intercom],
    ];
    filteredRows.forEach((row) => {
      keys.forEach(([name, getter]) => {
        const value = getter(row);
        if (!value || isHealthyStatus(value)) return;
        matrix.set(name, (matrix.get(name) ?? 0) + 1);
      });
    });
    return Array.from(matrix.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredRows]);

  const fleetInstallRows = useMemo(() => {
    const map = new Map<string, { vehicles: number; cameras: number }>();
    chRows.forEach((row) => {
      if (!row.fleet) return;
      const current = map.get(row.fleet) ?? { vehicles: 0, cameras: 0 };
      current.vehicles += 1;
      current.cameras += row.expectedCameras;
      map.set(row.fleet, current);
    });
    return Array.from(map.entries())
      .map(([fleet, v]) => ({ fleet, ...v }))
      .sort((a, b) => a.fleet.localeCompare(b.fleet));
  }, [chRows]);

  const totalInstall = fleetInstallRows.reduce(
    (acc, row) => ({ vehicles: acc.vehicles + row.vehicles, cameras: acc.cameras + row.cameras }),
    { vehicles: 0, cameras: 0 },
  );

  const loading = unitSheet.loading || chSheet.loading;
  const error = unitSheet.error || chSheet.error;
  const latestUpdated = [unitSheet.lastUpdated, chSheet.lastUpdated]
    .filter((v): v is Date => v instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  const statusBadge = (value: string) => {
    const healthy = isHealthyStatus(value);
    return (
      <span
        className={
          healthy
            ? 'inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700'
            : 'inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700'
        }
      >
        {healthy ? '✓' : value || '—'}
      </span>
    );
  };

  return (
    <DashboardShell
      title={dashboardName}
      subtitle={lang === 'th' ? 'สถานะอุปกรณ์ BIGTH' : 'BIGTH Unit Status'}
      lang={lang}
      lastUpdated={latestUpdated}
      notes={dashboardNotes}
      dashboardId={dashboardId}
      isAdmin={isAdmin}
      activeFilterCount={(vehicleSearch ? 1 : 0) + fleetFilters.length}
    >
      {loading || error ? (
        <LoadingState
          lang={lang}
          message={lang === 'th' ? 'กำลังโหลดสถานะหน่วย...' : 'Loading unit status...'}
          error={error ?? undefined}
          onRetry={() => {
            unitSheet.refresh();
            chSheet.refresh();
          }}
        />
      ) : (
        <div className="flex flex-col gap-6">
          <section className={`${dashboardSectionClass} grid gap-4 lg:grid-cols-3`}>
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <h3 className="text-sm font-semibold">GPS & Device Health</h3>
              <p className="mt-2 text-xs text-zinc-500">Grand Total: {filteredRows.length}</p>
              <div className="mt-3 space-y-3">
                <div>
                  <div className="mb-1 flex justify-between text-xs"><span>Online</span><span>{gpsOnline}</span></div>
                  <div className="h-2 rounded bg-zinc-200"><div className="h-2 rounded bg-emerald-500" style={{ width: `${filteredRows.length ? (gpsOnline / filteredRows.length) * 100 : 0}%` }} /></div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs"><span>Offline</span><span>{gpsOffline}</span></div>
                  <div className="h-2 rounded bg-zinc-200"><div className="h-2 rounded bg-red-500" style={{ width: `${filteredRows.length ? (gpsOffline / filteredRows.length) * 100 : 0}%` }} /></div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <h3 className="text-sm font-semibold">Damage Matrix Summary</h3>
              <div className="mt-3 space-y-2 text-sm">
                {damageCounts.length === 0 ? (
                  <p className="text-zinc-500">No data</p>
                ) : (
                  damageCounts.slice(0, 8).map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between rounded bg-zinc-50 px-2 py-1 dark:bg-zinc-900">
                      <span>{name}</span>
                      <span className="font-semibold text-red-600">{count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <h3 className="text-sm font-semibold">Fleet Installation Progress</h3>
              <table className="mt-3 w-full text-xs">
                <thead><tr className="text-left text-zinc-500"><th>Fleet</th><th>Units</th><th>Cameras</th></tr></thead>
                <tbody>
                  {fleetInstallRows.map((row) => (
                    <tr key={row.fleet} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td>{row.fleet}</td><td>{row.vehicles}</td><td>{row.cameras}</td>
                    </tr>
                  ))}
                  <tr className="border-t font-semibold"><td>Total</td><td>{totalInstall.vehicles}</td><td>{totalInstall.cameras}</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className={dashboardSectionClass}>
            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <input
                value={vehicleSearch}
                onChange={(e) => setVehicleSearch(e.target.value)}
                placeholder="Search Vehicle No"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm md:max-w-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <div className="md:min-w-[280px]">
                <MultiSelect
                  label="Fleet"
                  options={fleetOptions}
                  selected={fleetFilters}
                  onChange={setFleetFilters}
                  lang={lang}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1400px] text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-900">
                  <tr>
                    {['Vehicle No', 'Date & time', 'GPS Status', 'Status AI', 'Device Status', 'Reverse BSD', 'Front', 'Front BSD', 'Rear Right', 'Rear Left', 'Left BSD', 'Right BSD', 'Cabin', 'Storage', 'Seat Vibrator', 'Intercom', 'Fleet', 'Camera Setup'].map((h) => (
                      <th key={h} className="px-2 py-2 text-left font-semibold text-zinc-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const expected = byVehicleCamera.get(row.vehicleNo) ?? 0;
                    const active = countActiveCameraStreams(row);
                    const dt = parseDate(row.dateTime);
                    return (
                      <tr key={`${row.vehicleNo}-${row.dateTime}`} className="border-t border-zinc-100 dark:border-zinc-800">
                        <td className="px-2 py-2 font-semibold">{row.vehicleNo}</td>
                        <td className="px-2 py-2">{dt ? dt.toLocaleString('en-GB') : row.dateTime || '—'}</td>
                        <td className="px-2 py-2">{statusBadge(row.gpsStatus)}</td>
                        <td className="px-2 py-2">{statusBadge(row.statusAi)}</td>
                        <td className="px-2 py-2">{statusBadge(row.deviceStatus)}</td>
                        <td className="px-2 py-2">{statusBadge(row.reverseBsd)}</td>
                        <td className="px-2 py-2">{statusBadge(row.front)}</td>
                        <td className="px-2 py-2">{statusBadge(row.frontBsd)}</td>
                        <td className="px-2 py-2">{statusBadge(row.rearRight)}</td>
                        <td className="px-2 py-2">{statusBadge(row.rearLeft)}</td>
                        <td className="px-2 py-2">{statusBadge(row.leftBsd)}</td>
                        <td className="px-2 py-2">{statusBadge(row.rightBsd)}</td>
                        <td className="px-2 py-2">{statusBadge(row.cabin)}</td>
                        <td className="px-2 py-2">{statusBadge(row.storage)}</td>
                        <td className="px-2 py-2">{statusBadge(row.seatVibrator)}</td>
                        <td className="px-2 py-2">{statusBadge(row.intercom)}</td>
                        <td className="px-2 py-2">{row.fleet}</td>
                        <td className="px-2 py-2">
                          <span className={active >= expected && expected > 0 ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}>
                            {active}/{expected || 0}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </DashboardShell>
  );
}

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
  const [alertFilter, setAlertFilter] = useState('all');
  const [fleetFilter, setFleetFilter] = useState('all');

  const alertRows = useMemo<AlertRow[]>(() => {
    return rows.map((row, index) => {
      const timeValue = findValue(row, ['Alert Date Time', 'Track Time', 'Date']);
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

  const fleetOptions = useMemo(() => {
    const unique = new Set<string>();
    alertRows.forEach((row) => {
      if (row.fleet && row.fleet !== '—') unique.add(row.fleet);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [alertRows]);

  const filteredAlerts = useMemo(() => {
    return alertRows.filter((row) => {
      if (alertFilter !== 'all' && row.alertType !== alertFilter) return false;
      if (fleetFilter !== 'all' && row.fleet !== fleetFilter) return false;
      return true;
    });
  }, [alertFilter, alertRows, fleetFilter]);

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
            <section className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg md:flex-row md:items-end">
              <div className="flex flex-1 flex-col gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Alert type</label>
                <select
                  value={alertFilter}
                  onChange={(event) => setAlertFilter(event.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                >
                  <option value="all">All alert types</option>
                  {alertOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Fleet</label>
                <select
                  value={fleetFilter}
                  onChange={(event) => setFleetFilter(event.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                >
                  <option value="all">All fleets</option>
                  {fleetOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAlertFilter('all');
                  setFleetFilter('all');
                }}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-white hover:border-slate-500"
              >
                Reset filters
              </button>
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

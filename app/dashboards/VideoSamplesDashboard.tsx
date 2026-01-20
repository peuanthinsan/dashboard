'use client';

import { useMemo } from 'react';
import useGoogleSheet from './useGoogleSheet';

type DashboardProps = {
  dashboardName: string;
  sheetId: string;
  sheetGid: string;
};

type VideoSample = {
  id: string;
  vehicle: string;
  driver: string;
  remark: string;
  timeLabel: string;
  timeSort: number;
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

const parseDate = (value: unknown) => {
  if (!value) return null;
  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const toDateLabel = (value: unknown) => {
  if (!value) return '—';
  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
};

export default function VideoSamplesDashboard({ dashboardName, sheetId, sheetGid }: DashboardProps) {
  const { rows, loading, error, lastUpdated, refresh } = useGoogleSheet({ sheetId, gid: sheetGid });

  const samples = useMemo<VideoSample[]>(() => {
    return rows
      .map((row, index) => {
        const timeValue = findValue(row, ['Alert Date Time', 'Track Time', 'Date']);
        const parsedDate = parseDate(timeValue);
        return {
          id: `${index}-${findValue(row, ['Vehicle No', 'Vehicle No TH']) ?? 'vehicle'}`,
          vehicle: toDisplayString(findValue(row, ['Vehicle No', 'Vehicle No TH'])),
          driver: toDisplayString(findValue(row, ['Driver Name'])),
          remark: toDisplayString(findValue(row, ['Remarks', 'Remark'])),
          timeLabel: toDateLabel(timeValue),
          timeSort: parsedDate?.getTime() ?? 0,
          videoUrl: toDisplayString(findValue(row, ['videoURL', 'Video URL', 'Video Link', 'Video'])),
        };
      })
      .sort((a, b) => b.timeSort - a.timeSort);
  }, [rows]);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Video samples</p>
              <h1 className="text-3xl font-semibold">{dashboardName}</h1>
            </div>
            <button
              type="button"
              onClick={refresh}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-white hover:border-slate-500"
            >
              Refresh data
            </button>
          </div>
          {lastUpdated ? (
            <p className="text-xs text-slate-400">Last updated {lastUpdated.toLocaleString()}</p>
          ) : null}
        </header>

        {error ? (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
            Loading video samples…
          </div>
        ) : (
          <section className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-slate-950 via-slate-950/90 to-slate-900/80 p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">Latest alert samples</h2>
              <span className="text-xs uppercase tracking-[0.3em] text-slate-500">
                {samples.length.toLocaleString()} total
              </span>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {samples.map((sample) => (
                <div
                  key={sample.id}
                  className="rounded-2xl border border-slate-800/80 bg-slate-950/50 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.35)]"
                >
                  <div className="flex flex-col gap-3">
                    <div>
                      <p className="text-[0.65rem] uppercase tracking-[0.35em] text-slate-500">Vehicle</p>
                      <p className="text-lg font-semibold text-white">{sample.vehicle}</p>
                    </div>
                    <div>
                      <p className="text-[0.65rem] uppercase tracking-[0.35em] text-slate-500">Driver</p>
                      <p className="text-sm text-slate-100">{sample.driver}</p>
                    </div>
                    <div>
                      <p className="text-[0.65rem] uppercase tracking-[0.35em] text-slate-500">Remark</p>
                      <p className="text-sm text-slate-200">{sample.remark}</p>
                    </div>
                    <div>
                      <p className="text-[0.65rem] uppercase tracking-[0.35em] text-slate-500">Alert date time</p>
                      <p className="text-sm text-slate-200">{sample.timeLabel}</p>
                    </div>
                    <div>
                      {sample.videoUrl !== '—' ? (
                        <a
                          href={sample.videoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200"
                        >
                          View video
                          <span aria-hidden className="text-lg">
                            ↗
                          </span>
                        </a>
                      ) : (
                        <span className="text-sm text-slate-500">Video unavailable</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

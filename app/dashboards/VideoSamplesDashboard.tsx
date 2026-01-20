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
  alertTime: string;
  timestamp: number;
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
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toLocaleString();
};

export default function VideoSamplesDashboard({ dashboardName, sheetId, sheetGid }: DashboardProps) {
  const { rows, loading, error, lastUpdated, refresh } = useGoogleSheet({ sheetId, gid: sheetGid });

  const samples = useMemo<VideoSample[]>(() => {
    return rows
      .map((row, index) => {
        const alertDateValue = findValue(row, [
          'Alert Date Time',
          'Alert Date',
          'Track Time',
          'Date',
        ]);
        const parsed = parseDate(alertDateValue);
        const videoUrl = toDisplayString(
          findValue(row, ['Video URL', 'videoURL', 'Video Link', 'Video'])
        );
        return {
          id: `${index}-${findValue(row, ['Vehicle No', 'Vehicle']) ?? 'vehicle'}`,
          vehicle: toDisplayString(findValue(row, ['Vehicle No', 'Vehicle No TH', 'Vehicle'])),
          driver: toDisplayString(findValue(row, ['Driver Name', 'Driver'])),
          remark: toDisplayString(findValue(row, ['Remark', 'Remarks'])),
          alertTime: toDateLabel(alertDateValue),
          timestamp: parsed?.getTime() ?? 0,
          videoUrl,
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 9);
  }, [rows]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Video samples</p>
            <h1 className="text-2xl font-semibold md:text-3xl">{dashboardName}</h1>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/90 transition hover:border-white/40 hover:text-white"
          >
            Refresh data
          </button>
        </header>
        {lastUpdated ? (
          <p className="text-xs text-slate-400">Last updated {lastUpdated.toLocaleString()}</p>
        ) : null}

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
          <section className="rounded-3xl border border-slate-800/80 bg-gradient-to-br from-slate-950/90 via-slate-950/70 to-slate-900/70 p-6 shadow-2xl">
            <h2 className="text-lg font-medium">Latest alert samples</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {samples.map((sample) => {
                const hasVideo = sample.videoUrl !== '—' && sample.videoUrl !== '';
                return (
                  <article
                    key={sample.id}
                    className="flex h-full flex-col justify-between rounded-2xl border border-slate-800/80 bg-slate-950/50 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
                  >
                    <div className="space-y-3">
                      <div>
                        <p className="text-[0.6rem] uppercase tracking-[0.35em] text-slate-500">
                          Vehicle
                        </p>
                        <p className="text-lg font-semibold text-white">{sample.vehicle}</p>
                      </div>
                      <div>
                        <p className="text-[0.6rem] uppercase tracking-[0.35em] text-slate-500">
                          Driver
                        </p>
                        <p className="text-sm font-medium text-slate-100">{sample.driver}</p>
                      </div>
                      <div>
                        <p className="text-[0.6rem] uppercase tracking-[0.35em] text-slate-500">
                          Remark
                        </p>
                        <p className="text-sm text-slate-200">{sample.remark}</p>
                      </div>
                      <div>
                        <p className="text-[0.6rem] uppercase tracking-[0.35em] text-slate-500">
                          Alert date time
                        </p>
                        <p className="text-sm text-slate-200">{sample.alertTime}</p>
                      </div>
                    </div>
                    <div className="mt-5 flex items-center justify-between">
                      {hasVideo ? (
                        <a
                          href={sample.videoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-semibold text-sky-300 transition hover:text-sky-200"
                        >
                          View video →
                        </a>
                      ) : (
                        <span className="text-sm text-slate-500">Video unavailable</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

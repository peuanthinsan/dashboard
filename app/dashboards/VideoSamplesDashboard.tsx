'use client';

import { useMemo } from 'react';
import useGoogleSheet from './useGoogleSheet';

type DashboardProps = {
  dashboardName: string;
  sheetId: string;
  sheetGid: string;
};

type SampleRow = {
  id: string;
  vehicle: string;
  driver: string;
  alertType: string;
  remarks: string;
  time: string;
  parsedDate: Date | null;
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

const isValidVideoUrl = (value: string) => /^https?:\/\//i.test(value);

export default function VideoSamplesDashboard({ dashboardName, sheetId, sheetGid }: DashboardProps) {
  const { rows, loading, error, lastUpdated, refresh } = useGoogleSheet({ sheetId, gid: sheetGid });

  const samples = useMemo<SampleRow[]>(() => {
    return rows
      .map((row, index) => {
        const timeValue = findValue(row, ['Alert Date Time', 'Track Time', 'Date']);
        const parsedDate = parseDate(timeValue);
        return {
          id: `${index}-${findValue(row, ['Vehicle No']) ?? 'vehicle'}`,
          vehicle: toDisplayString(findValue(row, ['Vehicle No', 'Vehicle No TH'])),
          driver: toDisplayString(findValue(row, ['Driver Name'])),
          alertType: toDisplayString(findValue(row, ['Alert Type'])),
          remarks: toDisplayString(findValue(row, ['Remarks'])),
          time: toDateLabel(timeValue),
          parsedDate,
          videoUrl: toDisplayString(findValue(row, ['videoURL', 'Video URL', 'Video Link', 'Videoit', 'Video'])),
        };
      })
      .sort((a, b) => (b.parsedDate?.getTime() ?? 0) - (a.parsedDate?.getTime() ?? 0))
      .slice(0, 9);
  }, [rows]);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Video samples</p>
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
            Loading video samples…
          </div>
        ) : (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
            <h2 className="text-lg font-medium">Latest alert samples</h2>
            <p className="text-sm text-slate-400">Quick access to video links with the alert metadata.</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {samples.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-6 text-sm text-slate-400">
                  No alert samples found.
                </div>
              ) : (
                samples.map((sample) => (
                  <article
                    key={sample.id}
                    className="flex h-full flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-5 shadow-sm"
                  >
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Vehicle</p>
                        <p className="text-lg font-semibold text-white">{sample.vehicle}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Alert</p>
                        <p className="text-sm text-slate-200">{sample.alertType}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Driver</p>
                        <p className="text-sm text-slate-200">{sample.driver}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Remark</p>
                        <p className="text-sm text-slate-200">{sample.remarks}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Alert date time</p>
                        <p className="text-sm text-slate-200">{sample.time}</p>
                      </div>
                    </div>
                    <div className="mt-auto">
                      {isValidVideoUrl(sample.videoUrl) ? (
                        <a
                          href={sample.videoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:border-slate-500 hover:text-white"
                        >
                          View video
                        </a>
                      ) : (
                        <span className="text-xs uppercase tracking-[0.3em] text-slate-500">No video link</span>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

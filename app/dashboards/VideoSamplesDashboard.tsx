'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import useGoogleSheet from './useGoogleSheet';

type DashboardProps = {
  dashboardName: string;
  sheetId: string;
  sheetGid: string;
  organizationName?: string | null;
};

type VideoSample = {
  id: string;
  vehicle: string;
  driver: string;
  remarks: string;
  timeLabel: string;
  timestamp: number;
  videoUrl: string;
  fleet: string;
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

export default function VideoSamplesDashboard({
  dashboardName,
  sheetId,
  sheetGid,
  organizationName,
}: DashboardProps) {
  const { rows, loading, error, lastUpdated, refresh } = useGoogleSheet({ sheetId, gid: sheetGid });
  const normalizedOrganizationName = useMemo(
    () => (organizationName ? normalizeLabel(organizationName) : null),
    [organizationName],
  );

  const samples = useMemo<VideoSample[]>(() => {
    return rows
      .map((row, index) => {
        const timeValue = findValue(row, ['Alert Date Time', 'Track Time', 'Date']);
        const parsedDate = parseDate(timeValue);
        return {
          id: `${index}-${findValue(row, ['Vehicle No', 'Vehicle No TH']) ?? 'vehicle'}`,
          vehicle: toDisplayString(findValue(row, ['Vehicle No', 'Vehicle No TH'])),
          driver: toDisplayString(findValue(row, ['Driver Name'])),
          remarks: toDisplayString(findValue(row, ['Remarks', 'Remark'])),
          timeLabel: parsedDate?.toLocaleString() ?? toDisplayString(timeValue),
          timestamp: parsedDate?.getTime() ?? 0,
          videoUrl: toDisplayString(findValue(row, ['videoURL', 'Videoit', 'Video URL'])),
          fleet: toDisplayString(findValue(row, ['Fleet'])),
        };
      })
      .filter((row) => {
        if (!normalizedOrganizationName) return true;
        return normalizeLabel(row.fleet) === normalizedOrganizationName;
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 9);
  }, [normalizedOrganizationName, rows]);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-[1252px] flex-col gap-8">
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Link
                href="/dashboard"
                className="mb-2 inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"
              >
                <span aria-hidden="true">←</span>
                Back to dashboards
              </Link>
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
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
            Loading video samples…
          </div>
        ) : (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium">Latest alert samples</h2>
              <span className="text-sm text-slate-400">{samples.length} videos</span>
            </div>
            {samples.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">No video samples available yet.</p>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {samples.map((sample) => (
                  <article
                    key={sample.id}
                    className="flex h-full flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-5 shadow-[0_0_0_1px_rgba(148,163,184,0.05)]"
                  >
                    <div className="flex flex-col gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Vehicle</p>
                        <p className="text-lg font-semibold text-white">{sample.vehicle}</p>
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
                        <p className="text-sm text-slate-200">{sample.timeLabel}</p>
                      </div>
                    </div>
                    <div className="mt-auto flex flex-col gap-3">
                      {sample.videoUrl && sample.videoUrl !== '—' ? (
                        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
                          <video
                            controls
                            preload="metadata"
                            className="h-40 w-full bg-black/30"
                          >
                            <source src={sample.videoUrl} type="video/mp4" />
                            Your browser does not support the video tag.
                          </video>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">Video link unavailable</span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

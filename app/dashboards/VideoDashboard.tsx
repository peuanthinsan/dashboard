'use client';

import { useMemo } from 'react';
import useGoogleSheet from './useGoogleSheet';
import { formatDateTimeGB } from './dateFormat';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import LoadingState from './LoadingState';
import {
  findValue,
  hasRemark,
  normalizeLabel,
  parseDate,
  toDisplayString,
} from './dashboardDataUtils';

type DashboardProps = {
  dashboardId: string;
  dashboardName: string;
  sheetId: string;
  sheetGid: string;
  dashboardNotes?: string | null;
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

export default function VideoDashboard({
  dashboardName,
  sheetId,
  sheetGid,
  dashboardNotes,
  organizationName,
}: DashboardProps) {
  const { rows, loading, error, lastUpdated } = useGoogleSheet({ sheetId, gid: sheetGid });
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
          timeLabel: parsedDate ? formatDateTimeGB(parsedDate) : toDisplayString(timeValue),
          timestamp: parsedDate?.getTime() ?? 0,
          videoUrl: toDisplayString(findValue(row, ['videoURL', 'Videoit', 'Video URL'])),
          fleet: toDisplayString(findValue(row, ['Fleet'])),
        };
      })
      .filter((row) => {
        if (!hasRemark(row.remarks)) return false;
        if (!normalizedOrganizationName) return true;
        return normalizeLabel(row.fleet) === normalizedOrganizationName;
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 9);
  }, [normalizedOrganizationName, rows]);

  return (
    <DashboardShell
      title={dashboardName}
      subtitle="Video"
      lastUpdated={lastUpdated}
      notes={dashboardNotes}
    >
      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <LoadingState message="Loading videos…" detail="Preparing the latest video alerts." />
      ) : (
        <section className={dashboardSectionClass}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold bg-gradient-to-r from-fuchsia-500 via-indigo-500 to-cyan-500 bg-clip-text text-transparent">Latest alert samples</h2>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {samples.length} videos
            </span>
          </div>
          {samples.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No videos available yet.</p>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {samples.map((sample) => (
                <article
                  key={sample.id}
                  className="flex h-full flex-col gap-4 rounded-2xl border border-cyan-300/60 bg-gradient-to-br from-fuchsia-100/80 via-white to-cyan-100/80 p-5 shadow-[0_18px_40px_-26px_rgba(6,182,212,0.8)] dark:border-cyan-500/40 dark:bg-gradient-to-br dark:from-slate-900/80 dark:via-fuchsia-950/30 dark:to-cyan-950/30"
                >
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-500">
                        Vehicle
                      </p>
                      <p className="text-lg font-semibold text-slate-900 dark:text-white">
                        {sample.vehicle}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-500">
                        Driver
                      </p>
                      <p className="text-sm text-slate-700 dark:text-slate-200">{sample.driver}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-500">
                        Remark
                      </p>
                      <p className="text-sm text-slate-700 dark:text-slate-200">{sample.remarks}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-500">
                        Alert date time
                      </p>
                      <p className="text-sm text-slate-700 dark:text-slate-200">
                        {sample.timeLabel}
                      </p>
                    </div>
                  </div>
                  <div className="mt-auto flex flex-col gap-3">
                    {sample.videoUrl && sample.videoUrl !== '—' ? (
                      <div className="overflow-hidden rounded-xl border border-fuchsia-300/60 bg-gradient-to-br from-white/90 to-fuchsia-100/70 dark:border-fuchsia-500/40 dark:bg-gradient-to-br dark:from-slate-900/80 dark:to-indigo-950/50">
                        <video controls preload="metadata" className="h-40 w-full bg-black/30">
                          <source src={sample.videoUrl} type="video/mp4" />
                          Your browser does not support the video tag.
                        </video>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-500 dark:text-slate-500">
                        Video link unavailable
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </DashboardShell>
  );
}

'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import useGoogleSheet from './useGoogleSheet';
import { formatDateTimeGB } from './dateFormat';

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

export default function VideoSamplesDashboard({
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
    <div className="min-h-screen bg-[var(--app-bg)] px-4 py-8 text-[var(--app-text)] sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-[1252px] flex-col gap-8">
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Link
                href="/dashboard"
                className="mb-2 inline-flex w-fit items-center gap-2 text-sm text-[var(--app-text-muted)] transition hover:text-[var(--app-text)]"
              >
                <span aria-hidden="true">←</span>
                Back to dashboards
              </Link>
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--app-text-subtle)]">Video samples</p>
              <h1 className="text-2xl font-semibold sm:text-3xl">{dashboardName}</h1>
            </div>
          </div>
          {lastUpdated ? (
            <p className="text-xs text-[var(--app-text-subtle)]">Last updated {formatDateTimeGB(lastUpdated)}</p>
          ) : null}
          {dashboardNotes ? (
            <div className="mt-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm text-[var(--app-text-muted)]">
              {dashboardNotes}
            </div>
          ) : null}
        </header>

        {error ? (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-[var(--app-text-muted)]">
            Loading video samples…
          </div>
        ) : (
          <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4 shadow-lg sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium">Latest alert samples</h2>
              <span className="text-sm text-[var(--app-text-subtle)]">{samples.length} videos</span>
            </div>
            {samples.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--app-text-subtle)]">No video samples available yet.</p>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {samples.map((sample) => (
                  <article
                    key={sample.id}
                    className="flex h-full flex-col gap-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-5 shadow-[0_0_0_1px_rgba(148,163,184,0.05)]"
                  >
                    <div className="flex flex-col gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-[var(--app-text-faint)]">Vehicle</p>
                        <p className="text-lg font-semibold text-[var(--app-text)]">{sample.vehicle}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-[var(--app-text-faint)]">Driver</p>
                        <p className="text-sm text-[var(--app-text-muted)]">{sample.driver}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-[var(--app-text-faint)]">Remark</p>
                        <p className="text-sm text-[var(--app-text-muted)]">{sample.remarks}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-[var(--app-text-faint)]">Alert date time</p>
                        <p className="text-sm text-[var(--app-text-muted)]">{sample.timeLabel}</p>
                      </div>
                    </div>
                    <div className="mt-auto flex flex-col gap-3">
                      {sample.videoUrl && sample.videoUrl !== '—' ? (
                        <div className="overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)]">
                          <video
                            controls
                            preload="metadata"
                            className="h-40 w-full bg-[var(--app-surface-subtle)]"
                          >
                            <source src={sample.videoUrl} type="video/mp4" />
                            Your browser does not support the video tag.
                          </video>
                        </div>
                      ) : (
                        <span className="text-sm text-[var(--app-text-faint)]">Video link unavailable</span>
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

'use client';

import { useMemo } from 'react';
import useGoogleSheet from './useGoogleSheet';
import { formatDateTimeGB } from './dateFormat';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import LoadingState from './LoadingState';
import { getDashboardCopy, type DashboardLang } from 'app/dashboard/i18n-copy';
import {
  findValue,
  hasRemark,
  isExcludedAlertRemark,
  normalizeLabel,
  parseDate,
  toDisplayString,
} from './dashboardDataUtils';
import KpiCard from 'app/ui/KpiCard';
import EmptyState from 'app/ui/EmptyState';
import { heading2, textSecondary, badgeDanger } from 'app/ui/design-tokens';

type DashboardProps = {
  dashboardId: string;
  dashboardName: string;
  sheetId: string;
  sheetGid: string;
  dashboardNotes?: string | null;
  organizationName?: string | null;
  lang?: DashboardLang;
  allowedAlertTypes?: string[] | null;
  allowedRemarks?: string[] | null;
  isAdmin?: boolean;
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
  dashboardId,
  dashboardName,
  sheetId,
  sheetGid,
  dashboardNotes,
  organizationName,
  lang = 'en',
  isAdmin = false,
}: DashboardProps) {
  const copy = getDashboardCopy(lang);
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
        if (!hasRemark(row.remarks) || isExcludedAlertRemark(row.remarks)) return false;
        if (!normalizedOrganizationName) return true;
        return normalizeLabel(row.fleet) === normalizedOrganizationName;
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 12);
  }, [normalizedOrganizationName, rows]);

  const uniqueVehicles = useMemo(() => new Set(samples.map((s) => s.vehicle)).size, [samples]);
  const uniqueDrivers = useMemo(() => new Set(samples.map((s) => s.driver)).size, [samples]);

  return (
    <DashboardShell
      title={dashboardName}
      subtitle={lang === 'th' ? 'แดชบอร์ดวิดีโอ' : 'Video dashboard'}
      lang={lang}
      lastUpdated={lastUpdated}
      notes={dashboardNotes}
      dashboardId={dashboardId}
      isAdmin={isAdmin}
    >
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {loading ? (
        <LoadingState
          message={lang === 'th' ? 'กำลังโหลดวิดีโอ…' : 'Loading videos…'}
          detail={lang === 'th' ? 'กำลังเตรียมการแจ้งเตือนวิดีโอล่าสุด' : 'Preparing the latest video alerts.'}
          fallbackDetail={copy.loadingDetail}
        />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard label={lang === 'th' ? 'วิดีโอทั้งหมด' : 'Total Videos'} value={samples.length} />
            <KpiCard label={lang === 'th' ? 'ยานพาหนะ' : 'Vehicles'} value={uniqueVehicles} />
            <KpiCard label={lang === 'th' ? 'คนขับ' : 'Drivers'} value={uniqueDrivers} />
          </div>

          <section className={dashboardSectionClass}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className={heading2}>{lang === 'th' ? 'ตัวอย่างการแจ้งเตือนล่าสุด' : 'Latest alert samples'}</h2>
                <p className={textSecondary}>
                  {samples.length} {lang === 'th' ? 'วิดีโอ' : 'videos'}
                </p>
              </div>
            </div>
            {samples.length === 0 ? (
              <EmptyState title={lang === 'th' ? 'ยังไม่มีวิดีโอ' : 'No videos available yet.'} />
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {samples.map((sample) => (
                  <article
                    key={sample.id}
                    className="flex h-full flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    {sample.videoUrl && sample.videoUrl !== '—' ? (
                      <div className="overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                        <video controls preload="metadata" className="h-40 w-full bg-black/30">
                          <source src={sample.videoUrl} type="video/mp4" />
                        </video>
                      </div>
                    ) : (
                      <div className="flex h-40 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                        <span className="text-xs text-zinc-400">{lang === 'th' ? 'ไม่มีวิดีโอ' : 'No video'}</span>
                      </div>
                    )}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{sample.vehicle}</p>
                        <span className={badgeDanger}>{sample.remarks}</span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{sample.driver}</p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500">{sample.timeLabel}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </DashboardShell>
  );
}

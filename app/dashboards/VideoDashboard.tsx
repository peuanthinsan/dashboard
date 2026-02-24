'use client';

import { useMemo } from 'react';
import { t, type DashboardLang } from 'app/dashboard/i18n';
import useGoogleSheet from './useGoogleSheet';
import { formatDateTimeGB } from './dateFormat';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import LoadingState from './LoadingState';
import { findValue, hasRemark, normalizeLabel, parseDate, toDisplayString } from './dashboardDataUtils';

type DashboardProps = {
  dashboardId: string;
  dashboardName: string;
  sheetId: string;
  sheetGid: string;
  dashboardNotes?: string | null;
  organizationName?: string | null;
  lang?: DashboardLang;
  dashboardPath?: string;
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

export default function VideoDashboard({ dashboardName, sheetId, sheetGid, dashboardNotes, organizationName, lang = 'th', dashboardPath }: DashboardProps) {
  const { rows, loading, error, lastUpdated } = useGoogleSheet({ sheetId, gid: sheetGid });
  const normalizedOrganizationName = useMemo(() => (organizationName ? normalizeLabel(organizationName) : null), [organizationName]);

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
    <DashboardShell title={dashboardName} subtitle={t(lang, 'Video', 'วิดีโอ')} lastUpdated={lastUpdated} notes={dashboardNotes} lang={lang} dashboardPath={dashboardPath}>
      {error ? <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}

      {loading ? (
        <LoadingState lang={lang} message={t(lang, 'Loading videos…', 'กำลังโหลดวิดีโอ…')} detail={t(lang, 'Preparing the latest video alerts.', 'กำลังเตรียมรายการแจ้งเตือนวิดีโอล่าสุด')} />
      ) : (
        <section className={dashboardSectionClass}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-medium">{t(lang, 'Latest alert samples', 'ตัวอย่างการแจ้งเตือนล่าสุด')}</h2>
            <span className="text-sm text-slate-500 dark:text-slate-400">{samples.length} {t(lang, 'videos', 'วิดีโอ')}</span>
          </div>
          {samples.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{t(lang, 'No videos available yet.', 'ยังไม่มีวิดีโอ')}</p>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {samples.map((sample) => (
                <article key={sample.id} className="flex h-full flex-col gap-4 rounded-2xl border border-fuchsia-200 bg-fuchsia-50/70 p-5 shadow-[0_0_0_1px_rgba(148,163,184,0.05)] dark:border-fuchsia-900 dark:bg-slate-950/40">
                  <div className="flex flex-col gap-4">
                    <div><p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-500">{t(lang, 'Vehicle', 'รถ')}</p><p className="text-lg font-semibold text-slate-900 dark:text-white">{sample.vehicle}</p></div>
                    <div><p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-500">{t(lang, 'Driver', 'คนขับ')}</p><p className="text-sm text-slate-700 dark:text-slate-200">{sample.driver}</p></div>
                    <div><p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-500">{t(lang, 'Remark', 'หมายเหตุ')}</p><p className="text-sm text-slate-700 dark:text-slate-200">{sample.remarks}</p></div>
                    <div><p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-500">{t(lang, 'Alert date time', 'วันเวลาแจ้งเตือน')}</p><p className="text-sm text-slate-700 dark:text-slate-200">{sample.timeLabel}</p></div>
                  </div>
                  <div className="mt-auto flex flex-col gap-3">
                    {sample.videoUrl && sample.videoUrl !== '—' ? (
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white/70 dark:border-slate-800 dark:bg-slate-900/40">
                        <video controls preload="metadata" className="h-40 w-full bg-black/30">
                          <source src={sample.videoUrl} type="video/mp4" />
                          {t(lang, 'Your browser does not support the video tag.', 'เบราว์เซอร์ของคุณไม่รองรับวิดีโอ')}
                        </video>
                      </div>
                    ) : (<span className="text-sm text-slate-500 dark:text-slate-500">{t(lang, 'Video link unavailable', 'ไม่มีลิงก์วิดีโอ')}</span>)}
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

import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatDateTimeGB } from './dateFormat';
import { getDashboardCopy, type DashboardLang } from 'app/dashboard/i18n-copy';
import SongdeeLogo from 'app/ui/SongdeeLogo';
import PrintButton from 'app/ui/PrintButton';
import {
  pageContent,
  heading1,
  textSecondary,
  cardSection,
  badgeWarning,
  badgeDefault,
} from 'app/ui/design-tokens';

type DashboardShellProps = {
  title: string;
  subtitle: string;
  lang?: DashboardLang;
  lastUpdated?: Date | null;
  notes?: string | null;
  actions?: ReactNode;
  children: ReactNode;
  isStale?: boolean;
  activeFilterCount?: number;
  /** When set, shows an admin "Edit" button linking to the admin dashboard page. */
  dashboardId?: string | null;
  isAdmin?: boolean;
  /** Optional human-readable applied criteria for exports and operational review. */
  filterSummary?: ReactNode;
};

export const dashboardSectionClass = cardSection;

export default function DashboardShell({
  title,
  subtitle,
  lang = 'en',
  lastUpdated,
  notes,
  actions,
  children,
  isStale = false,
  activeFilterCount = 0,
  dashboardId,
  isAdmin = false,
  filterSummary,
}: DashboardShellProps) {
  const copy = getDashboardCopy(lang);
  const auditCopy =
    lang === 'th'
      ? {
          activeView: 'มุมมองปัจจุบัน',
          allData: 'ข้อมูลทั้งหมด',
          auditReady: 'พร้อมตรวจสอบ',
          checked: 'ตรวจสอบล่าสุด',
          dataSource: 'แหล่งข้อมูล',
          filtered: 'กรองแล้ว',
          freshness: 'ความสดใหม่',
          googleSheets: 'Google Sheets',
          sourceUnknown: 'รอข้อมูล',
          synced: 'ซิงก์แล้ว',
        }
      : {
          activeView: 'Current view',
          allData: 'All data',
          auditReady: 'Audit ready',
          checked: 'Last checked',
          dataSource: 'Data source',
          filtered: 'Filtered',
          freshness: 'Freshness',
          googleSheets: 'Google Sheets',
          sourceUnknown: 'Awaiting data',
          synced: 'Synced',
        };
  const freshnessLabel = isStale
    ? copy.staleData
    : lastUpdated
      ? auditCopy.synced
      : auditCopy.sourceUnknown;

  return (
    <div>
      <div className={pageContent}>
        <div className="flex min-w-0 flex-col gap-6">
          <header className="relative overflow-hidden rounded-2xl border border-zinc-200/70 bg-white/[0.92] shadow-card-raised backdrop-blur-xl dark:border-zinc-800/70 dark:bg-zinc-900/[0.92]">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-zinc-950 via-red-600 to-red-500 dark:from-zinc-100 dark:via-red-500 dark:to-red-700" />
            <div className="pointer-events-none absolute inset-0 brand-pattern opacity-20 dark:opacity-10" />
            <div className="pointer-events-none absolute -right-20 -top-28 h-64 w-64 rounded-full bg-red-500/8 blur-3xl dark:bg-red-500/10" aria-hidden="true" />
            <div className="relative p-4 pt-5 sm:p-6 sm:pt-7">
              <nav aria-label={lang === 'th' ? 'เส้นทางนำทาง' : 'Breadcrumb'} className="mb-5 flex items-center gap-2 text-xs font-medium text-zinc-400">
                <Link href="/dashboard" data-print-hide className="transition-colors hover:text-red-600 dark:hover:text-red-400">
                  {copy.backToDashboards}
                </Link>
                <svg aria-hidden="true" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                </svg>
                <span className="truncate text-zinc-600 dark:text-zinc-300" aria-current="page">{subtitle}</span>
              </nav>

              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex min-h-6 items-center gap-1.5 rounded-full bg-zinc-950 px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white dark:bg-white dark:text-zinc-950">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden="true" />
                      {subtitle}
                    </span>
                    <span className={isStale ? badgeWarning : badgeDefault}>
                      {freshnessLabel}
                    </span>
                  </div>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="hidden rounded-xl border border-zinc-200/80 bg-white p-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 sm:block">
                      <SongdeeLogo height={22} />
                    </span>
                    <h1 className={`min-w-0 break-words ${heading1}`}>{title}</h1>
                  </div>
                  {notes ? <p className={`mt-3 max-w-3xl ${textSecondary}`}>{notes}</p> : null}
                </div>

                <div className="flex w-full min-w-0 flex-wrap items-stretch gap-2 lg:w-auto lg:justify-end" data-print-hide>
                  {actions}
                  {isAdmin && dashboardId ? (
                    <Link
                      href={`/admin/dashboards?highlight=${encodeURIComponent(dashboardId)}`}
                      className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition-all hover:-translate-y-px hover:border-zinc-300 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-600 sm:flex-none"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      {lang === 'th' ? 'แก้ไขแหล่งข้อมูล' : 'Edit source'}
                    </Link>
                  ) : null}
                  <PrintButton label={lang === 'th' ? 'พิมพ์ / PDF' : 'Print / PDF'} />
                </div>
              </div>

              <div className="mt-6 grid overflow-hidden rounded-xl border border-zinc-200/70 bg-zinc-50/[0.85] sm:grid-cols-3 dark:border-zinc-800/80 dark:bg-zinc-950/45">
                <div className="flex items-center gap-3 border-b border-zinc-200/60 px-3 py-3 sm:border-b-0 sm:border-r dark:border-zinc-800/70">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${isStale ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'}`}>
                    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.9">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l4 4L19 6" />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{auditCopy.freshness}</p>
                    <p className="truncate text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                      {lastUpdated ? `${auditCopy.checked} ${formatDateTimeGB(lastUpdated)}` : freshnessLabel}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 border-b border-zinc-200/60 px-3 py-3 sm:border-b-0 sm:border-r dark:border-zinc-800/70">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                      <ellipse cx="12" cy="5" rx="7" ry="3" />
                      <path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{auditCopy.dataSource}</p>
                    <p className="truncate text-xs font-semibold text-zinc-700 dark:text-zinc-200">{auditCopy.googleSheets}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-3 py-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16M7 12h10m-7 7h4" />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{auditCopy.activeView}</p>
                    <p className="truncate text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                      {activeFilterCount > 0 ? `${activeFilterCount} ${copy.filtersActive}` : auditCopy.allData}
                    </p>
                  </div>
                </div>
              </div>
              {filterSummary ? (
                <div className="mt-3 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-200">{auditCopy.auditReady}: </span>
                  {filterSummary}
                </div>
              ) : null}
            </div>
          </header>

          {children}

          <footer className="flex items-center justify-center gap-2 py-4">
            <div className="h-px w-8 bg-gradient-to-r from-transparent to-red-300/30 dark:to-red-700/20" />
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-300 dark:text-zinc-600">
              Powered by Songdee<span className="text-zinc-400 dark:text-zinc-500">GPS</span>
            </span>
            <div className="h-px w-8 bg-gradient-to-l from-transparent to-red-300/30 dark:to-red-700/20" />
          </footer>
        </div>
      </div>
    </div>
  );
}

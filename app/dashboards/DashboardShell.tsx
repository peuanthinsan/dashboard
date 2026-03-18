import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatDateTimeGB } from './dateFormat';
import { getDashboardCopy, type DashboardLang } from 'app/dashboard/i18n-copy';
import SongdeeLogo from 'app/ui/SongdeeLogo';
import PrintButton from 'app/ui/PrintButton';
import {
  pageContainer,
  pageContent,
  heading1,
  textSecondary,
  textMuted,
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
}: DashboardShellProps) {
  const copy = getDashboardCopy(lang);

  return (
    <div className={pageContainer}>
      <div className={pageContent}>
        <div className="flex flex-col gap-5">
          {/* ── Header with SongdeeGPS branding ── */}
          <header className="relative overflow-hidden rounded-xl border border-zinc-200/60 bg-white/80 shadow-card backdrop-blur-sm dark:border-zinc-800/60 dark:bg-zinc-900/80">
            {/* Red accent bar — matches logo */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-600 via-red-500 to-red-600" />
            {/* Subtle brand pattern */}
            <div className="pointer-events-none absolute inset-0 brand-pattern opacity-30" />
            <div className="relative p-5 pt-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <Link
                    href="/dashboard"
                    data-print-hide
                    className="mb-3 inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors duration-200 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    {copy.backToDashboards}
                  </Link>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-400 dark:text-zinc-500">
                    {subtitle}
                  </p>
                  <div className="flex items-center gap-3">
                    <SongdeeLogo height={24} className="hidden sm:block" />
                    <h1 className={heading1}>{title}</h1>
                  </div>
                  {lastUpdated ? (
                    <p className={`mt-1 ${textMuted}`}>
                      {copy.lastUpdated} {formatDateTimeGB(lastUpdated)}
                    </p>
                  ) : null}
                  {notes ? <p className={`mt-2 ${textSecondary}`}>{notes}</p> : null}

                  {(isStale || activeFilterCount > 0) ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {isStale ? (
                        <span className={badgeWarning}>
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                          </svg>
                          {copy.staleData}
                        </span>
                      ) : null}
                      {activeFilterCount > 0 ? (
                        <span className={badgeDefault}>
                          {activeFilterCount} {copy.filtersActive}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-start gap-2" data-print-hide>
                  {actions}
                  <PrintButton label={lang === 'th' ? 'พิมพ์ / PDF' : 'Print / PDF'} />
                </div>
              </div>
            </div>
          </header>

          {children}

          {/* ── SongdeeGPS branded footer ── */}
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

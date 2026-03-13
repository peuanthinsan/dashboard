import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatDateTimeGB } from './dateFormat';
import { getDashboardCopy, type DashboardLang } from 'app/dashboard/i18n-copy';
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
            {/* Thai-inspired gradient bar — red + gold trim */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-600 via-amber-500 to-red-600" />
            <div className="p-5 pt-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <Link
                    href="/dashboard"
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
                  <h1 className={heading1}>{title}</h1>
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
                {actions ? <div className="flex items-start gap-2">{actions}</div> : null}
              </div>
            </div>
          </header>

          {children}
        </div>
      </div>
    </div>
  );
}

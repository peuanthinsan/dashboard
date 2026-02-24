import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatDateTimeGB } from './dateFormat';
import { getDashboardCopy, type DashboardLang } from 'app/dashboard/i18n-copy';

type DashboardShellProps = {
  title: string;
  subtitle: string;
  lang?: DashboardLang;
  lastUpdated?: Date | null;
  notes?: string | null;
  actions?: ReactNode;
  children: ReactNode;
};

export const dashboardSectionClass =
  'rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/70';

export default function DashboardShell({
  title,
  subtitle,
  lang = 'en',
  lastUpdated,
  notes,
  actions,
  children,
}: DashboardShellProps) {
  const copy = getDashboardCopy(lang);
  const panelClass =
    'rounded-3xl border border-cyan-200/70 bg-white/80 p-6 shadow-xl backdrop-blur dark:border-indigo-800/70 dark:bg-slate-900/70';

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-fuchsia-100 px-4 py-8 text-slate-900 dark:from-slate-950 dark:via-indigo-950 dark:to-slate-900 dark:text-white sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-[1252px] flex-col gap-8">
        <header className={`flex flex-wrap items-start justify-between gap-4 ${panelClass}`}>
          <div>
            <Link
              href="/dashboard"
              className="mb-2 inline-flex w-fit items-center gap-2 text-sm text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              <span aria-hidden="true">←</span>
              {copy.backToDashboards}
            </Link>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">{subtitle}</p>
            <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
            {lastUpdated ? (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {copy.lastUpdated} {formatDateTimeGB(lastUpdated)}
              </p>
            ) : null}
            {notes ? (
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{notes}</p>
            ) : null}
          </div>
          {actions ? <div className="flex items-start gap-3">{actions}</div> : null}
        </header>

        {children}
      </div>
    </div>
  );
}

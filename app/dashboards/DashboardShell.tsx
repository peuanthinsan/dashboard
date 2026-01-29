import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatDateTimeGB } from './dateFormat';

type DashboardShellProps = {
  title: string;
  subtitle: string;
  lastUpdated?: Date | null;
  notes?: string | null;
  actions?: ReactNode;
  children: ReactNode;
};

export const dashboardSectionClass =
  'rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/70';
const dashboardBadgeClass =
  'inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 dark:bg-slate-800/80 dark:text-slate-300';

export default function DashboardShell({
  title,
  subtitle,
  lastUpdated,
  notes,
  actions,
  children,
}: DashboardShellProps) {
  const panelClass =
    'rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/70';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 px-4 py-8 text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-white sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-[1252px] flex-col gap-8">
        <header className={`flex flex-wrap items-start justify-between gap-4 ${panelClass}`}>
          <div>
            <Link
              href="/dashboard"
              className="mb-2 inline-flex w-fit items-center gap-2 text-sm text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              <span aria-hidden="true">←</span>
              Back to dashboards
            </Link>
            <div className={dashboardBadgeClass}>
              <span className="h-2 w-2 rounded-full bg-emerald-400 dark:bg-emerald-300" />
              {subtitle}
            </div>
            <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
            {lastUpdated ? (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Last updated {formatDateTimeGB(lastUpdated)}
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

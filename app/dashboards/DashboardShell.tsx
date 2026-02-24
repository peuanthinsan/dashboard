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
  'rounded-3xl border border-fuchsia-300/60 bg-gradient-to-br from-cyan-100/80 via-white to-fuchsia-100/80 p-6 shadow-[0_20px_60px_-25px_rgba(14,116,144,0.65)] backdrop-blur dark:border-fuchsia-500/40 dark:bg-gradient-to-br dark:from-slate-900/90 dark:via-fuchsia-950/40 dark:to-cyan-950/40';

export default function DashboardShell({
  title,
  subtitle,
  lastUpdated,
  notes,
  actions,
  children,
}: DashboardShellProps) {
  const panelClass =
    'rounded-3xl border border-cyan-300/60 bg-gradient-to-r from-fuchsia-100/80 via-white to-cyan-100/80 p-6 shadow-[0_20px_60px_-25px_rgba(168,85,247,0.7)] backdrop-blur dark:border-cyan-500/40 dark:bg-gradient-to-r dark:from-slate-900/90 dark:via-fuchsia-950/45 dark:to-cyan-950/45';

  return (
    <div className="min-h-screen bg-gradient-to-br from-fuchsia-100 via-sky-50 to-emerald-100 px-4 py-8 text-slate-900 dark:from-slate-950 dark:via-indigo-950 dark:to-cyan-950 dark:text-white sm:px-6 sm:py-10">
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
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">{subtitle}</p>
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

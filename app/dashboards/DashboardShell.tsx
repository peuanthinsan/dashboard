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
  'rounded-3xl border border-fuchsia-300/50 bg-gradient-to-br from-white/95 via-fuchsia-50/80 to-cyan-50/70 p-6 shadow-[0_25px_65px_-35px_rgba(217,70,239,0.75)] backdrop-blur dark:border-fuchsia-400/40 dark:bg-gradient-to-br dark:from-slate-900/90 dark:via-fuchsia-950/35 dark:to-cyan-950/30';

export default function DashboardShell({
  title,
  subtitle,
  lastUpdated,
  notes,
  actions,
  children,
}: DashboardShellProps) {
  const panelClass =
    'rounded-3xl border border-fuchsia-300/50 bg-gradient-to-br from-white/95 via-fuchsia-50/80 to-cyan-50/70 p-6 shadow-[0_25px_65px_-35px_rgba(217,70,239,0.75)] backdrop-blur dark:border-fuchsia-400/40 dark:bg-gradient-to-br dark:from-slate-900/90 dark:via-fuchsia-950/35 dark:to-cyan-950/30';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(236,72,153,0.2),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(34,211,238,0.2),_transparent_40%),linear-gradient(to_bottom,_#fdf4ff,_#f0f9ff_55%,_#eef2ff)] px-4 py-8 text-slate-900 dark:bg-[radial-gradient(circle_at_top_left,_rgba(217,70,239,0.24),_transparent_50%),radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.2),_transparent_45%),linear-gradient(to_bottom,_#020617,_#111827)] dark:text-white sm:px-6 sm:py-10">
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

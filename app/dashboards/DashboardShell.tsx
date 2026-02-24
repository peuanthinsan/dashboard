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
  'rounded-3xl border border-fuchsia-300/60 bg-gradient-to-br from-rose-100/90 via-fuchsia-100/85 to-cyan-100/85 p-6 shadow-[0_20px_60px_-28px_rgba(217,70,239,0.65)] backdrop-blur dark:border-fuchsia-400/40 dark:from-fuchsia-950/70 dark:via-indigo-950/75 dark:to-cyan-950/60';

export default function DashboardShell({
  title,
  subtitle,
  lastUpdated,
  notes,
  actions,
  children,
}: DashboardShellProps) {
  const panelClass =
    'rounded-3xl border border-violet-300/60 bg-gradient-to-r from-violet-100/95 via-pink-100/85 to-sky-100/90 p-6 shadow-[0_20px_60px_-30px_rgba(124,58,237,0.7)] backdrop-blur dark:border-violet-400/40 dark:from-violet-950/70 dark:via-fuchsia-950/70 dark:to-sky-950/60';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(244,114,182,0.3),_transparent_42%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.28),_transparent_42%),linear-gradient(to_bottom,_#fdf4ff,_#fff1f2_40%,_#ecfeff)] px-4 py-8 text-slate-900 dark:bg-[radial-gradient(circle_at_top_left,_rgba(217,70,239,0.22),_transparent_44%),radial-gradient(circle_at_top_right,_rgba(45,212,191,0.15),_transparent_46%),linear-gradient(to_bottom,_#020617,_#0f172a_40%,_#111827)] dark:text-white sm:px-6 sm:py-10">
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

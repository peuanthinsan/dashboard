import Link from 'next/link';
import type { ReactNode } from 'react';
import T from 'app/i18n/T';
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
  'rounded-3xl border border-fuchsia-200/60 bg-gradient-to-br from-white via-fuchsia-50 to-sky-50 p-6 shadow-xl backdrop-blur dark:border-fuchsia-900/60 dark:from-slate-900/80 dark:via-fuchsia-950/30 dark:to-sky-950/30';

export default function DashboardShell({
  title,
  subtitle,
  lastUpdated,
  notes,
  actions,
  children,
}: DashboardShellProps) {
  const panelClass =
    'rounded-3xl border border-fuchsia-200/60 bg-gradient-to-r from-white via-indigo-50/70 to-fuchsia-50/70 p-6 shadow-xl backdrop-blur dark:border-fuchsia-900/60 dark:from-slate-900/80 dark:via-indigo-950/30 dark:to-fuchsia-950/30';

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 via-white to-fuchsia-100 px-4 py-8 text-slate-900 dark:from-slate-950 dark:via-indigo-950 dark:to-slate-900 dark:text-white sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-[1252px] flex-col gap-8">
        <header className={`flex flex-wrap items-start justify-between gap-4 ${panelClass}`}>
          <div>
            <Link
              href="/dashboard"
              className="mb-2 inline-flex w-fit items-center gap-2 text-sm text-indigo-600 transition hover:text-fuchsia-700 dark:text-indigo-300 dark:hover:text-fuchsia-200"
            >
              <span aria-hidden="true">←</span>
              <T k="backToDashboards" />
            </Link>
            <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-500 dark:text-fuchsia-300">{subtitle}</p>
            <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
            {lastUpdated ? (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                <T k="lastUpdated" /> {formatDateTimeGB(lastUpdated)}
              </p>
            ) : null}
            {notes ? (
              <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">{notes}</p>
            ) : null}
          </div>
          {actions ? <div className="flex items-start gap-3">{actions}</div> : null}
        </header>

        {children}
      </div>
    </div>
  );
}

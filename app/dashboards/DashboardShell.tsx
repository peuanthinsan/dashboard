'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useLanguage } from 'app/i18n';
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
  'rounded-3xl border border-fuchsia-200/70 bg-white/85 p-6 shadow-xl backdrop-blur dark:border-indigo-800/70 dark:bg-slate-900/70';

export default function DashboardShell({
  title,
  subtitle,
  lastUpdated,
  notes,
  actions,
  children,
}: DashboardShellProps) {
  const panelClass =
    'rounded-3xl border border-fuchsia-200/70 bg-white/85 p-6 shadow-xl backdrop-blur dark:border-indigo-800/70 dark:bg-slate-900/70';
  const { language } = useLanguage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-fuchsia-100 via-cyan-50 to-amber-100 px-4 py-8 text-slate-900 dark:from-slate-950 dark:via-indigo-950 dark:to-slate-900 dark:text-white sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-[1252px] flex-col gap-8">
        <header className={`flex flex-wrap items-start justify-between gap-4 ${panelClass}`}>
          <div>
            <Link href="/dashboard" className="mb-2 inline-flex w-fit items-center gap-2 text-sm text-slate-600 transition hover:text-fuchsia-700 dark:text-slate-300 dark:hover:text-white">
              <span aria-hidden="true">←</span>
              {language === 'th' ? 'กลับไปยังแดชบอร์ด' : 'Back to dashboards'}
            </Link>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">{subtitle}</p>
            <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
            {lastUpdated ? (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {language === 'th' ? 'อัปเดตล่าสุด' : 'Last updated'} {formatDateTimeGB(lastUpdated)}
              </p>
            ) : null}
            {notes ? <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{notes}</p> : null}
          </div>
          {actions ? <div className="flex items-start gap-3">{actions}</div> : null}
        </header>

        {children}
      </div>
    </div>
  );
}

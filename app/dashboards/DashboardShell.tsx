'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatDateTimeGB } from './dateFormat';
import { DashboardLanguageProvider, tr, useDashboardLanguage } from './i18n';

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

export default function DashboardShell(props: DashboardShellProps) {
  return (
    <DashboardLanguageProvider>
      <DashboardShellInner {...props} />
    </DashboardLanguageProvider>
  );
}

function DashboardShellInner({
  title,
  subtitle,
  lastUpdated,
  notes,
  actions,
  children,
}: DashboardShellProps) {
  const { language, setLanguage } = useDashboardLanguage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-fuchsia-100 via-cyan-50 to-amber-100 px-4 py-8 text-slate-900 dark:from-slate-950 dark:via-indigo-950 dark:to-slate-900 dark:text-white sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-[1252px] flex-col gap-8">
        <header className={`flex flex-wrap items-start justify-between gap-4 ${dashboardSectionClass}`}>
          <div>
            <Link
              href="/dashboard"
              className="mb-2 inline-flex w-fit items-center gap-2 text-sm text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              <span aria-hidden="true">←</span>
              {tr(language, 'Back to dashboards', 'กลับไปหน้าแดชบอร์ด')}
            </Link>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">{subtitle}</p>
            <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
            {lastUpdated ? (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {tr(language, 'Last updated', 'อัปเดตล่าสุด')} {formatDateTimeGB(lastUpdated)}
              </p>
            ) : null}
            {notes ? <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{notes}</p> : null}
          </div>
          <div className="flex items-start gap-3">
            {actions}
            <button
              type="button"
              className="rounded-full border border-fuchsia-300 bg-fuchsia-50 px-3 py-1 text-xs font-semibold text-fuchsia-700 hover:bg-fuchsia-100 dark:border-fuchsia-500/40 dark:bg-fuchsia-500/10 dark:text-fuchsia-200"
              onClick={() => setLanguage(language === 'th' ? 'en' : 'th')}
            >
              {language === 'th' ? 'EN' : 'TH'}
            </button>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}

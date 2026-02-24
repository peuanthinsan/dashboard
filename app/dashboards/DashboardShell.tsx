import Link from 'next/link';
import type { ReactNode } from 'react';
import { resolveDashboardLang, t, type DashboardLang, withDashboardLang } from 'app/dashboard/i18n';
import { formatDateTimeGB } from './dateFormat';

type DashboardShellProps = {
  title: string;
  subtitle: string;
  lang?: DashboardLang;
  dashboardPath?: string;
  lastUpdated?: Date | null;
  notes?: string | null;
  actions?: ReactNode;
  children: ReactNode;
};

export const dashboardSectionClass =
  'rounded-3xl border border-fuchsia-200/70 bg-white/85 p-6 shadow-xl shadow-fuchsia-300/20 backdrop-blur dark:border-fuchsia-900/70 dark:bg-slate-900/70';

export default function DashboardShell({
  title,
  subtitle,
  lang: rawLang,
  dashboardPath,
  lastUpdated,
  notes,
  actions,
  children,
}: DashboardShellProps) {
  const lang = resolveDashboardLang(rawLang);
  const panelClass =
    'rounded-3xl border border-indigo-200/70 bg-white/85 p-6 shadow-xl shadow-cyan-200/20 backdrop-blur dark:border-indigo-900/70 dark:bg-slate-900/70';

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-fuchsia-50 to-cyan-100 px-4 py-8 text-slate-900 dark:from-slate-950 dark:via-indigo-950 dark:to-slate-900 dark:text-white sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-[1252px] flex-col gap-8">
        <header className={`flex flex-wrap items-start justify-between gap-4 ${panelClass}`}>
          <div>
            <Link
              href={withDashboardLang('/dashboard', lang)}
              className="mb-2 inline-flex w-fit items-center gap-2 text-sm text-slate-600 transition hover:text-fuchsia-600 dark:text-slate-300 dark:hover:text-fuchsia-300"
            >
              <span aria-hidden="true">←</span>
              {t(lang, 'Back to dashboards', 'กลับไปหน้ารวมแดชบอร์ด')}
            </Link>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">{subtitle}</p>
            <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
            {lastUpdated ? (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t(lang, 'Last updated', 'อัปเดตล่าสุด')} {formatDateTimeGB(lastUpdated)}
              </p>
            ) : null}
            {notes ? (
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{notes}</p>
            ) : null}
          </div>
          <div className="flex items-start gap-3">
            {dashboardPath ? (
              <div className="inline-flex rounded-full border border-fuchsia-300/80 bg-fuchsia-100/70 p-1 text-xs dark:border-fuchsia-800 dark:bg-fuchsia-950/40">
                <Link
                  href={withDashboardLang(dashboardPath, 'th')}
                  className={`rounded-full px-3 py-1 ${lang === 'th' ? 'bg-fuchsia-500 text-white' : 'text-fuchsia-700 dark:text-fuchsia-200'}`}
                >
                  ไทย
                </Link>
                <Link
                  href={withDashboardLang(dashboardPath, 'en')}
                  className={`rounded-full px-3 py-1 ${lang === 'en' ? 'bg-fuchsia-500 text-white' : 'text-fuchsia-700 dark:text-fuchsia-200'}`}
                >
                  EN
                </Link>
              </div>
            ) : null}
            {actions ? <div className="flex items-start gap-3">{actions}</div> : null}
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}

import type { ReactNode } from 'react';
import Link from 'next/link';
import AdminNav from './AdminNav';
import { pageContainer, pageContent, textSecondary } from 'app/ui/design-tokens';
import type { DashboardLang } from 'app/dashboard/i18n-copy';

type AdminShellProps = {
  backHref: string;
  backLabel: string;
  eyebrow: string;
  title: string;
  description: string;
  workflowHint?: string;
  lang: DashboardLang;
  children: ReactNode;
};

export default function AdminShell({
  backHref,
  backLabel,
  eyebrow,
  title,
  description,
  workflowHint,
  lang,
  children,
}: AdminShellProps) {
  return (
    <div className={`${pageContainer} px-4 py-6 text-zinc-900 dark:text-white sm:px-6 sm:py-8`}>
      <div className={pageContent}>
        <div className="flex flex-col gap-6">
          <header
            className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            role="banner"
          >
            <div className="flex flex-col gap-3 border-b border-zinc-100 pb-3 dark:border-zinc-800">
              <Link
                href={backHref}
                className="inline-flex w-fit shrink-0 items-center gap-1.5 text-xs font-medium text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                {backLabel}
              </Link>
              <div className="min-w-0 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  {eyebrow}
                </p>
                <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h1>
                <p className={`max-w-2xl leading-relaxed ${textSecondary}`}>{description}</p>
                {workflowHint ? (
                  <p className="max-w-2xl text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{workflowHint}</p>
                ) : null}
              </div>
            </div>
            <div className="pt-3">
              <AdminNav lang={lang} />
            </div>
          </header>

          {children}
        </div>
      </div>
    </div>
  );
}

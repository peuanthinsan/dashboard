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
    <div className={`${pageContainer} text-zinc-900 dark:text-white`}>
      <div className={pageContent}>
        <div className="flex flex-col gap-6 lg:gap-7">
          <header
            className="relative overflow-hidden rounded-2xl border border-zinc-200/70 bg-white/[0.92] shadow-card-raised backdrop-blur-xl dark:border-zinc-800/70 dark:bg-zinc-900/[0.92]"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-zinc-950 via-red-600 to-red-500 dark:from-white dark:via-red-500 dark:to-red-700" />
            <div className="pointer-events-none absolute inset-0 brand-pattern opacity-20 dark:opacity-10" />
            <div className="relative p-4 pt-5 sm:p-6 sm:pt-7">
              <nav aria-label={lang === 'th' ? 'เส้นทางนำทาง' : 'Breadcrumb'} className="mb-5 flex min-w-0 items-center gap-2 text-xs font-medium text-zinc-400">
                <Link href={backHref} className="shrink-0 transition hover:text-red-600 dark:hover:text-red-400">
                  {backLabel}
                </Link>
                <svg aria-hidden="true" className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                </svg>
                <span className="truncate text-zinc-600 dark:text-zinc-300" aria-current="page">{title}</span>
              </nav>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <span className="inline-flex min-h-6 items-center gap-1.5 rounded-full bg-zinc-950 px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white dark:bg-white dark:text-zinc-950">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden="true" />
                    {eyebrow}
                  </span>
                  <h1 className="text-2xl font-bold tracking-[-0.025em] text-zinc-950 sm:text-3xl dark:text-white">{title}</h1>
                  <p className={`max-w-3xl ${textSecondary}`}>{description}</p>
                </div>
                {workflowHint ? (
                  <div className="flex max-w-md items-start gap-2.5 rounded-xl border border-amber-200/70 bg-amber-50/80 px-3.5 py-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200">
                    <svg aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l9 16H3L12 3zm0 6v4m0 3h.01" />
                    </svg>
                    <p>{workflowHint}</p>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="relative border-t border-zinc-200/60 bg-zinc-50/65 px-3 py-3 dark:border-zinc-800/70 dark:bg-zinc-950/30 sm:px-5">
              <AdminNav lang={lang} />
            </div>
          </header>

          {children}
        </div>
      </div>
    </div>
  );
}

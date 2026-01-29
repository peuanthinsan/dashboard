import type { ReactNode } from 'react';
import Link from 'next/link';
import AdminNav from './AdminNav';

type AdminShellProps = {
  backHref: string;
  backLabel: string;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export default function AdminShell({
  backHref,
  backLabel,
  eyebrow,
  title,
  description,
  children,
}: AdminShellProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 px-4 py-8 text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-white sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-[1252px] flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/70">
          <Link
            href={backHref}
            className="inline-flex w-fit items-center gap-2 text-sm text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          >
            <span aria-hidden="true">←</span>
            {backLabel}
          </Link>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              {eyebrow}
            </p>
            <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p>
          </div>
          <AdminNav />
        </header>

        {children}
      </div>
    </div>
  );
}

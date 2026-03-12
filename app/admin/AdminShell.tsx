import type { ReactNode } from 'react';
import Link from 'next/link';
import AdminNav from './AdminNav';
import { pageContainer, pageContent, heading1, textSecondary } from 'app/ui/design-tokens';

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
    <div className={`${pageContainer} px-4 py-8 text-zinc-900 dark:text-white sm:px-6 sm:py-10`}>
      <div className={pageContent}>
        <div className="flex flex-col gap-8">
          <header className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900" role="banner">
            <Link
              href={backHref}
              className="inline-flex w-fit items-center gap-2 text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              {backLabel}
            </Link>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                {eyebrow}
              </p>
              <h1 className={heading1}>{title}</h1>
              <p className={textSecondary}>{description}</p>
            </div>
            <AdminNav />
          </header>

          {children}
        </div>
      </div>
    </div>
  );
}

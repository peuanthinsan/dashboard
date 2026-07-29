'use client';

import { type ReactNode, useId } from 'react';

type FilterBarProps = {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  activeCount?: number;
  actions?: ReactNode;
};

export default function FilterBar({
  children,
  className = '',
  title,
  description,
  activeCount = 0,
  actions,
}: FilterBarProps) {
  const titleId = useId();

  return (
    <section
      data-print-hide
      aria-labelledby={titleId}
      className={[
        'relative z-20 max-w-full min-w-0 overflow-visible rounded-2xl border border-zinc-200/70 bg-white/90 p-2 shadow-card backdrop-blur-xl',
        'dark:border-zinc-800/70 dark:bg-zinc-900/90',
        'animate-fade-in',
        className,
      ].join(' ')}
    >
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" aria-hidden="true" />
      <div className="flex flex-wrap items-center justify-between gap-3 px-2.5 pb-2 pt-1.5 sm:px-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-white shadow-sm dark:bg-white dark:text-zinc-950">
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.9">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16M7 12h10m-7 7h4" />
            </svg>
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id={titleId} className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {title ?? (
                  <>
                    <span className="lang-en">Filters</span>
                    <span className="lang-th">ตัวกรอง</span>
                  </>
                )}
              </h2>
              {activeCount > 0 ? (
                <span className="inline-flex min-h-5 items-center rounded-full bg-red-50 px-2 text-[10px] font-bold text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-800">
                  {activeCount}{' '}
                  <span className="lang-en">active</span>
                  <span className="lang-th">ใช้งานอยู่</span>
                </span>
              ) : null}
            </div>
            <p className="hidden truncate text-xs text-zinc-400 sm:block dark:text-zinc-500">
              {description ?? (
                <>
                  <span className="lang-en">Refine the view — results update instantly.</span>
                  <span className="lang-th">ปรับมุมมอง — ผลลัพธ์จะอัปเดตทันที</span>
                </>
              )}
            </p>
          </div>
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      <div className="flex min-w-0 flex-wrap items-start gap-2 rounded-xl border border-zinc-200/60 bg-zinc-50/[0.85] p-2.5 dark:border-zinc-800/80 dark:bg-zinc-950/45 sm:p-3">
        {children}
      </div>
    </section>
  );
}

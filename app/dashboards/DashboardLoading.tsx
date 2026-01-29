'use client';

import React from 'react';

const skeletonBlockClass =
  'h-16 rounded-lg border border-slate-200/70 bg-white/80 shadow-sm shadow-slate-200/40 ring-1 ring-slate-200/50 dark:border-slate-800/70 dark:bg-slate-900/50 dark:shadow-none dark:ring-slate-800/60';

type DashboardLoadingProps = {
  title: string;
  description: string;
};

export function DashboardLoading({ title, description }: DashboardLoadingProps) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/85 p-6 shadow-sm shadow-slate-200/40 dark:border-slate-800/80 dark:bg-slate-900/60 dark:shadow-none">
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-indigo-200/80 bg-indigo-50 text-indigo-500 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200">
          <svg
            className="h-5 w-5 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">{title}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className={skeletonBlockClass}>
          <div className="h-full w-full animate-pulse rounded-lg bg-slate-100/80 dark:bg-slate-800/50" />
        </div>
        <div className={skeletonBlockClass}>
          <div className="h-full w-full animate-pulse rounded-lg bg-slate-100/80 dark:bg-slate-800/50" />
        </div>
        <div className={skeletonBlockClass}>
          <div className="h-full w-full animate-pulse rounded-lg bg-slate-100/80 dark:bg-slate-800/50" />
        </div>
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {title}
      </span>
    </div>
  );
}

'use client';

import { type ReactNode } from 'react';

type FilterBarProps = {
  children: ReactNode;
  className?: string;
};

export default function FilterBar({ children, className = '' }: FilterBarProps) {
  return (
    <div
      data-print-hide
      className={[
        'relative z-20 max-w-full min-w-0 overflow-visible flex flex-wrap items-start gap-3 rounded-xl border border-zinc-200/60 bg-white/60 px-3 py-3 shadow-card backdrop-blur-sm sm:px-4',
        'dark:border-zinc-800/60 dark:bg-zinc-900/60',
        'animate-fade-in',
        className,
      ].join(' ')}
    >
      {/* Red accent top line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-red-400/20 to-transparent" aria-hidden="true" />
      {children}
    </div>
  );
}

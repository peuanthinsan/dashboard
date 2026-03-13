'use client';

import { type ReactNode } from 'react';

type FilterBarProps = {
  children: ReactNode;
  className?: string;
};

export default function FilterBar({ children, className = '' }: FilterBarProps) {
  return (
    <div
      className={[
        'relative overflow-hidden flex flex-wrap items-start gap-3 rounded-xl border border-zinc-200/60 bg-white/60 px-4 py-3 shadow-card backdrop-blur-sm',
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

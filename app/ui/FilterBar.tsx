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
        'flex flex-wrap items-start gap-3 rounded-xl border border-zinc-200/60 bg-white/60 px-4 py-3 shadow-card backdrop-blur-sm',
        'dark:border-zinc-800/60 dark:bg-zinc-900/60',
        'animate-fade-in',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}

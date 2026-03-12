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
        'flex flex-wrap items-start gap-3 rounded-lg border border-zinc-200/80 bg-zinc-50/80 px-4 py-3',
        'dark:border-zinc-700/60 dark:bg-zinc-900/50',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}

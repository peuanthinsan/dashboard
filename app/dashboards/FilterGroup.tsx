import type { ReactNode } from 'react';

type FilterGroupProps = {
  label: string;
  children: ReactNode;
  onClear?: () => void;
  count?: number;
  helper?: ReactNode;
};

export default function FilterGroup({ label, children, onClear, count, helper }: FilterGroupProps) {
  const showCount = typeof count === 'number' && count > 0;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-950/40 px-4 py-3 sm:flex-row sm:items-center">
      <span className="uppercase tracking-[0.2em] text-slate-500">{label}</span>
      <div className="flex w-full flex-1 flex-wrap items-center gap-2">{children}</div>
      {helper || showCount || onClear ? (
        <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end">
          {helper ? <span className="text-slate-500">{helper}</span> : null}
          {showCount ? <span className="text-slate-500">{count} selected</span> : null}
          {onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="w-full rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs text-slate-700 dark:text-slate-200 hover:border-slate-500 sm:w-auto"
            >
              Clear
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

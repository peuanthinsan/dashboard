import type { ReactNode } from 'react';
import T from 'app/i18n/T';

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
    <div className="flex flex-col gap-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-gradient-to-r from-indigo-50/70 to-fuchsia-50/70 dark:from-indigo-950/30 dark:to-fuchsia-950/20 px-4 py-3 sm:flex-row sm:items-center">
      <span className="uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300">{label}</span>
      <div className="flex w-full flex-1 flex-wrap items-center gap-2">{children}</div>
      {helper || showCount || onClear ? (
        <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end">
          {helper ? <span className="text-slate-500">{helper}</span> : null}
          {showCount ? <span className="text-slate-500">{count} <T k="selected" /></span> : null}
          {onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="w-full rounded-md border border-indigo-200 dark:border-indigo-700 px-3 py-1 text-xs text-indigo-700 dark:text-indigo-200 hover:border-fuchsia-400 sm:w-auto"
            >
              <T k="clear" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

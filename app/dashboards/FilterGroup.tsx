'use client';

import type { ReactNode } from 'react';
import { useLanguage } from 'app/i18n';

type FilterGroupProps = {
  label: string;
  children: ReactNode;
  onClear?: () => void;
  count?: number;
  helper?: ReactNode;
};

export default function FilterGroup({ label, children, onClear, count, helper }: FilterGroupProps) {
  const showCount = typeof count === 'number' && count > 0;
  const { language } = useLanguage();

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-fuchsia-200 dark:border-indigo-800 bg-gradient-to-r from-fuchsia-50 to-cyan-50 dark:from-slate-950/60 dark:to-indigo-950/50 px-4 py-3 sm:flex-row sm:items-center">
      <span className="uppercase tracking-[0.2em] text-slate-500">{label}</span>
      <div className="flex w-full flex-1 flex-wrap items-center gap-2">{children}</div>
      {helper || showCount || onClear ? (
        <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end">
          {helper ? <span className="text-slate-500">{helper}</span> : null}
          {showCount ? <span className="text-slate-500">{count} {language === 'th' ? 'รายการที่เลือก' : 'selected'}</span> : null}
          {onClear ? (
            <button type="button" onClick={onClear} className="w-full rounded-md border border-fuchsia-200 dark:border-slate-700 px-3 py-1 text-xs text-fuchsia-700 dark:text-slate-200 hover:border-fuchsia-400 sm:w-auto">
              {language === 'th' ? 'ล้างค่า' : 'Clear'}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

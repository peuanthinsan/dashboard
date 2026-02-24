import type { ReactNode } from 'react';
import { t, type DashboardLang } from 'app/dashboard/i18n';

type FilterGroupProps = {
  label: string;
  lang?: DashboardLang;
  children: ReactNode;
  onClear?: () => void;
  count?: number;
  helper?: ReactNode;
};

export default function FilterGroup({ label, lang = 'th', children, onClear, count, helper }: FilterGroupProps) {
  const showCount = typeof count === 'number' && count > 0;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-fuchsia-200 dark:border-fuchsia-900 bg-gradient-to-r from-fuchsia-100/70 to-cyan-100/70 dark:from-slate-950/60 dark:to-indigo-950/40 px-4 py-3 sm:flex-row sm:items-center">
      <span className="uppercase tracking-[0.2em] text-slate-600 dark:text-slate-300">{label}</span>
      <div className="flex w-full flex-1 flex-wrap items-center gap-2">{children}</div>
      {helper || showCount || onClear ? (
        <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end">
          {helper ? <span className="text-slate-500">{helper}</span> : null}
          {showCount ? <span className="text-slate-500">{count} {t(lang, 'selected', 'ที่เลือก')}</span> : null}
          {onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="w-full rounded-md border border-fuchsia-200 dark:border-fuchsia-700 px-3 py-1 text-xs text-fuchsia-700 dark:text-fuchsia-200 hover:border-fuchsia-500 sm:w-auto"
            >
              {t(lang, 'Clear', 'ล้าง')}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

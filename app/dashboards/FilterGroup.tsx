import type { ReactNode } from 'react';
import { getDashboardCopy, type DashboardLang } from 'app/dashboard/i18n-copy';
import { surfaceInset, textMuted, btnGhost, btnSmall } from 'app/ui/design-tokens';

type FilterGroupProps = {
  label: string;
  children: ReactNode;
  onClear?: () => void;
  count?: number;
  helper?: ReactNode;
  lang?: DashboardLang;
};

export default function FilterGroup({ label, children, onClear, count, helper, lang = 'en' }: FilterGroupProps) {
  const copy = getDashboardCopy(lang);
  const showCount = typeof count === 'number' && count > 0;

  return (
    <div
      role="group"
      aria-label={label}
      className={`${surfaceInset} flex min-w-0 flex-1 flex-col gap-2 rounded-xl px-3 py-2.5 sm:flex-row sm:items-center`}
    >
      <span className="inline-flex shrink-0 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden="true" />
        {label}
      </span>
      <div className="flex w-full min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
      {helper || showCount || onClear ? (
        <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end">
          {helper ? <span className={textMuted}>{helper}</span> : null}
          {showCount ? (
            <span className={textMuted}>
              {count} {copy.selected}
            </span>
          ) : null}
          {onClear ? (
            <button
              type="button"
              onClick={onClear}
              className={`w-full sm:w-auto ${btnGhost} ${btnSmall} text-zinc-500`}
            >
              <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M5.1 15a8 8 0 0013.2 2M18.9 9A8 8 0 005.7 7" />
              </svg>
              {copy.clear}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

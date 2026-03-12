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
      className={`${surfaceInset} flex flex-col gap-3 rounded-lg px-4 py-3 sm:flex-row sm:items-center`}
    >
      <span className="text-xs font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <div className="flex w-full flex-1 flex-wrap items-center gap-2">{children}</div>
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
              className={`w-full sm:w-auto ${btnGhost} ${btnSmall}`}
            >
              {copy.clear}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

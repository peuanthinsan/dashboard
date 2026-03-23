'use client';

import { useMemo, useState } from 'react';

type InlineDayPickerProps = {
  monthKey: string;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multi?: boolean;
  lang?: string;
  className?: string;
};

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export default function InlineDayPicker({
  monthKey,
  value,
  onChange,
  multi = false,
  lang = 'en',
  className = '',
}: InlineDayPickerProps) {
  const values = useMemo(() => {
    if (!value) return [] as string[];
    return Array.isArray(value) ? value : [value];
  }, [value]);

  const { year, month, daysInMonth, monthLabel } = useMemo(() => {
    if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
      return { year: 0, month: 0, daysInMonth: 0, monthLabel: '' };
    }
    const [yStr, mStr] = monthKey.split('-');
    const year = parseInt(yStr!, 10);
    const month = parseInt(mStr!, 10);
    if (isNaN(year) || isNaN(month)) {
      return { year: 0, month: 0, daysInMonth: 0, monthLabel: '' };
    }
    const daysInMonth = getDaysInMonth(year, month);
    const monthLabel = new Date(year, month - 1, 1).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', {
      month: 'short',
      year: 'numeric',
    });
    return { year, month, daysInMonth, monthLabel };
  }, [monthKey, lang]);

  const [showAllDays, setShowAllDays] = useState(false);

  const isSelected = (day: number) => {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return values.includes(key);
  };

  const handleClick = (day: number) => {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (multi) {
      const next = values.includes(key)
        ? values.filter((v) => v !== key)
        : [...values, key].sort();
      onChange(next);
    } else {
      onChange(values.includes(key) ? '' : key);
    }
  };

  const handleClear = () => onChange(multi ? [] : '');
  const hasSelection = values.length > 0;

  if (!monthKey || daysInMonth === 0) {
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-lg border border-zinc-200/60 bg-zinc-50/80 px-3 py-2 text-xs text-zinc-400 dark:border-zinc-700/60 dark:bg-zinc-900/40 dark:text-zinc-500 ${className}`}
      >
        {lang === 'th' ? 'เลือกเดือนก่อน' : 'Select month first'}
      </div>
    );
  }

  const displayDays = showAllDays ? daysInMonth : Math.min(14, daysInMonth);
  const hasMore = daysInMonth > 14;

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-1 rounded-lg border border-zinc-200/60 bg-white/80 px-1.5 py-[5px] shadow-card backdrop-blur-sm dark:border-zinc-700/60 dark:bg-zinc-900/80 ${className}`}
    >
      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 min-w-[4rem]">
        {monthLabel}
      </span>
      <span className="text-zinc-200 dark:text-zinc-700">|</span>
      {Array.from({ length: displayDays }, (_, i) => i + 1).map((day) => (
        <button
          key={day}
          type="button"
          onClick={() => handleClick(day)}
          className={[
            'min-w-[22px] rounded-md px-1 py-0.5 text-xs font-medium transition-all duration-150',
            isSelected(day)
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
          ].join(' ')}
        >
          {day}
        </button>
      ))}
      {hasMore && !showAllDays && (
        <button
          type="button"
          onClick={() => setShowAllDays(true)}
          className="rounded-md px-1.5 py-0.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          +{daysInMonth - 14}
        </button>
      )}
      {hasSelection && (
        <>
          <span className="text-zinc-200 dark:text-zinc-700">|</span>
          <button
            type="button"
            onClick={handleClear}
            aria-label={lang === 'th' ? 'ล้างการเลือกวัน' : 'Clear day selection'}
            className="text-xs text-zinc-400 transition hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
}

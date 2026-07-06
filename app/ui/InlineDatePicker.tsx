'use client';

import { useMemo, useState } from 'react';

const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

type InlineDatePickerProps = {
  /** Selected months as "YYYY-MM" (multi-select), empty array for none. */
  monthKeys: string[];
  /** Selected days as "YYYY-MM-DD" array. */
  dayKeys: string[];
  onMonthChange: (monthKeys: string[]) => void;
  onDayChange: (dayKeys: string[]) => void;
  multiDay?: boolean;
  lang?: string;
  className?: string;
};

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export default function InlineDatePicker({
  monthKeys,
  dayKeys,
  onMonthChange,
  onDayChange,
  multiDay = true,
  lang = 'en',
  className = '',
}: InlineDatePickerProps) {
  const months = lang === 'th' ? MONTH_TH : MONTH_EN;

  const initialYear = useMemo(() => {
    const first = monthKeys[0];
    if (first) {
      const y = parseInt(first.split('-')[0]!, 10);
      if (!isNaN(y)) return y;
    }
    return new Date().getFullYear();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [year, setYear] = useState(initialYear);
  const [showAllDays, setShowAllDays] = useState(false);

  // The single month to use for day-level filtering; day pills only show when exactly one month is selected.
  const soleMonthKey = monthKeys.length === 1 ? monthKeys[0]! : '';

  const selectedMonthIndices = useMemo(() => {
    const indices = new Set<number>();
    monthKeys.forEach((key) => {
      if (!/^\d{4}-\d{2}$/.test(key)) return;
      const parts = key.split('-');
      const y = parseInt(parts[0]!, 10);
      const m = parseInt(parts[1]!, 10);
      if (isNaN(y) || isNaN(m) || y !== year) return;
      indices.add(m - 1);
    });
    return indices;
  }, [monthKeys, year]);

  const daysInMonth = useMemo(() => {
    if (!soleMonthKey) return 0;
    const parts = soleMonthKey.split('-');
    const y = parseInt(parts[0]!, 10);
    const m = parseInt(parts[1]!, 10);
    if (isNaN(y) || isNaN(m)) return 0;
    return getDaysInMonth(y, m);
  }, [soleMonthKey]);

  const handleMonthClick = (monthIndex: number) => {
    const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    const next = monthKeys.includes(key)
      ? monthKeys.filter((v) => v !== key)
      : [...monthKeys, key].sort();
    onMonthChange(next);
    onDayChange([]);
    setShowAllDays(false);
  };

  const handleDayClick = (day: number) => {
    if (!soleMonthKey) return;
    const dayKey = `${soleMonthKey}-${String(day).padStart(2, '0')}`;
    if (multiDay) {
      const next = dayKeys.includes(dayKey)
        ? dayKeys.filter((v) => v !== dayKey)
        : [...dayKeys, dayKey].sort();
      onDayChange(next);
    } else {
      onDayChange(dayKeys.includes(dayKey) ? [] : [dayKey]);
    }
  };

  const handleClear = () => {
    onMonthChange([]);
    onDayChange([]);
  };

  const displayDays = showAllDays ? daysInMonth : Math.min(14, daysInMonth);
  const hasMore = daysInMonth > 14;

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-zinc-200/60 bg-white/80 px-1.5 py-[5px] shadow-card backdrop-blur-sm dark:border-zinc-700/60 dark:bg-zinc-900/80 ${className}`}
    >
      {/* Year navigation */}
      <button
        type="button"
        onClick={() => setYear((y) => y - 1)}
        aria-label="Previous year"
        className="flex h-[22px] w-[22px] items-center justify-center rounded text-[10px] bg-zinc-100 text-zinc-500 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
      >
        ‹
      </button>
      <span className="min-w-[2.5rem] text-center text-xs font-semibold text-zinc-700 dark:text-zinc-200">
        {year}
      </span>
      <button
        type="button"
        onClick={() => setYear((y) => y + 1)}
        aria-label="Next year"
        className="flex h-[22px] w-[22px] items-center justify-center rounded text-[10px] bg-zinc-100 text-zinc-500 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
      >
        ›
      </button>

      <span className="text-zinc-200 dark:text-zinc-700">|</span>

      {/* Month pills — clicking toggles a month on/off without clearing the others */}
      {months.map((abbr, i) => (
        <button
          key={i}
          type="button"
          onClick={() => handleMonthClick(i)}
          className={[
            'rounded-md px-1.5 py-0.5 text-xs font-medium transition-all duration-150',
            selectedMonthIndices.has(i)
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
          ].join(' ')}
        >
          {abbr}
        </button>
      ))}

      {/* Day pills — only when exactly one month is selected */}
      {soleMonthKey && daysInMonth > 0 && (
        <>
          <span className="text-zinc-200 dark:text-zinc-700">|</span>
          {Array.from({ length: displayDays }, (_, i) => i + 1).map((day) => {
            const dayKey = `${soleMonthKey}-${String(day).padStart(2, '0')}`;
            const isSelected = dayKeys.includes(dayKey);
            return (
              <button
                key={day}
                type="button"
                onClick={() => handleDayClick(day)}
                className={[
                  'min-w-[22px] rounded-md px-1 py-0.5 text-xs font-medium transition-all duration-150',
                  isSelected
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
                ].join(' ')}
              >
                {day}
              </button>
            );
          })}
          {hasMore && !showAllDays && (
            <button
              type="button"
              onClick={() => setShowAllDays(true)}
              className="rounded-md px-1.5 py-0.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              +{daysInMonth - 14}
            </button>
          )}
        </>
      )}

      {/* Clear button */}
      {monthKeys.length > 0 && (
        <>
          <span className="text-zinc-200 dark:text-zinc-700">|</span>
          <button
            type="button"
            onClick={handleClear}
            aria-label={lang === 'th' ? 'ล้างการเลือก' : 'Clear selection'}
            className="text-xs text-zinc-400 transition hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
}

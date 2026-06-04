'use client';

import { useMemo, useState } from 'react';

const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

type InlineDatePickerProps = {
  /** Selected month as "YYYY-MM", empty string for none. */
  monthKey: string;
  /** Selected days as "YYYY-MM-DD" array. */
  dayKeys: string[];
  onMonthChange: (monthKey: string) => void;
  onDayChange: (dayKeys: string[]) => void;
  multiDay?: boolean;
  lang?: string;
  className?: string;
};

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export default function InlineDatePicker({
  monthKey,
  dayKeys,
  onMonthChange,
  onDayChange,
  multiDay = true,
  lang = 'en',
  className = '',
}: InlineDatePickerProps) {
  const months = lang === 'th' ? MONTH_TH : MONTH_EN;

  const initialYear = useMemo(() => {
    if (monthKey) {
      const y = parseInt(monthKey.split('-')[0]!, 10);
      if (!isNaN(y)) return y;
    }
    return new Date().getFullYear();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [year, setYear] = useState(initialYear);
  const [showAllDays, setShowAllDays] = useState(false);

  const selectedMonthIndex = useMemo(() => {
    if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return -1;
    const parts = monthKey.split('-');
    const y = parseInt(parts[0]!, 10);
    const m = parseInt(parts[1]!, 10);
    if (isNaN(y) || isNaN(m)) return -1;
    if (y !== year) return -1;
    return m - 1;
  }, [monthKey, year]);

  const daysInMonth = useMemo(() => {
    if (selectedMonthIndex < 0 || !monthKey) return 0;
    const parts = monthKey.split('-');
    const y = parseInt(parts[0]!, 10);
    const m = parseInt(parts[1]!, 10);
    if (isNaN(y) || isNaN(m)) return 0;
    return getDaysInMonth(y, m);
  }, [monthKey, selectedMonthIndex]);

  const handleMonthClick = (monthIndex: number) => {
    const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    if (key === monthKey) {
      onMonthChange('');
      onDayChange([]);
    } else {
      onMonthChange(key);
      onDayChange([]);
      setShowAllDays(false);
    }
  };

  const handleDayClick = (day: number) => {
    const dayKey = `${monthKey}-${String(day).padStart(2, '0')}`;
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
    onMonthChange('');
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

      {/* Month pills */}
      {months.map((abbr, i) => (
        <button
          key={i}
          type="button"
          onClick={() => handleMonthClick(i)}
          className={[
            'rounded-md px-1.5 py-0.5 text-xs font-medium transition-all duration-150',
            i === selectedMonthIndex
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
          ].join(' ')}
        >
          {abbr}
        </button>
      ))}

      {/* Day pills — only when a month in the current year is selected */}
      {selectedMonthIndex >= 0 && daysInMonth > 0 && (
        <>
          <span className="text-zinc-200 dark:text-zinc-700">|</span>
          {Array.from({ length: displayDays }, (_, i) => i + 1).map((day) => {
            const dayKey = `${monthKey}-${String(day).padStart(2, '0')}`;
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
      {monthKey && (
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

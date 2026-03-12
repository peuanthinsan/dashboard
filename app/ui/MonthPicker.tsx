'use client';

import { useMemo, useState } from 'react';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type MonthPickerProps = {
  value: string; // YYYY-MM format
  onChange: (value: string) => void;
  className?: string;
};

export default function MonthPicker({ value, onChange, className = '' }: MonthPickerProps) {
  const now = new Date();
  const [year, setYear] = useState<number>(() => {
    if (value) {
      const y = parseInt(value.split('-')[0], 10);
      if (!isNaN(y)) return y;
    }
    return now.getFullYear();
  });

  const selectedYear = useMemo(() => {
    if (!value) return null;
    const [y] = value.split('-').map(Number);
    return isNaN(y) ? null : y;
  }, [value]);

  const selectedMonth = useMemo(() => {
    if (!value) return null;
    const [, m] = value.split('-').map(Number);
    return isNaN(m) ? null : m;
  }, [value]);

  const handleMonthClick = (monthIndex: number) => {
    const m = String(monthIndex + 1).padStart(2, '0');
    const next = `${year}-${m}`;
    onChange(next);
  };

  const handlePrevYear = () => setYear((y) => y - 1);
  const handleNextYear = () => setYear((y) => y + 1);

  return (
    <div className={`inline-flex flex-col gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-900 ${className}`}>
      {/* Year navigation */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handlePrevYear}
          aria-label="Previous year"
          className="flex h-6 w-6 items-center justify-center rounded text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          ‹
        </button>
        <span className="min-w-[3rem] text-center text-xs font-semibold text-zinc-700 dark:text-zinc-200">
          {year}
        </span>
        <button
          type="button"
          onClick={handleNextYear}
          aria-label="Next year"
          className="flex h-6 w-6 items-center justify-center rounded text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          ›
        </button>
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-4 gap-1">
        {MONTH_ABBR.map((abbr, index) => {
          const isSelected = selectedYear === year && selectedMonth === index + 1;
          return (
            <button
              key={abbr}
              type="button"
              onClick={() => handleMonthClick(index)}
              className={[
                'rounded px-2 py-1 text-xs font-medium transition',
                isSelected
                  ? 'bg-indigo-600 text-white'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
              ].join(' ')}
            >
              {abbr}
            </button>
          );
        })}
      </div>

      {/* Clear selection */}
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="mt-0.5 text-center text-xs text-zinc-400 transition hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          Clear
        </button>
      )}
    </div>
  );
}

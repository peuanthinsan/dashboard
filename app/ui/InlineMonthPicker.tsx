'use client';

import { useMemo, useState } from 'react';

const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

type InlineMonthPickerProps = {
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multi?: boolean;
  lang?: string;
  className?: string;
};

export default function InlineMonthPicker({
  value,
  onChange,
  multi = false,
  lang = 'en',
  className = '',
}: InlineMonthPickerProps) {
  const months = lang === 'th' ? MONTH_TH : MONTH_EN;
  const values = useMemo(() => {
    if (!value) return [] as string[];
    return Array.isArray(value) ? value : [value];
  }, [value]);

  const initialYear = useMemo(() => {
    const first = values[0];
    if (first) {
      const y = parseInt(first.split('-')[0], 10);
      if (!isNaN(y)) return y;
    }
    return new Date().getFullYear();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [year, setYear] = useState(initialYear);

  const isSelected = (monthIndex: number) => {
    const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    return values.includes(key);
  };

  const handleClick = (monthIndex: number) => {
    const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
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

  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-lg border border-zinc-200/60 bg-white/80 px-1.5 py-[5px] shadow-card backdrop-blur-sm dark:border-zinc-700/60 dark:bg-zinc-900/80 ${className}`}
    >
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

      {months.map((abbr, i) => (
        <button
          key={i}
          type="button"
          onClick={() => handleClick(i)}
          className={[
            'rounded-md px-1.5 py-0.5 text-xs font-medium transition-all duration-150',
            isSelected(i)
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
          ].join(' ')}
        >
          {abbr}
        </button>
      ))}

      {hasSelection && (
        <>
          <span className="text-zinc-200 dark:text-zinc-700">|</span>
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear month selection"
            className="text-xs text-zinc-400 transition hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
}

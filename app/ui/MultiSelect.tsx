'use client';

import { useEffect, useId, useRef, useState, useMemo } from 'react';
import {
  multiSelectTrigger,
  multiSelectDefault,
  multiSelectActive,
  multiSelectOpen,
  multiSelectPanel,
} from './design-tokens';

type MultiSelectProps = {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  lang?: string;
  className?: string;
};

export default function MultiSelect({
  label,
  options,
  selected,
  onChange,
  lang = 'en',
  className = '',
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [cleared, setCleared] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const listboxId = useId();

  const t = lang === 'th'
    ? { all: 'ทั้งหมด', search: 'ค้นหา...', clear: 'ล้างตัวกรอง', done: 'เสร็จ', options: 'ตัวเลือก' }
    : { all: `All ${label}`, search: 'Search options...', clear: 'Clear filter', done: 'Done', options: 'options' };

  const filtered = useMemo(
    () => options.filter((o) => o.toLowerCase().includes(search.toLowerCase())),
    [options, search],
  );

  const allSelected = selected.length === 0 || selected.length === options.length;
  const hasSelection = selected.length > 0 && selected.length < options.length;

  const toggleItem = (item: string) => {
    // An empty selection is the shared dashboard convention for "show all".
    // Start a filter with the clicked option instead of treating the empty
    // state as an explicit selection of every option (which inverted the
    // interaction and made Clear filter appear to do nothing).
    if (selected.length === 0) {
      setCleared(false);
      onChange([item]);
      return;
    }

    setCleared(false);
    onChange(
      selected.includes(item)
        ? selected.filter((s) => s !== item)
        : [...selected, item],
    );
  };

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const triggerText = allSelected
    ? t.all
    : `${selected.length} ${label}`;

  const stateClass = open ? multiSelectOpen : hasSelection ? multiSelectActive : multiSelectDefault;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${multiSelectTrigger} ${stateClass}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
      >
        <span className="min-w-0 truncate">{triggerText}</span>
        {hasSelection ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
            {selected.length}
          </span>
        ) : null}
        <svg aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className={multiSelectPanel}>
          <div className="border-b border-zinc-100/80 p-3 dark:border-zinc-800/60">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{label}</p>
              <span className="text-[10px] font-medium text-zinc-400">
                {options.length} {t.options}
              </span>
            </div>
            <label className="relative block">
              <span className="sr-only">{t.search}</span>
              <svg aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                <circle cx="11" cy="11" r="7" />
                <path strokeLinecap="round" d="M20 20l-4-4" />
              </svg>
              <input
                ref={searchRef}
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown' && filtered.length > 0) {
                    e.preventDefault();
                    optionRefs.current[0]?.focus();
                  }
                }}
                placeholder={t.search}
                className="min-h-9 w-full rounded-lg border border-zinc-200/80 bg-zinc-50 pl-8 pr-3 text-xs outline-none transition-all focus:border-red-400 focus:bg-white focus:ring-4 focus:ring-red-400/10 dark:border-zinc-700/80 dark:bg-zinc-950/50 dark:focus:bg-zinc-950"
              />
            </label>
          </div>

          <div id={listboxId} className="max-h-[240px] overflow-y-auto p-1.5" role="listbox" aria-label={label} aria-multiselectable="true">
            {filtered.map((option) => {
              const checked = !cleared && (allSelected || selected.includes(option));
              const optionIndex = filtered.indexOf(option);
              // role="option" must sit on the focusable element so screen readers
              // announce "selected/not selected" and keyboard users can reach it.
              // Space/Enter toggle — matches the ARIA multiselect pattern.
              return (
                <div
                  key={option}
                  ref={(node) => {
                    optionRefs.current[optionIndex] = node;
                  }}
                  role="option"
                  aria-selected={checked}
                  tabIndex={0}
                  onClick={() => toggleItem(option)}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      toggleItem(option);
                    }
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      optionRefs.current[Math.min(optionIndex + 1, filtered.length - 1)]?.focus();
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      if (optionIndex === 0) searchRef.current?.focus();
                      else optionRefs.current[optionIndex - 1]?.focus();
                    }
                    if (e.key === 'Home') {
                      e.preventDefault();
                      optionRefs.current[0]?.focus();
                    }
                    if (e.key === 'End') {
                      e.preventDefault();
                      optionRefs.current[filtered.length - 1]?.focus();
                    }
                  }}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/30 ${
                    checked ? 'bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-200' : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-sm border-2 text-[8px] font-bold ${
                      checked
                        ? 'border-red-600 bg-red-600 text-white'
                        : 'border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800'
                    }`}
                  >
                    {checked && '✓'}
                  </span>
                  <span className="min-w-0 truncate">{option}</span>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="px-2.5 py-3 text-center text-xs text-zinc-400">
                {lang === 'th' ? 'ไม่พบผลลัพธ์' : 'No results'}
              </div>
            )}
          </div>

          <div className="flex justify-between border-t border-zinc-100/80 bg-zinc-50/70 px-3 py-2.5 dark:border-zinc-800/60 dark:bg-zinc-950/30">
            <button
              type="button"
              onClick={() => {
                onChange([]);
                setSearch('');
                setCleared(true);
              }}
              className="text-[11px] font-semibold text-zinc-500 transition hover:text-zinc-900 dark:hover:text-zinc-200"
            >
              {t.clear}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[11px] font-semibold text-red-600 transition hover:text-red-700 dark:text-red-400"
            >
              {t.done}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const t = lang === 'th'
    ? { all: `ทั้งหมด`, search: 'ค้นหา...', clear: 'ล้างทั้งหมด', selectAll: 'เลือกทั้งหมด' }
    : { all: `All ${label}`, search: 'Search...', clear: 'Clear all', selectAll: 'Select all' };

  const filtered = useMemo(
    () => options.filter((o) => o.toLowerCase().includes(search.toLowerCase())),
    [options, search],
  );

  const allSelected = selected.length === 0 || selected.length === options.length;
  const hasSelection = selected.length > 0 && selected.length < options.length;

  const toggleItem = (item: string) => {
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
      >
        <span>{triggerText}</span>
        <span className="text-[9px]">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className={multiSelectPanel} role="listbox" aria-multiselectable="true">
          <div className="border-b border-zinc-100/80 p-2 dark:border-zinc-800/60">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.search}
              className="w-full rounded-md border border-zinc-200/60 bg-transparent px-2.5 py-1 text-xs outline-none transition-colors focus:border-red-400 focus:ring-1 focus:ring-red-400/20 dark:border-zinc-700/60"
            />
          </div>

          <div className="max-h-[180px] overflow-y-auto py-1">
            {filtered.map((option) => {
              const checked = selected.includes(option);
              return (
                <label
                  key={option}
                  className={`flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-xs transition ${
                    checked ? 'bg-red-50 dark:bg-red-950/50' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                  role="option"
                  aria-selected={checked}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleItem(option)}
                    className="sr-only"
                  />
                  <span
                    className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-sm border-2 text-[8px] font-bold ${
                      checked
                        ? 'border-red-600 bg-red-600 text-white'
                        : 'border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800'
                    }`}
                  >
                    {checked && '✓'}
                  </span>
                  <span className="text-zinc-700 dark:text-zinc-200">{option}</span>
                </label>
              );
            })}
            {filtered.length === 0 && (
              <div className="px-2.5 py-3 text-center text-xs text-zinc-400">
                {lang === 'th' ? 'ไม่พบผลลัพธ์' : 'No results'}
              </div>
            )}
          </div>

          <div className="flex justify-between border-t border-zinc-100/80 px-2.5 py-2 dark:border-zinc-800/60">
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[10px] text-zinc-400 transition hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              {t.clear}
            </button>
            <button
              type="button"
              onClick={() => onChange([...options])}
              className="text-[10px] font-semibold text-red-600 transition hover:text-red-700 dark:text-red-400"
            >
              {t.selectAll}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

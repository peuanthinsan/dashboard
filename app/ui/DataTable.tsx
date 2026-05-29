'use client';

import React, { useState, useCallback } from 'react';
import {
  tableHead,
  tableHeadCell,
  tableRow,
  tableCell,
} from './design-tokens';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  /** Row field used for sorting when different from `key` (e.g. numeric sort keys). */
  sortKey?: string;
  render?: (value: unknown, row: T) => React.ReactNode;
  stickyLeft?: boolean;
  /** Allow cell text to wrap (e.g. long location names). */
  wrap?: boolean;
  /** Extra cell classes when `wrap` is true (e.g. max-width for location columns). */
  wrapClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  defaultSort?: { key: string; direction: 'asc' | 'desc' };
  onRowClick?: (row: T) => void;
  ariaLabel?: string;
  pageSize?: number;
}

type SortDirection = 'asc' | 'desc' | null;

interface SortState {
  key: string;
  direction: SortDirection;
}

function getSortedData<T>(
  data: T[],
  sort: SortState,
  columns: Column<T>[],
): T[] {
  if (!sort.key || sort.direction === null) return data;

  const sortField = columns.find((c) => c.key === sort.key)?.sortKey ?? sort.key;

  return [...data].sort((a, b) => {
    const aVal = (a as Record<string, unknown>)[sortField];
    const bVal = (b as Record<string, unknown>)[sortField];

    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;

    let comparison = 0;
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal;
    } else {
      comparison = String(aVal).localeCompare(String(bVal));
    }

    return sort.direction === 'asc' ? comparison : -comparison;
  });
}

function nextDirection(current: SortDirection): SortDirection {
  if (current === null) return 'asc';
  if (current === 'asc') return 'desc';
  return null;
}

export function DataTable<T extends object>({
  columns,
  data,
  defaultSort,
  onRowClick,
  ariaLabel,
  pageSize,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>(() => ({
    key: defaultSort?.key ?? '',
    direction: defaultSort?.direction ?? null,
  }));
  const [page, setPage] = useState(0);

  const handleSort = useCallback((col: Column<T>) => {
    if (!col.sortable) return;
    setSort((prev) => {
      if (prev.key === col.key) {
        return { key: col.key, direction: nextDirection(prev.direction) };
      }
      return { key: col.key, direction: 'asc' };
    });
  }, []);

  const handleHeaderKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTableCellElement>, col: Column<T>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSort(col);
      }
    },
    [handleSort],
  );

  const sortedData = getSortedData(data, sort, columns);
  const totalPages = pageSize ? Math.max(1, Math.ceil(sortedData.length / pageSize)) : 1;
  const clampedPage = Math.min(page, totalPages - 1);
  const pagedData = pageSize ? sortedData.slice(clampedPage * pageSize, (clampedPage + 1) * pageSize) : sortedData;

  return (
    <div className="w-full min-w-0">
      <div className="max-w-full overflow-x-auto overscroll-x-contain rounded-lg [-webkit-overflow-scrolling:touch]">
        <table
          className="w-max min-w-full border-collapse"
          aria-label={ariaLabel}
        >
        <thead className={tableHead}>
          <tr>
            {columns.map((col) => {
              const isActive = sort.key === col.key && sort.direction !== null;

              return (
                <th
                  key={col.key}
                  scope="col"
                  className={[
                    tableHeadCell,
                    'whitespace-nowrap',
                    col.sortable
                      ? 'cursor-pointer select-none transition-colors duration-150 hover:text-zinc-900 dark:hover:text-zinc-100'
                      : '',
                    col.stickyLeft
                      ? 'sticky left-0 z-10 border-r border-zinc-200/80 bg-zinc-50/95 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)] backdrop-blur-sm dark:border-zinc-700/80 dark:bg-zinc-900/95 dark:shadow-[2px_0_6px_-2px_rgba(0,0,0,0.35)]'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={col.sortable ? () => handleSort(col) : undefined}
                  onKeyDown={col.sortable ? (e) => handleHeaderKeyDown(e, col) : undefined}
                  tabIndex={col.sortable ? 0 : undefined}
                  aria-sort={
                    isActive
                      ? sort.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : col.sortable
                      ? 'none'
                      : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {isActive && (
                      <span aria-hidden="true" className="text-red-500">
                        {sort.direction === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {pagedData.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={[
                tableRow,
                onRowClick ? 'cursor-pointer' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
            >
              {columns.map((col) => {
                const rawValue = (row as Record<string, unknown>)[col.key];
                const rendered = col.render
                  ? col.render(rawValue, row)
                  : (rawValue as React.ReactNode);

                return (
                  <td
                    key={col.key}
                    className={[
                      tableCell,
                      col.wrap
                        ? [col.wrapClassName, 'whitespace-normal align-top'].filter(Boolean).join(' ')
                        : 'whitespace-nowrap',
                      col.stickyLeft
                        ? 'sticky left-0 z-10 border-r border-zinc-200/80 bg-white/95 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)] backdrop-blur-sm dark:border-zinc-700/80 dark:bg-zinc-900/95 dark:shadow-[2px_0_6px_-2px_rgba(0,0,0,0.35)]'
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {rendered}
                  </td>
                );
              })}
            </tr>
          ))}
          {sortedData.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-12 text-center text-sm text-zinc-400 dark:text-zinc-500"
              >
                No data available
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
      {pageSize && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-zinc-100/80 bg-zinc-50/50 px-4 py-2.5 dark:border-zinc-800/60 dark:bg-zinc-900/30">
          <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
            {clampedPage * pageSize + 1}–{Math.min((clampedPage + 1) * pageSize, sortedData.length)} of {sortedData.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={clampedPage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-zinc-600 transition-all duration-150 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Prev
            </button>
            {/* Page number pills */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const startPage = Math.max(0, Math.min(clampedPage - 2, totalPages - 5));
              const pageNum = startPage + i;
              if (pageNum >= totalPages) return null;
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setPage(pageNum)}
                  className={[
                    'h-7 min-w-[28px] rounded-md px-1.5 text-xs font-medium tabular-nums transition-all duration-150',
                    pageNum === clampedPage
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800',
                  ].join(' ')}
                >
                  {pageNum + 1}
                </button>
              );
            })}
            <button
              type="button"
              disabled={clampedPage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-zinc-600 transition-all duration-150 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

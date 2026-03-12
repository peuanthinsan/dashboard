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
  render?: (value: unknown, row: T) => React.ReactNode;
  stickyLeft?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  defaultSort?: { key: string; direction: 'asc' | 'desc' };
  onRowClick?: (row: T) => void;
  ariaLabel?: string;
}

type SortDirection = 'asc' | 'desc' | null;

interface SortState {
  key: string;
  direction: SortDirection;
}

function getSortedData<T>(
  data: T[],
  sort: SortState,
): T[] {
  if (!sort.key || sort.direction === null) return data;

  return [...data].sort((a, b) => {
    const aVal = (a as Record<string, unknown>)[sort.key];
    const bVal = (b as Record<string, unknown>)[sort.key];

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
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>(() => ({
    key: defaultSort?.key ?? '',
    direction: defaultSort?.direction ?? null,
  }));

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

  const sortedData = getSortedData(data, sort);

  return (
    <div className="overflow-x-auto w-full">
      <table
        className="w-full border-collapse"
        aria-label={ariaLabel}
      >
        <thead className={tableHead}>
          <tr>
            {columns.map((col) => {
              const isActive = sort.key === col.key && sort.direction !== null;
              const arrow =
                isActive && sort.direction === 'asc'
                  ? ' ▲'
                  : isActive && sort.direction === 'desc'
                  ? ' ▼'
                  : '';

              return (
                <th
                  key={col.key}
                  scope="col"
                  className={[
                    tableHeadCell,
                    col.sortable
                      ? 'cursor-pointer select-none hover:text-zinc-900 dark:hover:text-zinc-100'
                      : '',
                    col.stickyLeft ? 'sticky left-0 bg-white dark:bg-zinc-900 z-10' : '',
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
                  {col.label}
                  {arrow && (
                    <span aria-hidden="true" className="ml-1 text-indigo-500">
                      {sort.direction === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, rowIndex) => (
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
                      col.stickyLeft
                        ? 'sticky left-0 bg-white dark:bg-zinc-900'
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
                className="px-4 py-8 text-center text-sm text-zinc-400 dark:text-zinc-500"
              >
                No data available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

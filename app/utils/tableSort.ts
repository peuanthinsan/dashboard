import type { MouseEvent } from 'react';

export type SortDirection = 'asc' | 'desc';

export type SortState = {
  id: string;
  direction: SortDirection;
};

export const MULTI_SORT_HINT =
  'Tip: Shift-click (or Ctrl/Cmd-click) additional columns to sort by multiple columns.';

export const isMultiSortEvent = (event?: MouseEvent<HTMLElement>) =>
  Boolean(event?.shiftKey || event?.metaKey || event?.ctrlKey);

export const updateMultiSort = (current: SortState[], columnId: string, isMultiSort: boolean) => {
  const existingIndex = current.findIndex((sort) => sort.id === columnId);
  const existing = existingIndex >= 0 ? current[existingIndex] : null;
  let nextDirection: SortDirection | null = 'asc';
  if (existing?.direction === 'asc') {
    nextDirection = 'desc';
  } else if (existing?.direction === 'desc') {
    nextDirection = null;
  }

  const base = isMultiSort ? [...current] : [];
  if (existingIndex >= 0) {
    base.splice(existingIndex, 1);
  }
  if (nextDirection) {
    base.push({ id: columnId, direction: nextDirection });
  }
  return base;
};

export const buildMultiSortComparator = <T,>(
  sorts: SortState[],
  accessors: Record<string, (row: T) => string | number | Date | null | undefined>,
) => {
  if (sorts.length === 0) return null;
  return (a: T, b: T) => {
    for (const sort of sorts) {
      const accessor = accessors[sort.id];
      if (!accessor) continue;
      const valueA = accessor(a);
      const valueB = accessor(b);
      let comparison = 0;
      if (valueA == null && valueB == null) {
        comparison = 0;
      } else if (valueA == null) {
        comparison = 1;
      } else if (valueB == null) {
        comparison = -1;
      } else if (valueA instanceof Date && valueB instanceof Date) {
        comparison = valueA.getTime() - valueB.getTime();
      } else if (typeof valueA === 'number' && typeof valueB === 'number') {
        comparison = valueA - valueB;
      } else {
        comparison = String(valueA).localeCompare(String(valueB), undefined, { numeric: true });
      }
      if (comparison !== 0) {
        return sort.direction === 'asc' ? comparison : -comparison;
      }
    }
    return 0;
  };
};

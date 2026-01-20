import type { MouseEvent } from 'react';

export type SortDirection = 'asc' | 'desc';

export type MultiSort = {
  id: string;
  direction: SortDirection;
};

export const MULTI_SORT_HINT =
  'Tip: Shift-click (or Ctrl/Cmd-click) additional columns to sort by multiple columns.';

export const isMultiSortEvent = (event: MouseEvent) => event.shiftKey || event.ctrlKey || event.metaKey;

export const updateMultiSort = (prev: MultiSort[], columnId: string, isMultiSort: boolean) => {
  const existing = prev.find((sort) => sort.id === columnId);
  const nextDirection: SortDirection = existing?.direction === 'asc' ? 'desc' : 'asc';
  const base = isMultiSort ? prev.filter((sort) => sort.id !== columnId) : [];
  return [...base, { id: columnId, direction: nextDirection }];
};

type Accessor<T> = (row: T) => string | number | Date | null;

export const buildMultiSortComparator = <T>(sorts: MultiSort[], accessors: Record<string, Accessor<T>>) => {
  if (!sorts.length) {
    return null;
  }
  return (a: T, b: T) => {
    for (const sort of sorts) {
      const accessor = accessors[sort.id];
      if (!accessor) {
        continue;
      }
      const aValue = accessor(a);
      const bValue = accessor(b);
      if (aValue === bValue) {
        continue;
      }
      const direction = sort.direction === 'asc' ? 1 : -1;
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      if (aValue instanceof Date && bValue instanceof Date) {
        return (aValue.getTime() - bValue.getTime()) * direction;
      }
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return (aValue - bValue) * direction;
      }
      return String(aValue).localeCompare(String(bValue)) * direction;
    }
    return 0;
  };
};

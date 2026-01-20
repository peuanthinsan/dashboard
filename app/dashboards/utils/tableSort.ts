import type { MouseEvent } from 'react';

export const MULTI_SORT_HINT = 'Hold shift to sort by multiple columns.';

export type SortDirection = 'asc' | 'desc';

export type SortConfig = {
  id: string;
  direction: SortDirection;
};

export type SortAccessor<Row> = (row: Row) => string | number | Date | null;

export const isMultiSortEvent = (event: MouseEvent) => event.shiftKey;

export const updateMultiSort = (
  previous: SortConfig[],
  columnId: string,
  allowMultiSort: boolean,
) => {
  const existing = previous.find((sort) => sort.id === columnId);
  const nextDirection: SortDirection = existing?.direction === 'asc' ? 'desc' : 'asc';
  const nextSort: SortConfig = { id: columnId, direction: nextDirection };

  if (!allowMultiSort) {
    return [nextSort];
  }

  if (!existing) {
    return [...previous, nextSort];
  }

  return previous.map((sort) => (sort.id === columnId ? nextSort : sort));
};

const compareValues = (left: string | number | Date | null, right: string | number | Date | null) => {
  if (left == null && right == null) return 0;
  if (left == null) return -1;
  if (right == null) return 1;
  if (left instanceof Date && right instanceof Date) {
    return left.getTime() - right.getTime();
  }
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
};

export const buildMultiSortComparator = <Row,>(
  sorts: SortConfig[],
  accessors: Record<string, SortAccessor<Row>>,
) => {
  if (!sorts.length) return null;
  return (left: Row, right: Row) => {
    for (const sort of sorts) {
      const accessor = accessors[sort.id];
      if (!accessor) continue;
      const order = compareValues(accessor(left), accessor(right));
      if (order !== 0) {
        return sort.direction === 'asc' ? order : -order;
      }
    }
    return 0;
  };
};

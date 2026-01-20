export const MULTI_SORT_HINT = 'Tip: hold shift to sort by multiple columns.';

export const isMultiSortEvent = (event) => Boolean(event?.shiftKey);

export const updateMultiSort = (previous, columnId, isMulti) => {
  const existing = previous.find((sort) => sort.id === columnId);
  const nextDirection = existing
    ? existing.direction === 'asc'
      ? 'desc'
      : existing.direction === 'desc'
        ? null
        : 'asc'
    : 'asc';

  if (!isMulti) {
    return nextDirection ? [{ id: columnId, direction: nextDirection }] : [];
  }

  const remaining = previous.filter((sort) => sort.id !== columnId);
  return nextDirection
    ? [...remaining, { id: columnId, direction: nextDirection }]
    : remaining;
};

const compareValues = (valueA, valueB) => {
  if (valueA == null && valueB == null) return 0;
  if (valueA == null) return -1;
  if (valueB == null) return 1;
  if (valueA instanceof Date && valueB instanceof Date) {
    return valueA.getTime() - valueB.getTime();
  }
  if (typeof valueA === 'number' && typeof valueB === 'number') {
    return valueA - valueB;
  }
  return String(valueA).localeCompare(String(valueB), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
};

export const buildMultiSortComparator = (sorts, accessors) => {
  if (!sorts || sorts.length === 0) {
    return null;
  }

  return (rowA, rowB) => {
    for (const sort of sorts) {
      const accessor = accessors[sort.id];
      if (!accessor) continue;
      const comparison = compareValues(accessor(rowA), accessor(rowB));
      if (comparison !== 0) {
        return sort.direction === 'desc' ? -comparison : comparison;
      }
    }
    return 0;
  };
};

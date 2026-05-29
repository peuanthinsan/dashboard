import { describe, expect, it } from 'vitest';
import {
  filterTripSourceRows,
  tripRowSortValue,
  tripTableSortFieldKey,
} from './drivingTripTable';

describe('tripRowSortValue', () => {
  it('parses duration columns as hours', () => {
    expect(tripRowSortValue('DriveHrs', '2:30:00')).toBeCloseTo(2.5, 5);
  });

  it('parses login time as timestamp', () => {
    const t = tripRowSortValue('Login Time', '2026-05-01 10:00:00');
    expect(typeof t).toBe('number');
    expect(t).toBeGreaterThan(0);
  });
});

describe('filterTripSourceRows', () => {
  const columns = [
    { label: 'Driver Name', type: 'string', fieldKey: 'Driver Name' },
    { label: 'Vehicle No', type: 'string', fieldKey: 'Vehicle No' },
  ];

  it('returns all rows when search is empty', () => {
    const rows = [{ 'Driver Name': 'Alice', 'Vehicle No': 'V1' }];
    expect(filterTripSourceRows(rows, '', columns)).toHaveLength(1);
  });

  it('filters by case-insensitive substring across columns', () => {
    const rows = [
      { 'Driver Name': 'Alice', 'Vehicle No': 'V1' },
      { 'Driver Name': 'Bob', 'Vehicle No': 'V2' },
    ];
    expect(filterTripSourceRows(rows, 'alice', columns)).toHaveLength(1);
    expect(filterTripSourceRows(rows, 'v2', columns)).toHaveLength(1);
  });
});

describe('tripTableSortFieldKey', () => {
  it('prefixes field keys for sort columns', () => {
    expect(tripTableSortFieldKey('Login Time')).toBe('_sort_Login Time');
  });
});

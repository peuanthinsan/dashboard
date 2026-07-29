import { describe, expect, it } from 'vitest';
import {
  dateTimeInputToUtcMs,
  dateTimeRangeToMonthKeys,
  isDateInDateTimeRange,
  legacyDateFiltersToRange,
  monthKeyToDateTimeRange,
} from './dateTimeRange';

describe('dateTimeRange', () => {
  it('parses picker digits as UTC fields for Bangkok-normalized sheet dates', () => {
    expect(dateTimeInputToUtcMs('2026-07-29T12:08')).toBe(
      Date.UTC(2026, 6, 29, 12, 8),
    );
  });

  it('uses inclusive range boundaries', () => {
    const range = {
      start: '2026-07-29T08:30',
      end: '2026-07-29T17:45',
    };
    expect(isDateInDateTimeRange(new Date(Date.UTC(2026, 6, 29, 8, 30)), range)).toBe(true);
    expect(isDateInDateTimeRange(new Date(Date.UTC(2026, 6, 29, 17, 45)), range)).toBe(true);
    expect(isDateInDateTimeRange(new Date(Date.UTC(2026, 6, 29, 17, 46)), range)).toBe(false);
  });

  it('enumerates every fetch month crossed by a range', () => {
    expect(
      dateTimeRangeToMonthKeys({
        start: '2026-05-30T00:00',
        end: '2026-07-02T23:59',
      }),
    ).toEqual(['2026-05', '2026-06', '2026-07']);
  });

  it('creates whole-month defaults', () => {
    expect(monthKeyToDateTimeRange('2026-02')).toEqual({
      start: '2026-02-01T00:00',
      end: '2026-02-28T23:59',
    });
  });

  it('migrates legacy day selections to an inclusive span', () => {
    expect(
      legacyDateFiltersToRange(['2026-06'], ['2026-06-30', '2026-06-12']),
    ).toEqual({
      start: '2026-06-12T00:00',
      end: '2026-06-30T23:59',
    });
  });
});

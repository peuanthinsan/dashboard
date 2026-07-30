import { describe, expect, it } from 'vitest';
import {
  clampDateTimeRangeToMaxMonths,
  countMonthsSpanned,
  dateTimeInputToUtcMs,
  dateTimeRangeToMonthKeys,
  EMPTY_DATE_TIME_RANGE,
  isDateInDateTimeRange,
  legacyDateFiltersToRange,
  monthKeyToDateTimeRange,
  resolveStoredDateTimeRange,
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

  it('caps an oversized persisted range at 24 months instead of generating hundreds of fetch chunks', () => {
    // Regression: a corrupt/oversized persisted range (e.g. Dec 2019 – Dec
    // 2026, ~85 months) must not enumerate every crossed month — that fans
    // out into hundreds of parallel GViz chunk requests and hangs the
    // dashboard. The picker also rejects >24-month ranges before persisting
    // (see DateTimeRangePicker), but this guard is the last line of defense
    // for state that reached storage some other way.
    //
    // Tail-clamped: serve the newest 24 months (current data), not the
    // oldest 24 months of a five-year-old range.
    const keys = dateTimeRangeToMonthKeys({
      start: '2019-12-01T00:00',
      end: '2026-12-31T23:59',
    });
    expect(keys.length).toBe(24);
    expect(keys[0]).toBe('2025-01');
    expect(keys[23]).toBe('2026-12');
  });

  it('counts calendar-month buckets spanned by a range', () => {
    // Leap-parity: exactly 24 calendar months across Feb 29
    expect(countMonthsSpanned({
      start: '2024-02-01T00:00',
      end: '2026-01-31T23:59',
    })).toBe(24);

    // Bucket rule beats duration: 23.5 months but touches 25 buckets
    expect(countMonthsSpanned({
      start: '2024-01-31T00:00',
      end: '2026-01-15T23:59',
    })).toBe(25);

    // Same month
    expect(countMonthsSpanned({
      start: '2024-02-01T00:00',
      end: '2024-02-15T23:59',
    })).toBe(1);

    // Incomplete range
    expect(countMonthsSpanned({ start: '', end: '2024-02-01T00:00' })).toBe(null);
    expect(countMonthsSpanned({ start: '2024-02-01T00:00', end: '' })).toBe(null);
  });

  it('clamps oversized ranges to newest 24 months and returns same reference when in-cap', () => {
    // Oversized: Dec 2019 – Dec 2026 clamps to Jan 2025 – Dec 2026
    const oversized = {
      start: '2019-12-01T00:00',
      end: '2026-12-31T23:59',
    };
    const clamped = clampDateTimeRangeToMaxMonths(oversized);
    expect(clamped).toEqual({
      start: '2025-01-01T00:00',
      end: '2026-12-31T23:59',
    });
    expect(clamped).not.toBe(oversized); // different object

    // In-cap: same reference
    const inCap = {
      start: '2026-09-01T00:00',
      end: '2026-12-31T23:59',
    };
    const result = clampDateTimeRangeToMaxMonths(inCap);
    expect(result).toBe(inCap); // identical reference

    // Exact 24-month leap range: unchanged, same reference
    const leap24 = {
      start: '2024-02-01T00:00',
      end: '2026-01-31T23:59',
    };
    const leapResult = clampDateTimeRangeToMaxMonths(leap24);
    expect(leapResult).toBe(leap24);
  });

  it('resolves stored range with clamp and legacy fallback', () => {
    // Oversized stored
    expect(resolveStoredDateTimeRange({
      start: '2019-12-01T00:00',
      end: '2026-12-31T23:59',
    })).toEqual({
      start: '2025-01-01T00:00',
      end: '2026-12-31T23:59',
    });

    // Missing stored, legacy months/days fallback
    const legacy = resolveStoredDateTimeRange(
      null,
      ['2026-11', '2026-12'],
      []
    );
    expect(legacy.start).toBe('2026-11-01T00:00');
    expect(legacy.end).toMatch(/2026-12-31T23:59/);

    // Garbage
    expect(resolveStoredDateTimeRange({ start: 'x', end: 'y' })).toEqual(
      EMPTY_DATE_TIME_RANGE
    );
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

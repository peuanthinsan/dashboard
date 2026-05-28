import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DRIVING_THRESHOLDS,
  normalizeDrivingThresholds,
  thresholdEntryValue,
  thresholdEntryLabel,
} from './drivingThresholds';

describe('normalizeDrivingThresholds', () => {
  it('returns defaults for null/undefined/non-object input', () => {
    expect(normalizeDrivingThresholds(null)).toEqual(DEFAULT_DRIVING_THRESHOLDS);
    expect(normalizeDrivingThresholds(undefined)).toEqual(DEFAULT_DRIVING_THRESHOLDS);
    expect(normalizeDrivingThresholds(42)).toEqual(DEFAULT_DRIVING_THRESHOLDS);
    expect(normalizeDrivingThresholds('string')).toEqual(DEFAULT_DRIVING_THRESHOLDS);
  });

  it('migrates legacy scalar shape into single-element driveHours and restHours arrays (dropping workingHoursMax)', () => {
    const legacy = {
      continuousDrivingMaxHours: 4,
      workingHoursMax: 12,
      restMinimumHours: 9,
    };
    const out = normalizeDrivingThresholds(legacy);
    expect(out.driveHours).toEqual([{ value: 4, label: 'Cnt Drv > 4 h' }]);
    expect(out.restHours).toEqual([9]);
    expect('workHours' in out).toBe(false);
  });

  it('accepts already-widened shape with numeric entries', () => {
    const widened = { driveHours: [4, 10], restHours: [10] };
    expect(normalizeDrivingThresholds(widened)).toEqual({
      driveHours: [4, 10],
      restHours: [10],
    });
  });

  it('accepts entries with explicit { value, label }', () => {
    const widened = {
      driveHours: [{ value: 4, label: 'Cnt Drv > 4 h' }, { value: 10 }],
      restHours: [{ value: 10 }],
    };
    expect(normalizeDrivingThresholds(widened)).toEqual(widened);
  });

  it('silently drops a workHours key from forward-compat input', () => {
    const input = { driveHours: [4], workHours: [8], restHours: [10] };
    const out = normalizeDrivingThresholds(input);
    expect('workHours' in out).toBe(false);
    expect(out.driveHours).toEqual([4]);
    expect(out.restHours).toEqual([10]);
  });

  it('coerces invalid entries (non-positive, non-numeric, label too long)', () => {
    const out = normalizeDrivingThresholds({
      driveHours: [0, -1, 'abc', { value: 'x' }, { value: 4, label: 'x'.repeat(40) }],
      restHours: [10],
    });
    expect(out.driveHours).toHaveLength(1);
    expect(out.driveHours[0]).toMatchObject({ value: 4 });
    expect((out.driveHours[0] as { label: string }).label).toHaveLength(32);
  });

  it('caps entries to 5 per metric', () => {
    const out = normalizeDrivingThresholds({
      driveHours: [1, 2, 3, 4, 5, 6, 7],
      restHours: [],
    });
    expect(out.driveHours).toHaveLength(5);
    expect(out.driveHours).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('thresholdEntryValue / thresholdEntryLabel', () => {
  it('returns the value for a numeric entry and the object form', () => {
    expect(thresholdEntryValue(4)).toBe(4);
    expect(thresholdEntryValue({ value: 4 })).toBe(4);
    expect(thresholdEntryValue({ value: 4, label: 'X' })).toBe(4);
  });

  it('falls back to provided fallback label for numeric or unlabeled entries', () => {
    expect(thresholdEntryLabel(4, 'fallback')).toBe('fallback');
    expect(thresholdEntryLabel({ value: 4 }, 'fallback')).toBe('fallback');
    expect(thresholdEntryLabel({ value: 4, label: 'Custom' }, 'fallback')).toBe('Custom');
  });
});

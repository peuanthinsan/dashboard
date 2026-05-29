import { describe, expect, it } from 'vitest';
import { computeViolationKey } from './dashboardDataUtils';

describe('computeViolationKey', () => {
  it('produces a 40-char hex sha1 string', () => {
    const key = computeViolationKey({
      metric: 'rest_hrs',
      driver: 'Alice',
      vehicle: '72-1281',
      eventAtIso: '2026-05-01T04:14:00.000Z',
      threshold: 10,
    });
    expect(key).toMatch(/^[0-9a-f]{40}$/);
  });

  it('is stable: same input → same key', () => {
    const args = {
      metric: 'rest_hrs' as const,
      driver: 'Alice',
      vehicle: '72-1281',
      eventAtIso: '2026-05-01T04:14:00.000Z',
      threshold: 10,
    };
    expect(computeViolationKey(args)).toEqual(computeViolationKey(args));
  });

  it('changes when any field changes (rest_hrs)', () => {
    const base = {
      metric: 'rest_hrs' as const,
      driver: 'Alice',
      vehicle: '72-1281',
      eventAtIso: '2026-05-01T04:14:00.000Z',
      threshold: 10,
    };
    const k0 = computeViolationKey(base);
    expect(computeViolationKey({ ...base, driver: 'Bob' })).not.toEqual(k0);
    expect(computeViolationKey({ ...base, vehicle: '72-9999' })).not.toEqual(k0);
    expect(computeViolationKey({ ...base, eventAtIso: '2026-05-02T04:14:00.000Z' })).not.toEqual(k0);
    expect(computeViolationKey({ ...base, threshold: 9 })).not.toEqual(k0);
  });

  it('drive_hrs key uses driver + vehicle + eventAt + threshold', () => {
    const a = computeViolationKey({
      metric: 'drive_hrs',
      driver: 'Alice',
      vehicle: 'V1',
      eventAtIso: '2026-05-01T04:14:00.000Z',
      threshold: 10,
    });
    const b = computeViolationKey({
      metric: 'drive_hrs',
      driver: 'Alice',
      vehicle: 'V1',
      eventAtIso: '2026-05-01T04:14:00.000Z',
      threshold: 10,
    });
    expect(a).toEqual(b);
    expect(a).toMatch(/^[0-9a-f]{40}$/);
  });

  it('drive_hrs and rest_hrs keys never collide', () => {
    const drive = computeViolationKey({
      metric: 'drive_hrs',
      driver: 'Alice',
      vehicle: '72-1281',
      eventAtIso: '2026-05-01T04:14:00.000Z',
      threshold: 10,
    });
    const rest = computeViolationKey({
      metric: 'rest_hrs',
      driver: 'Alice',
      vehicle: '72-1281',
      eventAtIso: '2026-05-01T04:14:00.000Z',
      threshold: 10,
    });
    expect(drive).not.toEqual(rest);
  });
});

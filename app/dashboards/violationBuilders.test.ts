import { describe, expect, it } from 'vitest';
import {
  buildDriveHoursViolations,
  buildRestHoursViolations,
} from './violationBuilders';

function shift(o: {
  driver: string; loginAt: string; logoutAt: string; driveHours: number; restHours?: number;
  vehicle?: string; distanceKm?: number; status?: string; loginLocation?: string; logoutLocation?: string;
}) {
  return {
    sourceRow: {},
    driver: o.driver,
    vehicle: o.vehicle ?? 'V1',
    date: new Date(o.loginAt),
    loginAt: new Date(o.loginAt),
    logoutAt: new Date(o.logoutAt),
    loginLocation: o.loginLocation ?? 'L1',
    logoutLocation: o.logoutLocation ?? 'L2',
    driveHours: o.driveHours,
    workingHours: 0,
    restHours: o.restHours ?? 0,
    distanceKm: o.distanceKm ?? 0,
    status: o.status ?? 'COMPLETED',
  };
}

describe('buildDriveHoursViolations', () => {
  it('emits one row per (driver, day) where the SUM driveHours > threshold', () => {
    const rows = buildDriveHoursViolations(
      [
        shift({ driver: 'Alice', loginAt: '2026-05-01T04:00:00Z', logoutAt: '2026-05-01T10:00:00Z', driveHours: 6 }),
        shift({ driver: 'Alice', loginAt: '2026-05-01T14:00:00Z', logoutAt: '2026-05-01T18:00:00Z', driveHours: 5 }),
        shift({ driver: 'Bob',   loginAt: '2026-05-01T04:00:00Z', logoutAt: '2026-05-01T10:00:00Z', driveHours: 5 }),
      ],
      { threshold: 10, label: 'Drive Hr/day > 10 h' },
      new Map(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].driver).toBe('Alice');
    expect(rows[0].driveHours).toBe(11);
    expect(rows[0].metric).toBe('drive_hrs');
    expect(rows[0].threshold).toBe(10);
    expect(rows[0].thresholdLabel).toBe('Drive Hr/day > 10 h');
    expect(rows[0].shiftCount).toBe(2);
    expect(rows[0].vehicleCount).toBe(1);
    expect(rows[0].vehicle).toBe('V1');
    expect(rows[0].dayKey).toBe('2026-05-01');
    expect(rows[0].violationKey).toMatch(/^[0-9a-f]{40}$/);
  });

  it('marks vehicle as "*" when multiple vehicles in the day', () => {
    const rows = buildDriveHoursViolations(
      [
        shift({ driver: 'Alice', loginAt: '2026-05-01T04:00:00Z', logoutAt: '2026-05-01T10:00:00Z', driveHours: 6, vehicle: 'V1' }),
        shift({ driver: 'Alice', loginAt: '2026-05-01T14:00:00Z', logoutAt: '2026-05-01T18:00:00Z', driveHours: 5, vehicle: 'V2' }),
      ],
      { threshold: 10, label: 'x' },
      new Map(),
    );
    expect(rows[0].vehicleCount).toBe(2);
    expect(rows[0].vehicle).toBe('*');
  });

  it('attaches an existing warning if violationKey matches', () => {
    const map = new Map([
      ['placeholder', { sentAt: new Date('2026-05-01T12:00:00Z'), channelName: 'Bangkok Ops' }],
    ]);
    const rows = buildDriveHoursViolations(
      [shift({ driver: 'Alice', loginAt: '2026-05-01T04:00:00Z', logoutAt: '2026-05-01T18:00:00Z', driveHours: 12 })],
      { threshold: 10, label: 'x' },
      map,
    );
    expect(rows[0].warning).toBeNull();

    const realKey = rows[0].violationKey;
    map.set(realKey, { sentAt: new Date('2026-05-01T12:00:00Z'), channelName: 'Bangkok Ops' });
    const rows2 = buildDriveHoursViolations(
      [shift({ driver: 'Alice', loginAt: '2026-05-01T04:00:00Z', logoutAt: '2026-05-01T18:00:00Z', driveHours: 12 })],
      { threshold: 10, label: 'x' },
      map,
    );
    expect(rows2[0].warning?.channelName).toBe('Bangkok Ops');
  });
});

describe('buildRestHoursViolations', () => {
  it('emits one row per shift where restHours > 0 AND restHours < threshold', () => {
    const rows = buildRestHoursViolations(
      [
        shift({ driver: 'Alice', loginAt: '2026-05-01T04:00:00Z', logoutAt: '2026-05-01T12:00:00Z', driveHours: 6, restHours: 8 }),
        shift({ driver: 'Alice', loginAt: '2026-05-02T04:00:00Z', logoutAt: '2026-05-02T12:00:00Z', driveHours: 6, restHours: 12 }),
        shift({ driver: 'Alice', loginAt: '2026-05-03T04:00:00Z', logoutAt: '2026-05-03T12:00:00Z', driveHours: 6, restHours: 0 }),
      ],
      { threshold: 10, label: 'Rest Hr < 10 h' },
      new Map(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].driver).toBe('Alice');
    expect(rows[0].restHours).toBe(8);
    expect(rows[0].metric).toBe('rest_hrs');
    expect(rows[0].shiftCount).toBe(1);
    expect(rows[0].vehicleCount).toBe(1);
  });
});

import { describe, expect, it } from 'vitest';
import { bucketByDriverDay, type DriverDay } from './driverDayBucketing';

function row(
  partial: { driver: string; loginAt: string; logoutAt: string; driveHours: number; restHours?: number; vehicle?: string; distanceKm?: number; loginLocation?: string; logoutLocation?: string; status?: string },
) {
  return {
    sourceRow: {},
    driver: partial.driver,
    vehicle: partial.vehicle ?? 'V1',
    date: new Date(partial.loginAt),
    loginAt: new Date(partial.loginAt),
    logoutAt: new Date(partial.logoutAt),
    loginLocation: partial.loginLocation ?? 'L1',
    logoutLocation: partial.logoutLocation ?? 'L2',
    driveHours: partial.driveHours,
    workingHours: 0,
    restHours: partial.restHours ?? 0,
    distanceKm: partial.distanceKm ?? 0,
    status: partial.status ?? 'COMPLETED',
  };
}

describe('bucketByDriverDay', () => {
  it('buckets a single shift into a single (driver, day)', () => {
    const out = bucketByDriverDay([
      row({ driver: 'Alice', loginAt: '2026-05-01T04:00:00Z', logoutAt: '2026-05-01T12:00:00Z', driveHours: 6 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].driver).toBe('Alice');
    expect(out[0].dayKey).toBe('2026-05-01');
    expect(out[0].totalDriveHours).toBe(6);
    expect(out[0].shifts).toHaveLength(1);
  });

  it('sums driveHours across multiple shifts in the same (driver, day)', () => {
    const out = bucketByDriverDay([
      row({ driver: 'Alice', loginAt: '2026-05-01T04:00:00Z', logoutAt: '2026-05-01T08:00:00Z', driveHours: 4, distanceKm: 100 }),
      row({ driver: 'Alice', loginAt: '2026-05-01T13:00:00Z', logoutAt: '2026-05-01T17:00:00Z', driveHours: 3.5, distanceKm: 80, vehicle: 'V2' }),
      row({ driver: 'Alice', loginAt: '2026-05-01T20:00:00Z', logoutAt: '2026-05-01T23:00:00Z', driveHours: 2.5, distanceKm: 60 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].totalDriveHours).toBe(10);
    expect(out[0].totalDistanceKm).toBe(240);
    expect(out[0].shifts).toHaveLength(3);
    expect(out[0].vehicleCount).toBe(2);
    expect(out[0].firstLoginAt?.toISOString()).toBe('2026-05-01T04:00:00.000Z');
    expect(out[0].lastLogoutAt?.toISOString()).toBe('2026-05-01T23:00:00.000Z');
    expect(out[0].firstLoginLocation).toBe('L1');
    expect(out[0].lastLogoutLocation).toBe('L2');
  });

  it('separates shifts across different days', () => {
    const out = bucketByDriverDay([
      row({ driver: 'Alice', loginAt: '2026-05-01T04:00:00Z', logoutAt: '2026-05-01T08:00:00Z', driveHours: 4 }),
      row({ driver: 'Alice', loginAt: '2026-05-02T04:00:00Z', logoutAt: '2026-05-02T08:00:00Z', driveHours: 4 }),
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((d) => d.dayKey).sort()).toEqual(['2026-05-01', '2026-05-02']);
  });

  it('separates shifts across different drivers', () => {
    const out = bucketByDriverDay([
      row({ driver: 'Alice', loginAt: '2026-05-01T04:00:00Z', logoutAt: '2026-05-01T08:00:00Z', driveHours: 4 }),
      row({ driver: 'Bob', loginAt: '2026-05-01T04:00:00Z', logoutAt: '2026-05-01T08:00:00Z', driveHours: 4 }),
    ]);
    expect(out).toHaveLength(2);
    expect(new Set(out.map((d) => d.driver))).toEqual(new Set(['Alice', 'Bob']));
  });

  it('skips shifts with status != COMPLETED', () => {
    const out = bucketByDriverDay([
      row({ driver: 'Alice', loginAt: '2026-05-01T04:00:00Z', logoutAt: '2026-05-01T08:00:00Z', driveHours: 4, status: 'ONGOING' }),
    ]);
    expect(out).toHaveLength(0);
  });

  it('skips shifts with null loginAt', () => {
    const shifts = [{
      sourceRow: {}, driver: 'Alice', vehicle: 'V1',
      date: null, loginAt: null, logoutAt: null, loginLocation: '', logoutLocation: '',
      driveHours: 4, workingHours: 0, restHours: 0, distanceKm: 0, status: 'COMPLETED',
    }];
    const out: DriverDay[] = bucketByDriverDay(shifts);
    expect(out).toHaveLength(0);
  });

  it('splits drive hours across calendar days when a shift crosses midnight', () => {
    const out = bucketByDriverDay([
      row({
        driver: 'Alice',
        loginAt: '2026-05-01T22:00:00Z',
        logoutAt: '2026-05-02T06:00:00Z',
        driveHours: 8,
        distanceKm: 800,
      }),
    ]).sort((a, b) => a.dayKey.localeCompare(b.dayKey));

    expect(out).toHaveLength(2);
    expect(out[0].dayKey).toBe('2026-05-01');
    expect(out[0].totalDriveHours).toBe(2);
    expect(out[0].totalDistanceKm).toBe(200);
    expect(out[0].shifts).toHaveLength(1);

    expect(out[1].dayKey).toBe('2026-05-02');
    expect(out[1].totalDriveHours).toBe(6);
    expect(out[1].totalDistanceKm).toBe(600);
    expect(out[1].shifts).toHaveLength(0);
    expect(out[1].vehicleCount).toBe(1);
  });

  it('counts the shift only on the login day when split across midnight', () => {
    const out = bucketByDriverDay([
      row({
        driver: 'Alice',
        loginAt: '2026-05-01T22:00:00Z',
        logoutAt: '2026-05-02T06:00:00Z',
        driveHours: 8,
      }),
      row({
        driver: 'Alice',
        loginAt: '2026-05-02T08:00:00Z',
        logoutAt: '2026-05-02T12:00:00Z',
        driveHours: 4,
      }),
    ]).sort((a, b) => a.dayKey.localeCompare(b.dayKey));

    const may1 = out.find((d) => d.dayKey === '2026-05-01');
    const may2 = out.find((d) => d.dayKey === '2026-05-02');
    expect(may1?.shifts).toHaveLength(1);
    expect(may2?.shifts).toHaveLength(1);
    expect(may2?.totalDriveHours).toBe(10);
  });
});

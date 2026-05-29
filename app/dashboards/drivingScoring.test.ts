import { describe, expect, it } from 'vitest';
import { severityForDriverDay, computeDrivingScore, gradeFromScore } from './drivingScoring';
import type { DriverDay } from './driverDayBucketing';

function day(o: { driver: string; dayKey: string; totalDriveHours: number; shifts: Array<{ restHours: number }> }): DriverDay {
  return {
    driver: o.driver,
    dayKey: o.dayKey,
    totalDriveHours: o.totalDriveHours,
    totalDistanceKm: 0,
    firstLoginAt: new Date(`${o.dayKey}T04:00:00Z`),
    lastLogoutAt: new Date(`${o.dayKey}T20:00:00Z`),
    firstLoginLocation: '',
    lastLogoutLocation: '',
    vehicleCount: 1,
    vehicleSummary: 'V1',
    shifts: o.shifts.map((s) => ({
      sourceRow: {}, driver: o.driver, vehicle: 'V1',
      loginAt: new Date(`${o.dayKey}T04:00:00Z`), logoutAt: new Date(`${o.dayKey}T20:00:00Z`),
      loginLocation: '', logoutLocation: '',
      driveHours: 0, restHours: s.restHours, distanceKm: 0, status: 'COMPLETED',
    })),
  };
}

describe('severityForDriverDay', () => {
  const thresholds = { driveHours: [4, 10], restHours: [6, 10], cntDrvHours: [4] };

  it('drive: 0 when total ≤ lowest threshold', () => {
    expect(severityForDriverDay(day({ driver: 'A', dayKey: '2026-05-01', totalDriveHours: 3.5, shifts: [{ restHours: 12 }] }), thresholds).drive).toBe(0);
  });
  it('drive: 1 when total is between thresholds', () => {
    expect(severityForDriverDay(day({ driver: 'A', dayKey: '2026-05-01', totalDriveHours: 7, shifts: [{ restHours: 12 }] }), thresholds).drive).toBe(1);
  });
  it('drive: 3 when total exceeds the highest threshold', () => {
    expect(severityForDriverDay(day({ driver: 'A', dayKey: '2026-05-01', totalDriveHours: 11, shifts: [{ restHours: 12 }] }), thresholds).drive).toBe(3);
  });

  it('rest: 0 when worst shift gap ≥ highest threshold', () => {
    expect(severityForDriverDay(day({ driver: 'A', dayKey: '2026-05-01', totalDriveHours: 3, shifts: [{ restHours: 12 }, { restHours: 15 }] }), thresholds).rest).toBe(0);
  });
  it('rest: 3 when worst shift gap < lowest threshold', () => {
    expect(severityForDriverDay(day({ driver: 'A', dayKey: '2026-05-01', totalDriveHours: 3, shifts: [{ restHours: 5 }, { restHours: 12 }] }), thresholds).rest).toBe(3);
  });
  it('rest: 1 when worst is between thresholds', () => {
    expect(severityForDriverDay(day({ driver: 'A', dayKey: '2026-05-01', totalDriveHours: 3, shifts: [{ restHours: 8 }, { restHours: 12 }] }), thresholds).rest).toBe(1);
  });
  it('rest: ignores restHours == 0 (last shift)', () => {
    expect(severityForDriverDay(day({ driver: 'A', dayKey: '2026-05-01', totalDriveHours: 3, shifts: [{ restHours: 0 }, { restHours: 12 }] }), thresholds).rest).toBe(0);
  });
});

describe('computeDrivingScore', () => {
  it('returns 100 for no violations', () => {
    const rows = [{
      sourceRow: {}, driver: 'A', vehicle: 'V1', date: null,
      loginAt: new Date('2026-05-01T04:00:00Z'), logoutAt: new Date('2026-05-01T08:00:00Z'),
      loginLocation: '', logoutLocation: '',
      driveHours: 3, workingHours: 0, restHours: 12, distanceKm: 0, status: 'COMPLETED' as const,
    }];
    const out = computeDrivingScore(rows, { driveHours: [4], restHours: [10], cntDrvHours: [4] });
    expect(out.score).toBe(100);
    expect(out.grade).toBe('A');
  });

  it('clamps to 0 when every metric is critical', () => {
    const rows = [{
      sourceRow: {}, driver: 'A', vehicle: 'V1', date: null,
      loginAt: new Date('2026-05-01T04:00:00Z'), logoutAt: new Date('2026-05-01T20:00:00Z'),
      loginLocation: '', logoutLocation: '',
      driveHours: 12, workingHours: 0, restHours: 1, distanceKm: 0, status: 'COMPLETED' as const,
    }];
    const out = computeDrivingScore(rows, { driveHours: [4, 10], restHours: [6, 10], cntDrvHours: [4] });
    expect(out.score).toBeLessThanOrEqual(0);
    expect(out.grade).toBe('F');
  });
});

describe('gradeFromScore', () => {
  it.each([
    [100, 'A'],
    [95, 'A'],
    [89, 'B'],
    [70, 'C'],
    [50, 'D'],
    [30, 'F'],
    [0, 'F'],
  ])('score %i → %s', (s, g) => {
    expect(gradeFromScore(s as number)).toBe(g);
  });
});

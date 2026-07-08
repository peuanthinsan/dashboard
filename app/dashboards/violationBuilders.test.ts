import { describe, expect, it } from 'vitest';
import { computeViolationKey, parseDate } from './dashboardDataUtils';
import {
  buildCntDrvHoursViolations,
  buildDriveHoursViolations,
  buildRestHoursViolations,
} from './violationBuilders';

function shift(o: {
  driver: string; loginAt: string; logoutAt: string; driveHours: number; restHours?: number;
  vehicle?: string; distanceKm?: number; status?: string; loginLocation?: string; logoutLocation?: string;
  slNo?: string;
}) {
  return {
    sourceRow: {},
    slNo: o.slNo ?? '1',
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

describe('buildCntDrvHoursViolations', () => {
  function segment(o: {
    driver: string; loginAt: string; logoutAt: string; cntDrvHours: number;
    vehicle?: string; distanceKm?: number; slNo?: string;
  }) {
    return {
      sourceRow: {},
      slNo: o.slNo ?? '1',
      driver: o.driver,
      vehicle: o.vehicle ?? 'V1',
      date: new Date(o.loginAt),
      loginAt: new Date(o.loginAt),
      logoutAt: new Date(o.logoutAt),
      loginLocation: 'Start',
      logoutLocation: 'End',
      cntDrvHours: o.cntDrvHours,
      distanceKm: o.distanceKm ?? 10,
    };
  }

  it('carries the sheet SlNo through to the violation row', () => {
    const rows = buildCntDrvHoursViolations(
      [segment({ driver: 'Alice', loginAt: '2026-05-01T04:00:00Z', logoutAt: '2026-05-01T10:00:00Z', cntDrvHours: 5, slNo: '2115' })],
      { threshold: 4, label: 'Cnt Drv > 4 h' },
      new Map(),
    );
    expect(rows[0].slNo).toBe('2115');
  });

  it('supports drive_hrs metric for continuous-drive segments', () => {
    const rows = buildCntDrvHoursViolations(
      [segment({ driver: 'Alice', loginAt: '2026-05-01T04:00:00Z', logoutAt: '2026-05-01T10:00:00Z', cntDrvHours: 11 })],
      { threshold: 10, label: 'Drive Hr/day > 10 h' },
      new Map(),
      'drive_hrs',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].metric).toBe('drive_hrs');
    expect(rows[0].driveHours).toBe(11);
  });

  it('returns only violations by default (> threshold)', () => {
    const rows = buildCntDrvHoursViolations(
      [
        segment({ driver: 'Alice', loginAt: '2026-05-01T04:00:00Z', logoutAt: '2026-05-01T10:00:00Z', cntDrvHours: 4.5 }),
        segment({ driver: 'Bob', loginAt: '2026-05-01T04:00:00Z', logoutAt: '2026-05-01T08:00:00Z', cntDrvHours: 3.2 }),
        segment({ driver: 'Carl', loginAt: '2026-05-01T04:00:00Z', logoutAt: '2026-05-01T08:00:00Z', cntDrvHours: 0 }),
      ],
      { threshold: 4, label: 'Cnt Drv > 4 h' },
      new Map(),
    );
    expect(rows.map((r) => r.driver)).toEqual(['Alice']);
  });

  it('returns ALL segments with data when violationsOnly is false (0-hour rows excluded)', () => {
    const rows = buildCntDrvHoursViolations(
      [
        segment({ driver: 'Alice', loginAt: '2026-05-01T04:00:00Z', logoutAt: '2026-05-01T10:00:00Z', cntDrvHours: 4.5 }),
        segment({ driver: 'Bob', loginAt: '2026-05-01T04:00:00Z', logoutAt: '2026-05-01T08:00:00Z', cntDrvHours: 3.2 }),
        segment({ driver: 'Carl', loginAt: '2026-05-01T04:00:00Z', logoutAt: '2026-05-01T08:00:00Z', cntDrvHours: 0 }),
      ],
      { threshold: 4, label: 'Cnt Drv > 4 h' },
      new Map(),
      'cnt_drv_hrs',
      false,
    );
    expect(rows.map((r) => r.driver).sort()).toEqual(['Alice', 'Bob']);
  });
});

describe('buildDriveHoursViolations', () => {
  it('emits one row per (driver, day) where the SUM driveHours > threshold', () => {
    const rows = buildDriveHoursViolations(
      [
        shift({ driver: 'Alice', loginAt: '2026-05-01T04:00:00Z', logoutAt: '2026-05-01T10:00:00Z', driveHours: 6 }),
        shift({ driver: 'Alice', loginAt: '2026-05-01T14:00:00Z', logoutAt: '2026-05-01T18:00:00Z', driveHours: 5 }),
        shift({ driver: 'Bob', loginAt: '2026-05-01T04:00:00Z', logoutAt: '2026-05-01T10:00:00Z', driveHours: 5 }),
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
    expect(rows).toHaveLength(1);
    expect(rows[0].vehicleCount).toBe(2);
    expect(rows[0].vehicle).toBe('*');
  });

  it('skips non-completed shifts', () => {
    const rows = buildDriveHoursViolations(
      [
        shift({
          driver: 'Alice',
          loginAt: '2026-05-01T22:00:00Z',
          logoutAt: '2026-05-02T06:00:00Z',
          driveHours: 8,
          status: 'IN PROGRESS',
        }),
      ],
      { threshold: 5, label: 'Drive Hr > 5 h' },
      new Map(),
    );
    expect(rows).toHaveLength(0);
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

describe('pre-dawn Bangkok logins keep their sheet calendar day (Invariant 2)', () => {
  // A login before 07:00 Bangkok is the case where mixing the two timezone
  // conventions shifts the day: 01:30 Bangkok read as a true instant is 18:30
  // the PREVIOUS day in UTC. parseDate stamps the sheet's Bangkok digits as
  // UTC digits, so dayKey/dateLabel/eventAt (and therefore violationKey) must
  // stay on the sheet's own calendar day for every viewer/runner timezone.
  const loginAt = parseDate('01/07/2026 01:30:00')!;
  const logoutAt = parseDate('01/07/2026 09:30:00')!;

  it('buildRestHoursViolations keeps a 01:30 login on 01/07', () => {
    const rows = buildRestHoursViolations(
      [
        {
          sourceRow: {},
          slNo: '7',
          driver: 'Alice',
          vehicle: 'V1',
          date: loginAt,
          loginAt,
          logoutAt,
          loginLocation: 'L1',
          logoutLocation: 'L2',
          driveHours: 6,
          workingHours: 0,
          restHours: 8,
          distanceKm: 120,
          status: 'COMPLETED',
        },
      ],
      { threshold: 10, label: 'Rest Hr < 10 h' },
      new Map(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].dayKey).toBe('2026-07-01');
    expect(rows[0].dateLabel).toBe('01/07/2026');
    expect(rows[0].eventAt.toISOString()).toBe('2026-07-01T01:30:00.000Z');
    expect(rows[0].violationKey).toBe(
      computeViolationKey({
        metric: 'rest_hrs',
        driver: 'Alice',
        vehicle: 'V1',
        eventAtIso: '2026-07-01T01:30:00.000Z',
        threshold: 10,
      }),
    );
  });

  it('buildCntDrvHoursViolations keeps a 01:30 login on 01/07', () => {
    const rows = buildCntDrvHoursViolations(
      [
        {
          sourceRow: {},
          slNo: '7',
          driver: 'Alice',
          vehicle: 'V1',
          date: loginAt,
          loginAt,
          logoutAt,
          loginLocation: 'L1',
          logoutLocation: 'L2',
          cntDrvHours: 5,
          distanceKm: 120,
        },
      ],
      { threshold: 4, label: 'Cnt Drv > 4 h' },
      new Map(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].dayKey).toBe('2026-07-01');
    expect(rows[0].dateLabel).toBe('01/07/2026');
    expect(rows[0].eventAt.toISOString()).toBe('2026-07-01T01:30:00.000Z');
    expect(rows[0].violationKey).toBe(
      computeViolationKey({
        metric: 'cnt_drv_hrs',
        driver: 'Alice',
        vehicle: 'V1',
        eventAtIso: '2026-07-01T01:30:00.000Z',
        threshold: 4,
      }),
    );
  });

  it('buildDriveHoursViolations day-buckets a 01:30 login on 01/07', () => {
    const rows = buildDriveHoursViolations(
      [
        {
          sourceRow: {},
          slNo: '7',
          driver: 'Alice',
          vehicle: 'V1',
          date: loginAt,
          loginAt,
          logoutAt,
          loginLocation: 'L1',
          logoutLocation: 'L2',
          driveHours: 6,
          workingHours: 0,
          restHours: 0,
          distanceKm: 120,
          status: 'COMPLETED',
        },
      ],
      { threshold: 5, label: 'Drive Hr/day > 5 h' },
      new Map(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].dayKey).toBe('2026-07-01');
    expect(rows[0].dateLabel).toBe('01/07/2026');
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

  it('returns ALL rested shifts when violationsOnly is false (rest>=threshold included, 0-rest excluded)', () => {
    const rows = buildRestHoursViolations(
      [
        shift({ driver: 'Alice', loginAt: '2026-05-01T04:00:00Z', logoutAt: '2026-05-01T12:00:00Z', driveHours: 6, restHours: 8 }),
        shift({ driver: 'Alice', loginAt: '2026-05-02T04:00:00Z', logoutAt: '2026-05-02T12:00:00Z', driveHours: 6, restHours: 12 }),
        shift({ driver: 'Alice', loginAt: '2026-05-03T04:00:00Z', logoutAt: '2026-05-03T12:00:00Z', driveHours: 6, restHours: 0 }),
      ],
      { threshold: 10, label: 'Rest Hr < 10 h' },
      new Map(),
      false,
    );
    expect(rows.map((r) => r.restHours).sort((a, b) => a - b)).toEqual([8, 12]);
  });
});

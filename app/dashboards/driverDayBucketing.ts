import { toDayKey } from './dashboardDataUtils';

type DrivingShiftLike = {
  driver: string;
  vehicle: string;
  loginAt: Date | null;
  logoutAt: Date | null;
  loginLocation: string;
  logoutLocation: string;
  driveHours: number;
  restHours: number;
  distanceKm: number;
  status: string;
};

export type DriverDay = {
  driver: string;
  dayKey: string;
  totalDriveHours: number;
  totalDistanceKm: number;
  firstLoginAt: Date | null;
  lastLogoutAt: Date | null;
  firstLoginLocation: string;
  lastLogoutLocation: string;
  vehicleCount: number;
  vehicleSummary: string;
  shifts: DrivingShiftLike[];
};

type DayShare = { driveHours: number; distanceKm: number };

function parseDayKey(dayKey: string): Date {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function startOfNextCalendarDay(dayKey: string): Date {
  const next = parseDayKey(dayKey);
  next.setDate(next.getDate() + 1);
  return next;
}

/** Split drive hours / distance across calendar days proportional to elapsed time. */
export function splitShiftByCalendarDay(
  loginAt: Date,
  logoutAt: Date | null,
  driveHours: number,
  distanceKm: number,
): Map<string, DayShare> {
  const loginDayKey = toDayKey(loginAt);
  if (!logoutAt || logoutAt.getTime() <= loginAt.getTime()) {
    return new Map([[loginDayKey, { driveHours, distanceKm }]]);
  }

  const totalMs = logoutAt.getTime() - loginAt.getTime();
  const msByDay = new Map<string, number>();
  let cursor = loginAt.getTime();
  const end = logoutAt.getTime();

  while (cursor < end) {
    const dayKey = toDayKey(new Date(cursor));
    const nextMidnight = startOfNextCalendarDay(dayKey).getTime();
    const segmentEnd = Math.min(end, nextMidnight);
    msByDay.set(dayKey, (msByDay.get(dayKey) ?? 0) + (segmentEnd - cursor));
    cursor = segmentEnd;
  }

  if (msByDay.size <= 1) {
    return new Map([[loginDayKey, { driveHours, distanceKm }]]);
  }

  const entries = [...msByDay.entries()];
  const result = new Map<string, DayShare>();
  let allocatedHours = 0;
  let allocatedDistance = 0;

  for (let i = 0; i < entries.length; i++) {
    const [dayKey, ms] = entries[i];
    const isLast = i === entries.length - 1;
    const shareHours = isLast
      ? round2(driveHours - allocatedHours)
      : round2(driveHours * (ms / totalMs));
    const shareDistance = isLast
      ? round1(distanceKm - allocatedDistance)
      : round1(distanceKm * (ms / totalMs));
    allocatedHours += shareHours;
    allocatedDistance += shareDistance;
    result.set(dayKey, { driveHours: shareHours, distanceKm: shareDistance });
  }

  return result;
}

type Bucket<T> = DriverDay & { shifts: T[]; carryoverVehicles: Set<string> };

function ensureBucket<T>(
  buckets: Map<string, Bucket<T>>,
  driver: string,
  dayKey: string,
): Bucket<T> {
  const bucketKey = `${driver}|${dayKey}`;
  let bucket = buckets.get(bucketKey);
  if (!bucket) {
    bucket = {
      driver,
      dayKey,
      totalDriveHours: 0,
      totalDistanceKm: 0,
      firstLoginAt: null,
      lastLogoutAt: null,
      firstLoginLocation: '',
      lastLogoutLocation: '',
      vehicleCount: 0,
      vehicleSummary: '',
      shifts: [],
      carryoverVehicles: new Set(),
    };
    buckets.set(bucketKey, bucket);
  }
  return bucket;
}

function trackLoginLogout<T extends DrivingShiftLike>(bucket: Bucket<T>, shift: T) {
  if (!shift.loginAt) return;
  if (!bucket.firstLoginAt || shift.loginAt.getTime() < bucket.firstLoginAt.getTime()) {
    bucket.firstLoginAt = shift.loginAt;
    bucket.firstLoginLocation = shift.loginLocation;
  }
  if (shift.logoutAt && (!bucket.lastLogoutAt || shift.logoutAt.getTime() > bucket.lastLogoutAt.getTime())) {
    bucket.lastLogoutAt = shift.logoutAt;
    bucket.lastLogoutLocation = shift.logoutLocation;
  }
}

export function bucketByDriverDay<T extends DrivingShiftLike>(rows: T[]): DriverDay[] {
  const buckets = new Map<string, Bucket<T>>();

  for (const shift of rows) {
    if (shift.status !== 'COMPLETED') continue;
    if (!shift.loginAt) continue;

    const loginDayKey = toDayKey(shift.loginAt);
    const dayShares = splitShiftByCalendarDay(
      shift.loginAt,
      shift.logoutAt,
      shift.driveHours,
      shift.distanceKm,
    );

    for (const [dayKey, share] of dayShares) {
      const bucket = ensureBucket(buckets, shift.driver, dayKey);
      bucket.totalDriveHours += share.driveHours;
      bucket.totalDistanceKm += share.distanceKm;

      if (dayKey === loginDayKey) {
        bucket.shifts.push(shift);
        trackLoginLogout(bucket, shift);
      } else if (shift.vehicle && shift.vehicle !== '—') {
        bucket.carryoverVehicles.add(shift.vehicle);
      }
    }
  }

  return Array.from(buckets.values()).map((bucket) => {
    const vehicles = new Set([
      ...bucket.shifts.map((s) => s.vehicle).filter((v) => v && v !== '—'),
      ...bucket.carryoverVehicles,
    ]);
    const vehicleCount = vehicles.size;
    const vehicleSummary = vehicleCount === 1
      ? (vehicles.values().next().value as string)
      : `${vehicleCount} vehicles`;
    return {
      driver: bucket.driver,
      dayKey: bucket.dayKey,
      totalDriveHours: round2(bucket.totalDriveHours),
      totalDistanceKm: round1(bucket.totalDistanceKm),
      firstLoginAt: bucket.firstLoginAt,
      lastLogoutAt: bucket.lastLogoutAt,
      firstLoginLocation: bucket.firstLoginLocation,
      lastLogoutLocation: bucket.lastLogoutLocation,
      vehicleCount,
      vehicleSummary,
      shifts: bucket.shifts,
    };
  });
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
function round1(n: number): number { return Math.round(n * 10) / 10; }

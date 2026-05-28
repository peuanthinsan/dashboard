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

export function bucketByDriverDay<T extends DrivingShiftLike>(rows: T[]): DriverDay[] {
  const buckets = new Map<string, DriverDay & { shifts: T[] }>();

  for (const r of rows) {
    if (r.status !== 'COMPLETED') continue;
    if (!r.loginAt) continue;
    const dayKey = toDayKey(r.loginAt);
    const bucketKey = `${r.driver}|${dayKey}`;
    let b = buckets.get(bucketKey);
    if (!b) {
      b = {
        driver: r.driver,
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
      };
      buckets.set(bucketKey, b);
    }
    b.shifts.push(r);
    b.totalDriveHours += r.driveHours;
    b.totalDistanceKm += r.distanceKm;
    if (!b.firstLoginAt || (r.loginAt && r.loginAt.getTime() < b.firstLoginAt.getTime())) {
      b.firstLoginAt = r.loginAt;
      b.firstLoginLocation = r.loginLocation;
    }
    if (!b.lastLogoutAt || (r.logoutAt && r.logoutAt.getTime() > b.lastLogoutAt.getTime())) {
      b.lastLogoutAt = r.logoutAt;
      b.lastLogoutLocation = r.logoutLocation;
    }
  }

  return Array.from(buckets.values()).map((b) => {
    const vehicles = new Set(b.shifts.map((s) => s.vehicle).filter((v) => v && v !== '—'));
    const vehicleCount = vehicles.size;
    const vehicleSummary = vehicleCount === 1
      ? (vehicles.values().next().value as string)
      : `${vehicleCount} vehicles`;
    return {
      driver: b.driver,
      dayKey: b.dayKey,
      totalDriveHours: round2(b.totalDriveHours),
      totalDistanceKm: round1(b.totalDistanceKm),
      firstLoginAt: b.firstLoginAt,
      lastLogoutAt: b.lastLogoutAt,
      firstLoginLocation: b.firstLoginLocation,
      lastLogoutLocation: b.lastLogoutLocation,
      vehicleCount,
      vehicleSummary,
      shifts: b.shifts,
    };
  });
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
function round1(n: number): number { return Math.round(n * 10) / 10; }

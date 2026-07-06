import { computeViolationKey, type ViolationMetric, type ViolationRow } from './dashboardDataUtils';
import { bucketByDriverDay } from './driverDayBucketing';
import type { DrivingCntDrvRow } from './drivingSheetRows';

type ShiftRow = {
  sourceRow: Record<string, unknown>;
  driver: string;
  vehicle: string;
  date: Date | null;
  loginAt: Date | null;
  logoutAt: Date | null;
  loginLocation: string;
  logoutLocation: string;
  driveHours: number;
  workingHours: number;
  restHours: number;
  distanceKm: number;
  status: string;
};

type ThresholdSpec = { threshold: number; label: string };

type WarningMap = Map<string, { sentAt: Date; channelName: string }>;

function formatDateLabel(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Returns ALL driver-day rows (no threshold filter). Rows exceeding the
 * threshold should be highlighted by the caller — use `row.driveHours > row.threshold`.
 */
export function buildDriveHoursRows(
  shifts: ShiftRow[],
  spec: ThresholdSpec,
  warnings: WarningMap,
): ViolationRow[] {
  return buildDriveHoursViolations(shifts, spec, warnings, false);
}

export function buildDriveHoursViolations(
  shifts: ShiftRow[],
  spec: ThresholdSpec,
  warnings: WarningMap,
  violationsOnly = true,
): ViolationRow[] {
  const days = bucketByDriverDay(shifts);
  const out: ViolationRow[] = [];
  for (const day of days) {
    if (violationsOnly && day.totalDriveHours <= spec.threshold) continue;
    const eventAt = new Date(`${day.dayKey}T00:00:00.000Z`);
    const vehicle = day.vehicleCount === 1 ? day.vehicleSummary : '*';
    const violationKey = computeViolationKey({
      metric: 'drive_hrs',
      driver: day.driver,
      vehicle,
      eventAtIso: eventAt.toISOString(),
      threshold: spec.threshold,
    });
    out.push({
      driver: day.driver,
      vehicle,
      vehicleCount: day.vehicleCount,
      shiftCount: day.shifts.length,
      dayKey: day.dayKey,
      dateLabel: formatDateLabel(day.firstLoginAt ?? eventAt),
      eventAt,
      driveHours: day.totalDriveHours,
      restHours: 0,
      distanceKm: day.totalDistanceKm,
      loginAt: day.firstLoginAt,
      logoutAt: day.lastLogoutAt,
      _loginAtMs: (day.firstLoginAt ?? eventAt).getTime(),
      loginLocation: day.firstLoginLocation,
      logoutLocation: day.lastLogoutLocation,
      metric: 'drive_hrs',
      threshold: spec.threshold,
      thresholdLabel: spec.label,
      violationKey,
      warning: warnings.get(violationKey) ?? null,
    });
  }
  return out;
}

export function buildRestHoursViolations(
  shifts: ShiftRow[],
  spec: ThresholdSpec,
  warnings: WarningMap,
): ViolationRow[] {
  const out: ViolationRow[] = [];
  for (const s of shifts) {
    if (s.status !== 'COMPLETED') continue;
    if (!s.loginAt) continue;
    if (s.restHours <= 0) continue;
    if (s.restHours >= spec.threshold) continue;
    const eventAtIso = s.loginAt.toISOString();
    const violationKey = computeViolationKey({
      metric: 'rest_hrs',
      driver: s.driver,
      vehicle: s.vehicle,
      eventAtIso,
      threshold: spec.threshold,
    });
    out.push({
      driver: s.driver,
      vehicle: s.vehicle,
      vehicleCount: 1,
      shiftCount: 1,
      dayKey: s.loginAt.toISOString().slice(0, 10),
      dateLabel: formatDateLabel(s.loginAt),
      eventAt: s.loginAt,
      driveHours: s.driveHours,
      restHours: s.restHours,
      distanceKm: s.distanceKm,
      loginAt: s.loginAt,
      logoutAt: s.logoutAt,
      _loginAtMs: s.loginAt.getTime(),
      loginLocation: s.loginLocation,
      logoutLocation: s.logoutLocation,
      metric: 'rest_hrs',
      threshold: spec.threshold,
      thresholdLabel: spec.label,
      violationKey,
      warning: warnings.get(violationKey) ?? null,
    });
  }
  return out;
}

export function buildCntDrvHoursViolations(
  segments: DrivingCntDrvRow[],
  spec: ThresholdSpec,
  warnings: WarningMap,
  metric: ViolationMetric = 'cnt_drv_hrs',
): ViolationRow[] {
  const out: ViolationRow[] = [];
  for (const s of segments) {
    if (!s.loginAt) continue;
    if (s.cntDrvHours <= spec.threshold) continue;
    const eventAtIso = s.loginAt.toISOString();
    const violationKey = computeViolationKey({
      metric,
      driver: s.driver,
      vehicle: s.vehicle,
      eventAtIso,
      threshold: spec.threshold,
    });
    out.push({
      driver: s.driver,
      vehicle: s.vehicle,
      vehicleCount: 1,
      shiftCount: 1,
      dayKey: s.loginAt.toISOString().slice(0, 10),
      dateLabel: formatDateLabel(s.loginAt),
      eventAt: s.loginAt,
      driveHours: s.cntDrvHours,
      restHours: 0,
      distanceKm: s.distanceKm,
      loginAt: s.loginAt,
      logoutAt: s.logoutAt,
      _loginAtMs: s.loginAt.getTime(),
      loginLocation: s.loginLocation,
      logoutLocation: s.logoutLocation,
      metric,
      threshold: spec.threshold,
      thresholdLabel: spec.label,
      violationKey,
      warning: warnings.get(violationKey) ?? null,
    });
  }
  return out;
}

import { computeViolationKey, type ViolationRow } from './dashboardDataUtils';
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
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function buildDriveHoursViolations(
  shifts: ShiftRow[],
  spec: ThresholdSpec,
  warnings: WarningMap,
): ViolationRow[] {
  const out: ViolationRow[] = [];
  for (const s of shifts) {
    if (s.status !== 'COMPLETED') continue;
    if (!s.loginAt) continue;
    if (s.driveHours <= spec.threshold) continue;
    const eventAtIso = s.loginAt.toISOString();
    const violationKey = computeViolationKey({
      metric: 'drive_hrs',
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
      restHours: 0,
      distanceKm: s.distanceKm,
      loginAt: s.loginAt,
      logoutAt: s.logoutAt,
      loginLocation: s.loginLocation,
      logoutLocation: s.logoutLocation,
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
): ViolationRow[] {
  const out: ViolationRow[] = [];
  for (const s of segments) {
    if (!s.loginAt) continue;
    if (s.cntDrvHours <= spec.threshold) continue;
    const eventAtIso = s.loginAt.toISOString();
    const violationKey = computeViolationKey({
      metric: 'cnt_drv_hrs',
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
      loginLocation: s.loginLocation,
      logoutLocation: s.logoutLocation,
      metric: 'cnt_drv_hrs',
      threshold: spec.threshold,
      thresholdLabel: spec.label,
      violationKey,
      warning: warnings.get(violationKey) ?? null,
    });
  }
  return out;
}

import { findValue, normalizeLabel, parseDate, toDisplayString } from './dashboardDataUtils';

export type DrivingShiftRow = {
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
  fleet?: string;
};

export function isCompletedShift(row: Pick<DrivingShiftRow, 'status'>): boolean {
  return row.status === 'COMPLETED';
}

export type DrivingCntDrvRow = {
  sourceRow: Record<string, unknown>;
  driver: string;
  vehicle: string;
  date: Date | null;
  loginAt: Date | null;
  logoutAt: Date | null;
  loginLocation: string;
  logoutLocation: string;
  cntDrvHours: number;
  distanceKm: number;
  fleet?: string;
};

const parseNumber = (value: unknown) => {
  if (value == null || value === '') return 0;
  const cleaned = String(value).replace(/,/g, '').trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const parseDurationHours = (value: unknown) => {
  if (value == null || value === '') return 0;
  const raw = String(value).trim();
  if (!raw) return 0;
  if (raw.includes(':')) {
    const parts = raw.split(':').map((part) => Number(part));
    if (parts.some((part) => Number.isNaN(part))) return 0;
    if (parts.length === 3) return parts[0] + parts[1] / 60 + parts[2] / 3600;
    if (parts.length === 2) return parts[0] + parts[1] / 60;
  }
  return parseNumber(raw);
};

function filterByFleet<T extends { fleet?: string }>(
  rows: T[],
  normalizedOrganizationName: string | null,
): T[] {
  if (!normalizedOrganizationName) return rows;
  return rows.filter((row) => normalizeLabel(row.fleet ?? '') === normalizedOrganizationName);
}

export function mapShiftSheetRows(
  rows: Record<string, unknown>[],
  normalizedOrganizationName: string | null,
): DrivingShiftRow[] {
  const mapped = rows.map((row) => ({
    sourceRow: row,
    driver: toDisplayString(findValue(row, ['Driver Name'])),
    vehicle: toDisplayString(findValue(row, ['Vehicle No', 'Vehicle No TH'])),
    date: parseDate(findValue(row, ['DateTime', 'Login Time', 'Date', 'Start Time'])),
    loginAt: parseDate(findValue(row, ['Login Time', 'Start Time', 'Login DateTime'])),
    logoutAt: parseDate(findValue(row, ['Logout Time', 'End Time', 'Logout DateTime'])),
    loginLocation: toDisplayString(findValue(row, ['Login Location', 'Start Location'])),
    logoutLocation: toDisplayString(findValue(row, ['Logout Location', 'End Location'])),
    driveHours: parseDurationHours(findValue(row, ['DriveHrs', 'DriveHrs duration'])),
    restHours: parseDurationHours(findValue(row, [
      'Rest Time', 'Rest Hr', 'RestHr', 'Rest Hour', 'Rest Hours', 'Rest duration', 'RestHrs', 'RestHrs duration',
    ])),
    workingHours: parseDurationHours(findValue(row, [
      'Working Hr', 'Working Hour', 'Working Hours',
      'Work Hr', 'Work Hour', 'Work Hours', 'Working Time', 'Work Time', 'Total Working',
      'WorkHrs', 'WorkHrs duration',
    ])),
    distanceKm: parseNumber(findValue(row, ['Distance', 'Distance KM', 'Distance(KM)'])),
    status: toDisplayString(findValue(row, ['Status'])).toUpperCase(),
    fleet: toDisplayString(findValue(row, ['Fleet'])),
  }));

  return filterByFleet(mapped, normalizedOrganizationName).map((row) => ({
    sourceRow: row.sourceRow,
    driver: row.driver,
    vehicle: row.vehicle,
    date: row.date,
    loginAt: row.loginAt,
    logoutAt: row.logoutAt,
    loginLocation: row.loginLocation,
    logoutLocation: row.logoutLocation,
    driveHours: row.driveHours,
    restHours: row.restHours,
    workingHours: row.workingHours,
    distanceKm: row.distanceKm,
    status: row.status,
  }));
}

export function mapCntDrvSheetRows(
  rows: Record<string, unknown>[],
  normalizedOrganizationName: string | null,
): DrivingCntDrvRow[] {
  const mapped = rows.map((row) => ({
    sourceRow: row,
    driver: toDisplayString(findValue(row, ['Driver Name'])),
    vehicle: toDisplayString(findValue(row, ['Vehicle No', 'Vehicle No TH'])),
    date: parseDate(findValue(row, ['DateTime', 'Start Time', 'Login Time', 'Date'])),
    loginAt: parseDate(findValue(row, ['Start Time', 'Login Time', 'Login DateTime'])),
    logoutAt: parseDate(findValue(row, ['End Time', 'Logout Time', 'Logout DateTime'])),
    loginLocation: toDisplayString(findValue(row, ['Start Location', 'Login Location'])),
    logoutLocation: toDisplayString(findValue(row, ['End Location', 'Logout Location'])),
    cntDrvHours: parseDurationHours(findValue(row, ['Cnt Drv Hr', 'Cnt Drv duration', 'Cnt Drv'])),
    distanceKm: parseNumber(findValue(row, ['Distance', 'Distance KM', 'Distance(KM)'])),
    fleet: toDisplayString(findValue(row, ['Fleet'])),
  }));

  return filterByFleet(mapped, normalizedOrganizationName);
}

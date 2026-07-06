import { findValue, normalizeLabel, parseDate, toDisplayString } from './dashboardDataUtils';

export type DrivingShiftRow = {
  sourceRow: Record<string, unknown>;
  slNo: string;
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

/** Row A / SlNo aliases across customer sheets. */
const SL_NO_ALIASES = ['SlNo', 'Sl No', 'Sl. No', 'SI No', 'No.', 'No', 'Serial', 'Seq'];

export function isCompletedShift(row: Pick<DrivingShiftRow, 'status'>): boolean {
  return row.status === 'COMPLETED';
}

export type DrivingCntDrvRow = {
  sourceRow: Record<string, unknown>;
  slNo: string;
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

/** Known exact labels for the continuous-driving-hours column (case-insensitive). */
const CNT_DRV_LABELS = [
  'Cnt Drv Hr',
  'Cnt Drv Hrs',
  'Cnt Drv Hours',
  'Cnt Drv duration',
  'Cnt Drv',
  'CntDrv Hr',
  'CntDrv Hrs',
  'Cnt.Drv Hr',
  'Cnt. Drv Hr',
  'Continuous Drv Hr',
  'Continuous Drv Hrs',
  'Continuous Driving Hr',
  'Continuous Driving Hrs',
  'Cont Drv Hr',
  'Cont Drv Hrs',
];

/**
 * Finds the continuous-driving-hours value from a row.
 *
 * Skips null/empty values at every step so that a column that exists in the
 * sheet but is unpopulated for a given row (e.g. "Cnt Drv Hr" datetime column
 * left blank on newer imports) doesn't shadow a populated sibling column
 * (e.g. "Cnt Drv duration" number column which contains the real value).
 */
function findCntDrvHoursValue(row: Record<string, unknown>): unknown {
  // Build a lowercase→original-key map once (mirrors getNormalizedKeyMap internals).
  const keyMap = new Map<string, string>();
  for (const key of Object.keys(row)) {
    const n = normalizeLabel(key);
    if (!keyMap.has(n)) keyMap.set(n, key);
  }

  // Exact-label scan: iterate ALL labels in priority order, skipping null/empty.
  for (const label of CNT_DRV_LABELS) {
    const key = keyMap.get(normalizeLabel(label));
    if (key) {
      const val = row[key];
      if (val != null && val !== '') return val;
    }
  }

  // Fuzzy fallback: scan all keys for anything that looks like a cnt-drv column,
  // skipping null/empty values so we don't stop at an unpopulated column.
  for (const key of Object.keys(row)) {
    const n = normalizeLabel(key);
    if (n.includes('cnt') && n.includes('drv')) {
      const val = row[key];
      if (val != null && val !== '') return val;
    }
    if (n.includes('continuous') && (n.includes('drv') || n.includes('driv'))) {
      const val = row[key];
      if (val != null && val !== '') return val;
    }
  }
  return null;
}

function filterByFleet<T extends { fleet?: string }>(
  rows: T[],
  normalizedFleetSet: Set<string>,
): T[] {
  if (normalizedFleetSet.size === 0) return rows;
  return rows.filter((row) => normalizedFleetSet.has(normalizeLabel(row.fleet ?? '')));
}

export function mapShiftSheetRows(
  rows: Record<string, unknown>[],
  normalizedFleetSet: Set<string>,
): DrivingShiftRow[] {
  const mapped = rows.map((row) => ({
    sourceRow: row,
    slNo: toDisplayString(findValue(row, SL_NO_ALIASES)),
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

  return filterByFleet(mapped, normalizedFleetSet).map((row) => ({
    sourceRow: row.sourceRow,
    slNo: row.slNo,
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
  normalizedFleetSet: Set<string>,
): DrivingCntDrvRow[] {
  const mapped = rows.map((row) => ({
    sourceRow: row,
    slNo: toDisplayString(findValue(row, SL_NO_ALIASES)),
    driver: toDisplayString(findValue(row, ['Driver Name'])),
    vehicle: toDisplayString(findValue(row, ['Vehicle No', 'Vehicle No TH'])),
    date: parseDate(findValue(row, ['DateTime', 'Start Time', 'Login Time', 'Date'])),
    loginAt: parseDate(findValue(row, ['Start Time', 'Login Time', 'Login DateTime'])),
    logoutAt: parseDate(findValue(row, ['End Time', 'Logout Time', 'Logout DateTime'])),
    loginLocation: toDisplayString(findValue(row, ['Start Location', 'Login Location'])),
    logoutLocation: toDisplayString(findValue(row, ['End Location', 'Logout Location'])),
    cntDrvHours: parseDurationHours(findCntDrvHoursValue(row)),
    distanceKm: parseNumber(findValue(row, ['Distance', 'Distance KM', 'Distance(KM)'])),
    fleet: toDisplayString(findValue(row, ['Fleet'])),
  }));

  return filterByFleet(mapped, normalizedFleetSet);
}

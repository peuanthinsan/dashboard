import type { GoogleSheetRow } from './googleSheetParse';

export type FuelReading = {
  id: string;
  vehicle: string;
  /** Bangkok wall-clock digits encoded as UTC, independent of viewer timezone. */
  timestamp: number;
  day: string;
  fuel: number | null;
  speed: number | null;
  ignition: string;
  location: string;
  source: GoogleSheetRow;
  /** An undated row for this vehicle prevents establishing safe chronology. */
  continuityBlocked?: boolean;
};

export type FuelIncrease = {
  id: string;
  vehicle: string;
  before: FuelReading;
  after: FuelReading;
  amount: number;
  stationary: boolean;
  gapMinutes: number;
};

function nonnegativeNumber(value: GoogleSheetRow[string]): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  // Commas must form thousands groups; units, partial numbers and junk are rejected.
  if (!/^(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?|\.\d+)$/.test(trimmed)) return null;
  const number = Number(trimmed.replaceAll(',', ''));
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function wallClockTimestamp(value: GoogleSheetRow[string]): number | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  let parts: number[];
  const sheet = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2})$/.exec(trimmed);
  const gviz = /^Date\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})(?:,\s*(\d{1,2}),\s*(\d{1,2})(?:,\s*(\d{1,2})(?:,\s*(\d{1,3}))?)?)?\)$/.exec(trimmed);
  const iso = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z?$/.exec(trimmed);
  if (sheet) {
    parts = [Number(sheet[3]), Number(sheet[2]) - 1, Number(sheet[1]), Number(sheet[4]), Number(sheet[5]), Number(sheet[6]), 0];
  } else if (gviz) {
    parts = [Number(gviz[1]), Number(gviz[2]), Number(gviz[3]), Number(gviz[4] ?? 0), Number(gviz[5] ?? 0), Number(gviz[6] ?? 0), Number(gviz[7] ?? 0)];
  } else if (iso) {
    // ISO input is an alternative encoding of the same source wall-clock digits.
    parts = [Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), Number(iso[4]), Number(iso[5]), Number(iso[6]), Number((iso[7] ?? '').padEnd(3, '0'))];
  } else {
    return null;
  }
  const [year, month, day, hour, minute, second, millisecond] = parts;
  if (year < 1000 || month < 0 || month > 11 || day < 1 || hour > 23 || minute > 59 || second > 59) return null;
  const timestamp = Date.UTC(year, month, day, hour, minute, second, millisecond);
  const date = new Date(timestamp);
  // Date.UTC normalizes impossible dates; round-trip all parts instead of accepting them.
  if (
    date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day ||
    date.getUTCHours() !== hour || date.getUTCMinutes() !== minute || date.getUTCSeconds() !== second ||
    date.getUTCMilliseconds() !== millisecond
  ) return null;
  return timestamp;
}

function text(value: GoogleSheetRow[string]): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function sameReading(a: FuelReading, b: FuelReading): boolean {
  return a.fuel === b.fuel && a.speed === b.speed && a.ignition === b.ignition && a.location === b.location;
}

/**
 * invalidRows counts rows without a vehicle or valid timestamp. Missing/invalid
 * numeric fields are retained as null. duplicateRows counts redundant normalized
 * readings; conflictingRows counts retained readings in ambiguous timestamp groups.
 */
export function parseFuelRows(rows: GoogleSheetRow[]): {
  readings: FuelReading[];
  invalidRows: number;
  duplicateRows: number;
  conflictingRows: number;
} {
  let invalidRows = 0;
  let duplicateRows = 0;
  let conflictingRows = 0;
  const blockedVehicles = new Set<string>();
  const groups = new Map<string, FuelReading[]>();
  rows.forEach((source, index) => {
    const fields = new Map(Object.entries(source).map(([key, value]) => [key.trim().toLowerCase(), value]));
    const vehicle = text(fields.get('vehicle no') ?? null);
    const timestamp = wallClockTimestamp(fields.get('date time') ?? null);
    if (!vehicle || timestamp === null) {
      invalidRows += 1;
      if (vehicle && timestamp === null) blockedVehicles.add(vehicle);
      return;
    }
    const reading: FuelReading = {
      id: `fuel-${encodeURIComponent(vehicle)}-${timestamp}-${index}`,
      vehicle,
      timestamp,
      day: new Date(timestamp).toISOString().slice(0, 10),
      fuel: nonnegativeNumber(fields.get('total fuel') ?? null),
      speed: nonnegativeNumber(fields.get('speed') ?? null),
      ignition: text(fields.get('ignition') ?? null),
      location: text(fields.get('location') ?? null),
      source,
    };
    const key = JSON.stringify([vehicle, timestamp]);
    const group = groups.get(key) ?? [];
    if (group.some((existing) => sameReading(existing, reading))) {
      duplicateRows += 1;
    } else {
      group.push(reading);
      groups.set(key, group);
    }
  });
  const readings: FuelReading[] = [];
  groups.forEach((group) => {
    if (group.length > 1) conflictingRows += group.length;
    group.forEach((reading) => {
      if (group.length > 1) reading.fuel = null;
      if (blockedVehicles.has(reading.vehicle)) reading.continuityBlocked = true;
      readings.push(reading);
    });
  });
  readings.sort((a, b) => a.timestamp - b.timestamp || a.vehicle.localeCompare(b.vehicle) || a.id.localeCompare(b.id));
  return { readings, invalidRows, duplicateRows, conflictingRows };
}

/** Detect individual positive reading changes; these are not confirmed top-ups. */
export function detectFuelIncreases(
  readings: FuelReading[],
  minimumIncrease: number,
  maxGapMinutes = 10,
): FuelIncrease[] {
  if (!Number.isFinite(minimumIncrease) || minimumIncrease < 0 || !Number.isFinite(maxGapMinutes) || maxGapMinutes <= 0) return [];
  const sorted = [...readings].sort((a, b) => a.timestamp - b.timestamp);
  const blockedVehicles = new Set(sorted.filter((reading) => reading.continuityBlocked || !Number.isFinite(reading.timestamp)).map((reading) => reading.vehicle));
  const previous = new Map<string, FuelReading>();
  const increases: FuelIncrease[] = [];
  for (const after of sorted) {
    if (blockedVehicles.has(after.vehicle)) continue;
    const before = previous.get(after.vehicle);
    previous.set(after.vehicle, after);
    if (!before || before.fuel === null || after.fuel === null) continue;
    if (!Number.isFinite(before.fuel) || !Number.isFinite(after.fuel) || before.fuel < 0 || after.fuel < 0) continue;
    const gapMinutes = (after.timestamp - before.timestamp) / 60_000;
    const amount = after.fuel - before.fuel;
    // Decimal source values can subtract a few ULPs below an exact threshold.
    const tolerance = Number.EPSILON * Math.max(before.fuel, after.fuel, minimumIncrease, 1) * 4;
    if (gapMinutes <= 0 || gapMinutes > maxGapMinutes || amount <= 0 || amount + tolerance < minimumIncrease) continue;
    increases.push({
      id: `${before.id}--${after.id}`,
      vehicle: after.vehicle,
      before,
      after,
      amount,
      stationary: before.speed === 0 && after.speed === 0,
      gapMinutes,
    });
  }
  return increases;
}

export function formatFuelTime(timestamp: number, includeDate = false): string {
  if (!Number.isFinite(timestamp)) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    ...(includeDate ? { day: '2-digit', month: '2-digit', year: 'numeric' } as const : {}),
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(timestamp);
}

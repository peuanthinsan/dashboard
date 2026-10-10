import type { GoogleSheetColumn, GoogleSheetRow } from './googleSheetParse';

export type AfterHoursSettings = {
  startTime: string;
  endTime: string;
  timeZone: 'Asia/Bangkok';
  geofenceNames: string[];
};
export const DEFAULT_AFTER_HOURS_SETTINGS: AfterHoursSettings = {
  startTime: '08:00', endTime: '16:00', timeZone: 'Asia/Bangkok', geofenceNames: [],
};
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DAY_MS = 86_400_000;
const BANGKOK_OFFSET = 7 * 3_600_000;
const normalize = (value: unknown) => String(value ?? '').trim().toUpperCase();

export function validateAfterHoursSettings(value: unknown): AfterHoursSettings {
  const settings = value as Partial<AfterHoursSettings> | null;
  if (!settings || typeof settings.startTime !== 'string' || typeof settings.endTime !== 'string'
    || !TIME.test(settings.startTime) || !TIME.test(settings.endTime) || settings.startTime >= settings.endTime) {
    throw new Error('Set daily allowed hours with the end later than the start (for example 08:00–16:00).');
  }
  if (settings.timeZone !== 'Asia/Bangkok') throw new Error('Use the Asia/Bangkok time zone.');
  if (!Array.isArray(settings.geofenceNames) || !settings.geofenceNames.length || settings.geofenceNames.length > 50
    || settings.geofenceNames.some((name) => typeof name !== 'string' || !name.trim() || name.trim().length > 256)) {
    throw new Error('Enter 1–50 customer area names from the Geofence Name column.');
  }
  return { startTime: settings.startTime, endTime: settings.endTime, timeZone: 'Asia/Bangkok',
    geofenceNames: Array.from(new Map(settings.geofenceNames.map((name) => [normalize(name), name.trim()])).values()) };
}

export function parseAfterHoursSettingsFromFormData(form: FormData): AfterHoursSettings {
  return validateAfterHoursSettings({ startTime: form.get('afterHoursStart'), endTime: form.get('afterHoursEnd'),
    timeZone: 'Asia/Bangkok', geofenceNames: String(form.get('afterHoursGeofences') ?? '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean) });
}

/** Read the FMS DISPLAY as dd/MM/yyyy H:mm:ss, never reinterpret the Sheet's underlying US date. */
export function parseEntryTime(value: unknown): { day: string; seconds: number; timestamp: number } | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, dd, mm, yyyy, hh, min, sec] = match;
  const [d, m, y, h, n, s] = [dd, mm, yyyy, hh, min, sec].map(Number);
  if (y < 1900 || y > 9999 || h > 23 || n > 59 || s > 59) return null;
  const wallTime = Date.UTC(y, m - 1, d, h, n, s);
  const date = new Date(wallTime);
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return { day: `${yyyy}-${mm}-${dd}`, seconds: h * 3600 + n * 60 + s, timestamp: wallTime - BANGKOK_OFFSET };
}

export type EntryDateRange = { from: string; to: string };
export type EntryPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'custom';
export function isEntryDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return parseEntryTime(`${value.slice(8)}/${value.slice(5, 7)}/${value.slice(0, 4)} 0:00:00`) !== null;
}
export function isEntryRange(range: EntryDateRange): boolean {
  return isEntryDay(range.from) && isEntryDay(range.to) && range.from <= range.to;
}
export function entryPresetRange(period: Exclude<EntryPeriod, 'custom'>, now = new Date()): EntryDateRange {
  const wall = new Date(now.getTime() + BANGKOK_OFFSET);
  const today = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate());
  const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
  if (period === 'yesterday') return { from: iso(today - DAY_MS), to: iso(today - DAY_MS) };
  if (period === 'week') return { from: iso(today - ((wall.getUTCDay() + 6) % 7) * DAY_MS), to: iso(today) };
  if (period === 'month') return { from: iso(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), 1)), to: iso(today) };
  return { from: iso(today), to: iso(today) };
}

export type EntryStatus = 'early' | 'within' | 'late';
export type AfterHoursEntry = {
  vehicle: string; driver: string; fleet: string; day: string; entryTime: string; timestamp: number;
  status: EntryStatus; differenceSeconds: number; geofence: string;
};
export const AFTER_HOURS_COLUMNS = ['Vehicle No', 'Alert Type', 'Alert Date Time', 'Fleet', 'Geofence Name', 'Driver Name'] as const;
export function assertAfterHoursColumns(columns: GoogleSheetColumn[]) {
  const labels = new Set(columns.map((column) => column.label));
  const missing = AFTER_HOURS_COLUMNS.filter((label) => !labels.has(label));
  if (missing.length) throw new Error(`Missing Google Sheet columns: ${missing.join(', ')}`);
  if (AFTER_HOURS_COLUMNS.some((label) => columns.filter((c) => c.label === label).length !== 1)) {
    throw new Error('Required Google Sheet column names must be unique.');
  }
}

export function entryFleet(value: unknown, scopeNames: string[]): { included: boolean; label: string } {
  const original = String(value ?? '').trim();
  return { included: !scopeNames.length || scopeNames.some((name) => normalize(name) === normalize(original)), label: original || '—' };
}

function classifyEntry(seconds: number, hours: Pick<AfterHoursSettings, 'startTime' | 'endTime'>) {
  const toSeconds = (time: string) => Number(time.slice(0, 2)) * 3600 + Number(time.slice(3)) * 60;
  const start = toSeconds(hours.startTime), end = toSeconds(hours.endTime);
  const status: EntryStatus = seconds < start ? 'early' : seconds > end ? 'late' : 'within';
  return { status, differenceSeconds: status === 'early' ? start - seconds : status === 'late' ? seconds - end : 0 };
}

/** Used by the local demo to show schedule changes without saving anything to a database. */
export function reclassifyEntries(entries: AfterHoursEntry[], hours: Pick<AfterHoursSettings, 'startTime' | 'endTime'>) {
  return entries.map((entry) => {
    const [h, m, s] = entry.entryTime.split(':').map(Number);
    return { ...entry, ...classifyEntry(h * 3600 + m * 60 + s, hours) };
  });
}

/** OR within each selector, AND between the vehicle and fleet selectors. Empty means all. */
export function filterAfterHoursEntries(entries: AfterHoursEntry[], vehicles: string[], fleets: string[]) {
  const vehicleSet = new Set(vehicles), fleetSet = new Set(fleets);
  return entries.filter((entry) => (!vehicleSet.size || vehicleSet.has(entry.vehicle)) && (!fleetSet.size || fleetSet.has(entry.fleet)));
}

/** Scope before returning rows to the browser. Count events, without collapsing repeat vehicle entries. */
export function buildAfterHoursEntries(rows: GoogleSheetRow[], settings: AfterHoursSettings, range: EntryDateRange, scopes: string[]) {
  const entries: AfterHoursEntry[] = [];
  let invalidDates = 0;
  for (const row of rows) {
    if (!['UNAUTHORISED ENTRY', 'UNAUTHORIZED ENTRY'].includes(normalize(row['Alert Type']))) continue;
    const geofence = String(row['Geofence Name'] ?? '').trim();
    if (!settings.geofenceNames.some((name) => normalize(geofence).includes(normalize(name)))) continue;
    const fleet = entryFleet(row['Fleet'], scopes);
    if (!fleet.included) continue;
    const time = parseEntryTime(row['Alert Date Time']);
    if (!time) { invalidDates++; continue; }
    if (time.day < range.from || time.day > range.to) continue;
    const h = Math.floor(time.seconds / 3600), m = Math.floor(time.seconds % 3600 / 60), s = time.seconds % 60;
    entries.push({ vehicle: String(row['Vehicle No'] ?? '').trim() || '—', driver: String(row['Driver Name'] ?? '').trim() || '—', fleet: fleet.label,
      day: time.day, entryTime: [h, m, s].map((n) => String(n).padStart(2, '0')).join(':'), timestamp: time.timestamp,
      ...classifyEntry(time.seconds, settings), geofence });
  }
  return { entries, invalidDates };
}

export function summarizeEntries(entries: AfterHoursEntry[]) {
  const early = entries.filter((entry) => entry.status === 'early').length;
  const late = entries.filter((entry) => entry.status === 'late').length;
  return { early, late, outside: early + late, within: entries.length - early - late,
    vehicles: new Set(entries.filter((entry) => entry.status !== 'within' && entry.vehicle !== '—').map((entry) => normalize(entry.vehicle))).size };
}

export function entryChartData(entries: AfterHoursEntry[], mode: 'hour' | 'day') {
  const buckets = new Map<string, { key: string; early: number; within: number; late: number }>();
  if (mode === 'hour') for (let h = 0; h < 24; h++) {
    const key = String(h).padStart(2, '0');
    buckets.set(key, { key, early: 0, within: 0, late: 0 });
  }
  for (const entry of entries) {
    const key = mode === 'hour' ? entry.entryTime.slice(0, 2) : entry.day;
    const bucket = buckets.get(key) ?? { key, early: 0, within: 0, late: 0 };
    bucket[entry.status]++;
    buckets.set(key, bucket);
  }
  return Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key));
}

import type { GoogleSheetColumn, GoogleSheetRow } from './googleSheetParse';

export type DriverRosterSettings = {
  sheetId: string;
  sheetGid: string;
  defaultFleet: string;
  namePolicy: 'vehicle' | 'recorded';
};
export type DriverRosterEntry = { vehicle: string; driver: string; fleet: string };
export const rosterKey = (value: string) => value.trim().toLocaleLowerCase('en');
const headerKey = (value: string) => rosterKey(value).replace(/[\s._-]+/g, '');
const VEHICLE_HEADERS = ['vehicleno', 'vehicelno', 'vehiclenoth', 'vehicle', 'plate'];
const DRIVER_HEADERS = ['drivername', 'driver', 'name'];

export function validateDriverRosterSettings(value: unknown): DriverRosterSettings {
  if (!value || typeof value !== 'object') throw new Error('Configure a driver roster sheet first.');
  const input = value as Record<string, unknown>;
  if (typeof input.sheetId !== 'string' || !/^[A-Za-z0-9_-]{10,128}$/.test(input.sheetId)
    || typeof input.sheetGid !== 'string' || !/^\d{1,12}$/.test(input.sheetGid)
    || typeof input.defaultFleet !== 'string' || input.defaultFleet.trim().length > 128
    || !['vehicle', 'recorded'].includes(String(input.namePolicy))) {
    throw new Error('Invalid driver roster settings. Check the sheet tab, fleet and name policy.');
  }
  return { sheetId: input.sheetId, sheetGid: input.sheetGid, defaultFleet: input.defaultFleet.trim(),
    namePolicy: input.namePolicy as DriverRosterSettings['namePolicy'] };
}

export function parseDriverRosterForm(form: FormData): DriverRosterSettings | null {
  const raw = String(form.get('driverRosterUrl') ?? '').trim();
  if (!raw) return null;
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('Enter a Google Sheets link for the driver roster.'); }
  const id = url.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1];
  const gid = url.searchParams.get('gid') ?? new URLSearchParams(url.hash.slice(1)).get('gid');
  if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com' || !gid) {
    throw new Error('Copy the roster tab link from Google Sheets, including its gid.');
  }
  return validateDriverRosterSettings({ sheetId: id, sheetGid: gid,
    defaultFleet: String(form.get('driverRosterFleet') ?? ''),
    namePolicy: String(form.get('driverRosterNamePolicy') ?? 'recorded') });
}

export function parseDriverRoster(columns: GoogleSheetColumn[], rows: GoogleSheetRow[], defaultFleet: string): DriverRosterEntry[] {
  const field = (names: string[]) => columns.find((column) => names.includes(headerKey(column.label)))?.fieldKey;
  const vehicleField = field(VEHICLE_HEADERS);
  const driverField = field(DRIVER_HEADERS);
  const fleetField = field(['fleet']);
  if (!vehicleField || !driverField) throw new Error('The roster needs Vehicle No and Driver Name columns (Vehicel No. and Name. are also supported).');
  const entries = new Map<string, DriverRosterEntry>();
  for (const row of rows) {
    const vehicle = String(row[vehicleField] ?? '').trim();
    const driver = String(row[driverField] ?? '').trim();
    if (!vehicle && !driver) continue;
    if (!vehicle || !driver || vehicle === '—' || driver === '—') throw new Error('A roster row has no vehicle or driver name. Complete the roster and retry.');
    const fleet = (fleetField ? String(row[fleetField] ?? '').trim() : '') || defaultFleet;
    if (!fleet) throw new Error('Add a Fleet column or configure the roster fleet in Admin.');
    const key = `${rosterKey(fleet)}\0${rosterKey(vehicle)}`;
    const existing = entries.get(key);
    if (existing && rosterKey(existing.driver) !== rosterKey(driver)) throw new Error(`Vehicle ${vehicle} has multiple drivers in the current roster. Keep one assignment per vehicle and fleet.`);
    entries.set(key, existing ?? { vehicle, driver, fleet });
  }
  return [...entries.values()];
}

const vehicleKey = (entry: Pick<DriverRosterEntry, 'fleet' | 'vehicle'>) => `${rosterKey(entry.fleet)}\0${rosterKey(entry.vehicle)}`;
export const indexDriverRoster = (roster: DriverRosterEntry[]) => new Map(roster.map((entry) => [vehicleKey(entry), entry]));
export function mapRosterDriver<T extends DriverRosterEntry>(row: T, roster: ReadonlyMap<string, DriverRosterEntry>, policy: DriverRosterSettings['namePolicy']): T {
  const match = roster.get(vehicleKey(row));
  if (!match) return row;
  const useName = policy === 'vehicle' || !row.driver.trim() || row.driver === '—' || rosterKey(row.driver) === rosterKey(match.driver);
  return { ...row, vehicle: match.vehicle, driver: useName ? match.driver : row.driver };
}

export function filterDriverRoster(entries: DriverRosterEntry[], filters: { fleets?: string[]; vehicles?: string[]; drivers?: string[] }) {
  const matches = (value: string, selected?: string[]) => !selected?.length || selected.some((item) => rosterKey(item) === rosterKey(value));
  return entries.filter((entry) => matches(entry.fleet, filters.fleets) && matches(entry.vehicle, filters.vehicles) && matches(entry.driver, filters.drivers));
}

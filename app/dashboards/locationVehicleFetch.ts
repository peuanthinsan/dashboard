import { detectSheetDateColumn } from './googleSheetFetch';
import { gvizColumnLetter } from './googleSheetGvizUrl';
import { parseGoogleSheetGvizText, type GoogleSheetColumn } from './googleSheetParse';
import { LOCATION_FIELD_ALIASES } from './locationDataV1';
import { normalizeLabel } from './dashboardDataUtils';
import {
  LOCATION_FLEET_FIELDS, LOCATION_MAX_RECORDS, LOCATION_PAGE_SIZE,
  type LocationVehicleCatalog, type LocationVehiclePage,
  scopedLocationVehicles,
} from './locationVehicleData';

type CatalogSource = {
  catalog: LocationVehicleCatalog;
  vehicleColumn: string;
  orderColumn: string | null;
  values: Map<string, Array<string | number>>;
  fleetColumn: string | null;
  fleetValues: Map<string, string[]>;
};

const catalogs = new Map<string, { value: CatalogSource; expires: number }>();
const pending = new Map<string, Promise<CatalogSource>>();

function columnIndex(columns: GoogleSheetColumn[], aliases: string[]) {
  const names = new Set(aliases.map(normalizeLabel));
  return columns.findIndex((column) => names.has(normalizeLabel(column.label)));
}

function queryUrl(sheetId: string, gid: string, query: string) {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?` +
    new URLSearchParams({ gid, tqx: 'out:json', tq: query }).toString();
}

async function fetchQuery(sheetId: string, gid: string, query: string, signal?: AbortSignal) {
  const response = await fetch(queryUrl(sheetId, gid, query), {
    cache: 'no-store', signal: AbortSignal.any([AbortSignal.timeout(45_000), ...(signal ? [signal] : [])]),
  });
  if (!response.ok) throw new Error('Unable to fetch vehicle data from the Google Sheet.');
  const text = await response.text();
  // GViz returns HTTP 200 for query/schema errors. Never treat these as an empty fleet.
  const match = text.match(/setResponse\(([\s\S]*)\);/);
  if (!match) throw new Error('Unable to read the Google Sheet response.');
  const json = JSON.parse(match[1]) as { status?: string; table?: unknown };
  if (json.status === 'error' || !json.table) throw new Error('The Google Sheet could not serve the vehicle query. Check the vehicle and timestamp columns.');
  return parseGoogleSheetGvizText(text);
}

/** Values come from the catalogue; reject ambiguous quoting instead of broadening a query. */
export function locationVehicleLiteral(value: string | number) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  const text = String(value);
  if (/[\\\r\n\u0000]/.test(text) || (text.includes("'") && text.includes('"'))) {
    throw new Error('This vehicle identifier contains unsupported characters.');
  }
  return text.includes("'") ? `"${text}"` : `'${text}'`;
}

async function loadCatalog(sheetId: string, gid: string): Promise<CatalogSource> {
  const { columns } = await detectSheetDateColumn(sheetId, gid);
  const vehicleIndex = columnIndex(columns, LOCATION_FIELD_ALIASES.vehicleNo!);
  if (vehicleIndex < 0) throw new Error('The sheet needs a Vehicle No or License Plate column.');
  const fleetIndex = columnIndex(columns, LOCATION_FLEET_FIELDS);
  const trackIndex = columnIndex(columns, LOCATION_FIELD_ALIASES.trackTime!);
  const updatedIndex = columnIndex(columns, LOCATION_FIELD_ALIASES.updatedTime!);
  const orderIndex = [trackIndex, updatedIndex].find((index) => index >= 0 && ['date', 'datetime'].includes(columns[index]!.type));
  const vehicleColumn = gvizColumnLetter(vehicleIndex);
  const group = [vehicleColumn, ...(fleetIndex >= 0 ? [gvizColumnLetter(fleetIndex)] : [])].join(',');
  // An aggregation returns one entry per vehicle/fleet, not all telemetry rows.
  // no_format preserves numeric identifiers so the subsequent equality is typed correctly.
  const parsed = await fetchQuery(sheetId, gid,
    `select ${group}, count(${vehicleColumn}) group by ${group} options no_format`);
  const entries = new Map<string, Set<string>>();
  const values = new Map<string, Array<string | number>>();
  const fleetValues = new Map<string, string[]>();
  let hasUnidentifiedVehicles = false;
  for (const row of parsed.rows) {
    const value = row[parsed.columns[0]!.fieldKey];
    const vehicleNo = String(value ?? '').trim();
    if (!vehicleNo) { hasUnidentifiedVehicles = true; continue; }
    if (typeof value !== 'string' && typeof value !== 'number') throw new Error('Vehicle identifiers must be text or numbers.');
    const rawValues = values.get(vehicleNo) ?? [];
    if (!rawValues.includes(value)) rawValues.push(value);
    values.set(vehicleNo, rawValues);
    const fleets = entries.get(vehicleNo) ?? new Set<string>();
    if (fleetIndex >= 0) {
      const fleet = String(row[parsed.columns[1]!.fieldKey] ?? '');
      fleets.add(fleet.trim());
      const rawFleets = fleetValues.get(normalizeLabel(fleet)) ?? [];
      if (!rawFleets.includes(fleet)) rawFleets.push(fleet);
      fleetValues.set(normalizeLabel(fleet), rawFleets);
    }
    entries.set(vehicleNo, fleets);
  }
  return {
    vehicleColumn, orderColumn: orderIndex == null ? null : gvizColumnLetter(orderIndex), values,
    fleetColumn: fleetIndex >= 0 ? gvizColumnLetter(fleetIndex) : null, fleetValues,
    catalog: {
      hasFleetColumn: fleetIndex >= 0, hasUnidentifiedVehicles,
      vehicles: Array.from(entries, ([vehicleNo, fleets]) => ({ vehicleNo, fleets: Array.from(fleets) })),
    },
  };
}

async function catalogSource(sheetId: string, gid: string, refresh = false) {
  const key = `${sheetId}:${gid}`;
  const cached = catalogs.get(key);
  if (!refresh && cached && cached.expires > Date.now()) return cached.value;
  const existing = pending.get(key);
  if (existing) return existing;
  const job = loadCatalog(sheetId, gid).then((value) => {
    catalogs.delete(key);
    catalogs.set(key, { value, expires: Date.now() + 5 * 60_000 });
    while (catalogs.size > 20) catalogs.delete(catalogs.keys().next().value!);
    return value;
  }).finally(() => pending.delete(key));
  pending.set(key, job);
  return job;
}

export async function fetchLocationVehicleCatalog(sheetId: string, gid: string, refresh = false) {
  return (await catalogSource(sheetId, gid, refresh)).catalog;
}

export async function fetchLocationVehiclePage(
  sheetId: string, gid: string, vehicle: string, offset = 0, signal?: AbortSignal, scopes: string[] = [],
): Promise<LocationVehiclePage> {
  if (!vehicle.trim() || !Number.isInteger(offset) || offset < 0 || offset >= LOCATION_MAX_RECORDS) {
    throw new Error('A vehicle and a valid history offset are required.');
  }
  const source = await catalogSource(sheetId, gid);
  if (!scopedLocationVehicles(source.catalog, scopes).includes(vehicle)) {
    throw new Error('The selected vehicle is not available in this dashboard scope.');
  }
  const values = source.values.get(vehicle);
  if (!values?.length) throw new Error('The selected vehicle is no longer in this sheet. Refresh the vehicle list.');
  if (!source.orderColumn) throw new Error('Track Time or Updated Time must be a date/time column to load recent vehicle history.');
  const limit = Math.min(LOCATION_PAGE_SIZE, LOCATION_MAX_RECORDS - offset);
  const where = values.map((value) => `${source.vehicleColumn} = ${locationVehicleLiteral(value)}`).join(' or ');
  const fleetValues = scopes.flatMap((scope) => source.fleetValues.get(normalizeLabel(scope)) ?? []);
  const fleetWhere = source.fleetColumn && scopes.length
    ? ` and (${fleetValues.map((value) => `${source.fleetColumn} = ${locationVehicleLiteral(value)}`).join(' or ')})`
    : '';
  const parsed = await fetchQuery(sheetId, gid,
    `select * where (${where})${fleetWhere} order by ${source.orderColumn} desc limit ${limit + 1} offset ${offset}`, signal);
  return {
    columns: parsed.columns, rows: parsed.rows.slice(0, limit), vehicle, offset,
    hasMore: parsed.rows.length > limit && offset + limit < LOCATION_MAX_RECORDS,
    lastUpdated: Date.now(),
  };
}

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchLocationVehicleCatalog, fetchLocationVehiclePage, locationVehicleLiteral } from './locationVehicleFetch';
import { scopedLocationVehicles, LOCATION_PAGE_SIZE } from './locationVehicleData';

const headers = [{ label: 'Vehicle No', type: 'string' }, { label: 'Track Time', type: 'datetime' }, { label: 'Fleet', type: 'string' }];
const groupHeaders = [{ label: 'Vehicle No', type: 'string' }, { label: 'Fleet', type: 'string' }, { label: 'count', type: 'number' }];
function payload(cols: typeof headers, rows: unknown[][] = []) {
  return `google.visualization.Query.setResponse(${JSON.stringify({ status: 'ok', table: { cols, rows: rows.map((row) => ({ c: row.map((v) => ({ v })) })) } })});`;
}
function responses(...bodies: string[]) {
  const urls: URL[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    urls.push(new URL(url));
    return new Response(bodies.shift()!);
  }));
  return urls;
}
afterEach(() => vi.unstubAllGlobals());

describe('vehicle-scoped sheet loading', () => {
  it('fetches an aggregated 500-vehicle catalogue, then only the chosen plate in bounded pages', async () => {
    const urls = responses(payload(headers), payload(groupHeaders, Array.from({ length: 500 }, (_, i) => [`TRUCK-${i}`, 'Fleet A', 10])),
      payload(headers, Array.from({ length: LOCATION_PAGE_SIZE + 1 }, () => ['TRUCK-499', '09/09/2026 10:00:00', 'Fleet A'])));
    const catalog = await fetchLocationVehicleCatalog('location-500', '0');
    expect(catalog.vehicles).toHaveLength(500);
    expect(urls[1]!.searchParams.get('tq')).toBe('select A,C, count(A) group by A,C options no_format');
    const page = await fetchLocationVehiclePage('location-500', '0', 'TRUCK-499', 2_000, undefined, ['fleet a']);
    expect(urls).toHaveLength(3);
    expect(urls[2]!.searchParams.get('tq')).toBe("select * where (A = 'TRUCK-499') and (C = 'Fleet A') order by B desc limit 2001 offset 2000");
    expect(page.rows).toHaveLength(2_000);
    expect(page.hasMore).toBe(true);
  });

  it('never falls back to all-sheet rows for unknown or missing plates', async () => {
    const urls = responses(payload(headers), payload(groupHeaders, [['KNOWN', 'Fleet A', 1]]));
    await expect(fetchLocationVehiclePage('location-unknown', '0', 'UNKNOWN')).rejects.toThrow();
    await expect(fetchLocationVehiclePage('location-unknown', '0', '')).rejects.toThrow();
    expect(urls).toHaveLength(2);
  });

  it('uses complete catalogue metadata to enforce a fleet scope with no Fleet column', () => {
    const catalog = { hasFleetColumn: false, hasUnidentifiedVehicles: false, vehicles: [{ vehicleNo: 'A', fleets: [] }, { vehicleNo: 'B', fleets: [] }] };
    expect(() => scopedLocationVehicles(catalog, ['restricted'])).toThrow('multiple or unidentified');
    expect(scopedLocationVehicles({ ...catalog, vehicles: catalog.vehicles.slice(0, 1) }, ['restricted'])).toEqual(['A']);
    expect(() => scopedLocationVehicles({ ...catalog, vehicles: catalog.vehicles.slice(0, 1), hasUnidentifiedVehicles: true }, ['restricted'])).toThrow();
  });

  it('rejects GViz query errors even when Google returns HTTP 200', async () => {
    responses(payload(headers), 'google.visualization.Query.setResponse({"status":"error","errors":[{"reason":"invalid_query"}]});');
    await expect(fetchLocationVehicleCatalog('location-bad-query', '0')).rejects.toThrow('could not serve');
  });

  it('quotes exact identifiers and rejects values that could escape the literal', () => {
    expect(locationVehicleLiteral("P'55")).toBe('"P\'55"');
    expect(locationVehicleLiteral('กข 0055')).toBe("'กข 0055'");
    expect(locationVehicleLiteral(55)).toBe('55');
    expect(() => locationVehicleLiteral('x\' or A = "y"')).toThrow();
    expect(() => locationVehicleLiteral('x\\')).toThrow();
  });

  it('requires a timestamp and never silently mislabels an unordered history page as recent', async () => {
    responses(payload([{ label: 'License Plate', type: 'string' }]), payload([{ label: 'License Plate', type: 'string' }, { label: 'count', type: 'number' }], [['A', 4]]));
    await expect(fetchLocationVehiclePage('location-no-time', '0', 'A')).rejects.toThrow('date/time');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchLocationVehicleCatalog, fetchLocationVehicleHistoryPage, fetchLocationVehiclePage, locationVehicleLiteral } from './locationVehicleFetch';
import { scopedLocationVehicles, LOCATION_MAX_RECORDS, LOCATION_PAGE_SIZE } from './locationVehicleData';

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

describe('complete selected-vehicle history pages', () => {
  it.each(['string', 'datetime'])('keeps %s timestamps in sheet order with one bounded lookahead row', async (timeType) => {
    const pageHeaders = headers.map((column) => column.label === 'Track Time' ? { ...column, type: timeType } : column);
    const times = timeType === 'string'
      ? ['2026-09-12  9:59:52', '01/10/2026 00:00:00', null]
      : ['Date(2026,8,12,9,59,52)', 'Date(2026,9,1,0,0,0)', null];
    const rows = Array.from({ length: LOCATION_PAGE_SIZE + 1 }, (_, index) => ['TRUCK-A', times[index % times.length], 'Fleet A']);
    const urls = responses(payload(pageHeaders), payload(groupHeaders, [['TRUCK-A', 'Fleet A', 30_000], ['TRUCK-B', 'Fleet A', 30_000]]),
      payload(pageHeaders, rows));
    const page = await fetchLocationVehicleHistoryPage(`location-history-${timeType}`, '0', 'TRUCK-A', 0, undefined, ['fleet a']);
    expect(urls[2]!.searchParams.get('tq')).toBe("select * where (A = 'TRUCK-A') and (C = 'Fleet A') limit 2001 offset 0");
    expect(page.rows).toHaveLength(LOCATION_PAGE_SIZE);
    expect(page.rows.slice(0, times.length).map((row) => row['Track Time'])).toEqual(times);
    expect(page.rows.every((row) => row['Vehicle No'] === 'TRUCK-A')).toBe(true);
    expect(page).toMatchObject({ vehicle: 'TRUCK-A', offset: 0, hasMore: true });
  });

  it('continues beyond 25,000 records and returns the final page without truncation', async () => {
    const rows = Array.from({ length: LOCATION_PAGE_SIZE + 1 }, () => ['TRUCK-A', 'Date(2026,8,12,9,59,52)', 'Fleet A']);
    const finalRows = [['TRUCK-A', 'Date(2026,8,13,9,59,52)', 'Fleet A'], ['TRUCK-A', null, 'Fleet A']];
    const urls = responses(payload(headers), payload(groupHeaders, [['TRUCK-A', 'Fleet A', 28_002]]),
      payload(headers, rows), payload(headers, finalRows));
    const continuation = await fetchLocationVehicleHistoryPage('location-history-over-25000', '0', 'TRUCK-A', 26_000);
    expect(continuation.rows).toHaveLength(LOCATION_PAGE_SIZE);
    expect(continuation).toMatchObject({ offset: 26_000, hasMore: true });
    const final = await fetchLocationVehicleHistoryPage('location-history-over-25000', '0', 'TRUCK-A', 28_000);
    expect(final.rows).toHaveLength(2);
    expect(final).toMatchObject({ offset: 28_000, hasMore: false });
    expect(urls.slice(2).map((url) => url.searchParams.get('tq'))).toEqual([
      "select * where (A = 'TRUCK-A') limit 2001 offset 26000",
      "select * where (A = 'TRUCK-A') limit 2001 offset 28000",
    ]);
    await expect(fetchLocationVehiclePage('location-history-over-25000', '0', 'TRUCK-A', 26_000)).rejects.toThrow('valid history offset');
  });

  it('preserves exact numeric vehicle and raw fleet equality', async () => {
    const numericHeaders = headers.map((column) => column.label === 'Vehicle No' ? { ...column, type: 'number' } : column);
    const urls = responses(payload(numericHeaders), payload(groupHeaders, [[55, 'Fleet A ', 2], [55, 'Fleet B', 2], [555, 'Fleet A ', 2]]),
      payload(numericHeaders, [[55, 'Date(2026,8,12,9,59,52)', 'Fleet A ']]));
    const page = await fetchLocationVehicleHistoryPage('location-history-numeric', '0', '55', 0, undefined, ['fleet a']);
    expect(urls[2]!.searchParams.get('tq')).toBe("select * where (A = 55) and (C = 'Fleet A ') limit 2001 offset 0");
    expect(page.rows).toHaveLength(1);
    expect(page.hasMore).toBe(false);
  });

  it('keeps raw timestamp values and Updated Time fallback available for complete-history normalization', async () => {
    const timeHeaders = [...headers.map((column) => ({ ...column, type: 'string' })), { label: 'Updated Time', type: 'string' }];
    responses(payload(timeHeaders), payload(groupHeaders, [['A', 'Fleet A', 2]]), payload(timeHeaders, [
      ['A', 'not a timestamp', 'Fleet A', '2026-09-12  9:59:52'],
      ['A', null, 'Fleet A', '2026-09-13  9:59:52'],
    ]));
    const page = await fetchLocationVehicleHistoryPage('location-history-time-fallback', '0', 'A');
    expect(page.rows.map((row) => [row['Track Time'], row['Updated Time']])).toEqual([
      ['not a timestamp', '2026-09-12  9:59:52'], [null, '2026-09-13  9:59:52'],
    ]);
    expect(page.hasMore).toBe(false);
  });

  it('rejects unsafe, fractional, negative, and missing selections before fetching any rows', async () => {
    const urls = responses();
    for (const offset of [Number.MAX_SAFE_INTEGER + 1, Infinity, NaN, -1, 0.5]) {
      await expect(fetchLocationVehicleHistoryPage('location-history-invalid', '0', 'A', offset)).rejects.toThrow('valid history offset');
    }
    await expect(fetchLocationVehicleHistoryPage('location-history-invalid', '0', '')).rejects.toThrow('valid history offset');
    expect(urls).toHaveLength(0);
  });

  it('rejects unknown and unauthorized vehicles without requesting their telemetry', async () => {
    const urls = responses(payload(headers), payload(groupHeaders, [['KNOWN', 'Fleet A', 1], ['OTHER', 'Fleet B', 1]]));
    await expect(fetchLocationVehicleHistoryPage('location-history-unknown', '0', 'UNKNOWN')).rejects.toThrow('not available');
    await expect(fetchLocationVehicleHistoryPage('location-history-unknown', '0', 'KNOWN', 0, undefined, ['Fleet B'])).rejects.toThrow('not available');
    expect(urls).toHaveLength(2);
  });

  it('forwards cancellation to the bounded history request', async () => {
    const bodies = [payload(headers), payload(groupHeaders, [['A', 'Fleet A', 1]])];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, options: RequestInit) => {
      if (bodies.length) return new Response(bodies.shift()!);
      expect(options.signal?.aborted).toBe(true);
      options.signal!.throwIfAborted();
      throw new Error('Expected an aborted signal');
    }));
    const controller = new AbortController();
    controller.abort();
    await expect(fetchLocationVehicleHistoryPage('location-history-abort', '0', 'A', 0, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('vehicle-scoped sheet loading', () => {
  it('sorts the complete scoped text history before paging, including one-digit hours and month boundaries', async () => {
    const textHeaders = headers.map((column) => column.label === 'Track Time' ? { ...column, type: 'string' } : column);
    const olderRows = Array.from({ length: LOCATION_PAGE_SIZE }, () => ['TRUCK-A', '2026-09-12  9:59:52', 'Fleet A']);
    const history = [
      ...olderRows,
      ['TRUCK-A', '2026-09-12  23:00:00', 'Fleet A'],
      ['TRUCK-A', '2026-09-12  10:00:00', 'Fleet A'],
      ['TRUCK-A', '01/10/2026 00:00:00', 'Fleet A'],
      ['TRUCK-A', null, 'Fleet A'],
    ];
    const urls = responses(payload(textHeaders), payload(groupHeaders, [['TRUCK-A', 'Fleet A', history.length]]),
      payload(textHeaders, history), payload(textHeaders, history));
    const first = await fetchLocationVehiclePage('location-text-time', '0', 'TRUCK-A', 0, undefined, ['fleet a']);
    expect(first.rows.slice(0, 3).map((row) => row['Track Time'])).toEqual([
      '01/10/2026 00:00:00', '2026-09-12  23:00:00', '2026-09-12  10:00:00',
    ]);
    expect(first.rows).toHaveLength(LOCATION_PAGE_SIZE);
    expect(first.hasMore).toBe(true);
    const second = await fetchLocationVehiclePage('location-text-time', '0', 'TRUCK-A', LOCATION_PAGE_SIZE, undefined, ['fleet a']);
    expect(second.rows.map((row) => row['Track Time'])).toEqual([
      '2026-09-12  9:59:52', '2026-09-12  9:59:52', '2026-09-12  9:59:52', null,
    ]);
    expect(second.hasMore).toBe(false);
    expect(second.offset).toBe(LOCATION_PAGE_SIZE);
    expect(first.columns).toEqual(second.columns);
    expect(urls.slice(2).map((url) => url.searchParams.get('tq'))).toEqual([
      "select * where (A = 'TRUCK-A') and (C = 'Fleet A') limit 25001",
      "select * where (A = 'TRUCK-A') and (C = 'Fleet A') limit 25001",
    ]);
  });

  it('never claims a capped text history contains the newest records', async () => {
    const textHeaders = [{ label: 'Vehicle No', type: 'string' }, { label: 'Track Time', type: 'string' }];
    responses(payload(textHeaders), payload(groupHeaders, [['A', '', LOCATION_MAX_RECORDS + 1]]),
      payload(textHeaders, Array.from({ length: LOCATION_MAX_RECORDS + 1 }, () => ['A', '2026-09-12  9:59:52'])));
    await expect(fetchLocationVehiclePage('location-text-overflow', '0', 'A')).rejects.toThrow('more than 25,000 records');
  });

  it('supports the last page of a complete text history at the record limit', async () => {
    const textHeaders = [{ label: 'Vehicle No', type: 'string' }, { label: 'Track Time', type: 'string' }];
    responses(payload(textHeaders), payload(groupHeaders, [['A', '', LOCATION_MAX_RECORDS]]),
      payload(textHeaders, Array.from({ length: LOCATION_MAX_RECORDS }, () => ['A', '2026-09-12  9:59:52'])));
    const page = await fetchLocationVehiclePage('location-text-at-limit', '0', 'A', 24_000);
    expect(page.rows).toHaveLength(1_000);
    expect(page.hasMore).toBe(false);
  });

  it('supports text Updated Time and keeps equal timestamps in source order', async () => {
    const textHeaders = [{ label: 'Vehicle No', type: 'string' }, { label: 'Updated Time', type: 'string' }, { label: 'Speed', type: 'number' }];
    responses(payload(textHeaders), payload(groupHeaders, [['A', '', 3]]), payload(textHeaders, [
      ['A', '2026-09-12  9:59:52', 12], ['A', '', 0], ['A', '2026-09-12  9:59:52', 20],
    ]));
    const page = await fetchLocationVehiclePage('location-text-updated', '0', 'A');
    expect(page.rows.map((row) => row.Speed)).toEqual([12, 20, 0]);
    expect(page.hasMore).toBe(false);
  });

  it('still prefers a native Updated Time over text Track Time', async () => {
    const mixedHeaders = [...headers.map((column) => ({ ...column, type: 'string' })), { label: 'Updated Time', type: 'datetime' }];
    const urls = responses(payload(mixedHeaders), payload(groupHeaders, [['A', 'Fleet A', 1]]), payload(mixedHeaders));
    const page = await fetchLocationVehiclePage('location-native-updated', '0', 'A');
    expect(urls[2]!.searchParams.get('tq')).toBe("select * where (A = 'A') order by D desc limit 2001 offset 0");
    expect(page.rows).toEqual([]);
    expect(page.hasMore).toBe(false);
  });

  it('rejects unreadable text timestamps instead of returning an unreliable chronology', async () => {
    const textHeaders = [{ label: 'Vehicle No', type: 'string' }, { label: 'Track Time', type: 'string' }];
    responses(payload(textHeaders), payload(groupHeaders, [['A', '', 1]]), payload(textHeaders, [['A', 'not a timestamp']]));
    await expect(fetchLocationVehiclePage('location-text-invalid', '0', 'A')).rejects.toThrow('unreadable timestamp');
  });

  it('forwards cancellation to the bounded text history fetch', async () => {
    const textHeaders = [{ label: 'Vehicle No', type: 'string' }, { label: 'Track Time', type: 'string' }];
    const bodies = [payload(textHeaders), payload(groupHeaders, [['A', '', 1]])];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, options: RequestInit) => {
      if (bodies.length) return new Response(bodies.shift()!);
      expect(options.signal?.aborted).toBe(true);
      options.signal!.throwIfAborted();
      throw new Error('Expected an aborted signal');
    }));
    const controller = new AbortController();
    controller.abort();
    await expect(fetchLocationVehiclePage('location-text-abort', '0', 'A', 0, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });

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

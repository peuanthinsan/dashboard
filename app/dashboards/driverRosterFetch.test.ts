import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchDriverRoster } from './driverRosterFetch';
const settings = { sheetId: 'abcdefghijk', sheetGid: '123', defaultFleet: 'SERVICE', namePolicy: 'vehicle' as const };
const response = (rows: unknown[]) => new Response(`google.visualization.Query.setResponse(${JSON.stringify({ table: {
  cols: [{ label: 'Vehicel No.' }, { label: 'Name.' }], rows,
} })});`);
afterEach(() => vi.unstubAllGlobals());
describe('roster sheet loading', () => {
  it('loads formatted identifiers without date/alert pruning and leaves blanks out', async () => {
    const fetch = vi.fn().mockResolvedValue(response([{ c: [{ v: 12, f: '0012' }, { v: 'Driver A' }] }]));
    vi.stubGlobal('fetch', fetch);
    expect(await fetchDriverRoster(settings)).toEqual([{ vehicle: '0012', driver: 'Driver A', fleet: 'SERVICE' }]);
    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.searchParams.get('gid')).toBe('123');
    expect(url.searchParams.get('headers')).toBe('1');
    expect(url.searchParams.get('tq')).toBe('select * limit 10001');
  });
  it('does not return false zero-alert success on access, GViz or truncation failures', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    fetch.mockResolvedValue(new Response('Denied', { status: 403 }));
    await expect(fetchDriverRoster(settings)).rejects.toThrow(/access/);
    fetch.mockResolvedValue(new Response('google.visualization.Query.setResponse({"status":"error"});'));
    await expect(fetchDriverRoster(settings)).rejects.toThrow();
    fetch.mockResolvedValue(response(Array.from({ length: 10001 }, () => ({ c: [{ v: 12 }, { v: 'Driver A' }] }))));
    await expect(fetchDriverRoster(settings)).rejects.toThrow(/too large/);
  });
});

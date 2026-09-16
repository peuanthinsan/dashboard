import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCompleteLocationVehicleHistory } from './locationVehicleHistory';
import { LOCATION_PAGE_SIZE, type LocationVehiclePage } from './locationVehicleData';

const base = '/api/sheets/test-sheet/0';
const signal = () => new AbortController().signal;
function page(offset: number, count: number, hasMore: boolean): LocationVehiclePage {
  return {
    columns: [{ label: 'Vehicle No', type: 'string', fieldKey: 'Vehicle No' }],
    rows: Array.from({ length: count }, (_, i) => ({ 'Vehicle No': 'TRUCK-A', id: offset + i })),
    vehicle: 'TRUCK-A', offset, hasMore, lastUpdated: 123,
  };
}
afterEach(() => vi.unstubAllGlobals());

describe('complete selected-vehicle history', () => {
  it('automatically loads every page beyond 25,000, preserving scope and progress', async () => {
    const urls: URL[] = [];
    const total = 26_013;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const parsed = new URL(url, 'https://example.test');
      urls.push(parsed);
      const offset = Number(parsed.searchParams.get('offset'));
      const count = Math.min(LOCATION_PAGE_SIZE, total - offset);
      return Response.json(page(offset, count, offset + count < total));
    }));
    const progress = vi.fn();
    const result = await fetchCompleteLocationVehicleHistory(base, 'TRUCK-A', ['Fleet A'], signal(), progress);
    expect(result.rows).toHaveLength(total);
    expect(result.rows.at(-1)?.id).toBe(total - 1);
    expect(result).toMatchObject({ offset: 0, hasMore: false });
    expect(urls.map((url) => Number(url.searchParams.get('offset')))).toEqual(Array.from({ length: 14 }, (_, i) => i * 2_000));
    expect(urls.every((url) => url.searchParams.get('vehicle') === 'TRUCK-A'
      && url.searchParams.get('mode') === 'location-history'
      && url.searchParams.get('scopes') === '["Fleet A"]')).toBe(true);
    expect(progress).toHaveBeenLastCalledWith(total);
  });

  it('does not resolve a partial history while a later page is pending', async () => {
    let finishPage!: (response: Response) => void;
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(page(0, 2_000, true)))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { finishPage = resolve; }));
    vi.stubGlobal('fetch', fetchMock);
    let completed = false;
    const result = fetchCompleteLocationVehicleHistory(base, 'TRUCK-A', [], signal()).then((value) => { completed = true; return value; });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(completed).toBe(false);
    finishPage(Response.json(page(2_000, 3, false)));
    expect((await result).rows).toHaveLength(2_003);
  });

  it('rejects a later-page error instead of returning the first batch as complete', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json(page(0, 2_000, true)))
      .mockResolvedValueOnce(Response.json({ error: 'Sheet unavailable' }, { status: 502 })));
    await expect(fetchCompleteLocationVehicleHistory(base, 'TRUCK-A', [], signal())).rejects.toThrow('Sheet unavailable');
  });

  it.each([
    { ...page(0, 0, true) },
    { ...page(0, 1, false), vehicle: 'OTHER' },
    { ...page(0, 1, false), offset: 2_000 },
    { ...page(0, 2_001, false) },
  ])('rejects non-progressing or mismatched pages', async (invalid) => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(invalid));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchCompleteLocationVehicleHistory(base, 'TRUCK-A', [], signal())).rejects.toThrow('complete vehicle history');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('stops fetching when a vehicle switch cancels the history', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue(Response.json(page(0, 2_000, true)));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchCompleteLocationVehicleHistory(base, 'TRUCK-A', [], controller.signal, () => controller.abort()))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns a complete empty history when the vehicle has no rows', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(page(0, 0, false))));
    expect(await fetchCompleteLocationVehicleHistory(base, 'TRUCK-A', [], signal())).toMatchObject({ rows: [], hasMore: false });
  });
});

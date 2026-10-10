import { afterEach, describe, expect, it, vi } from 'vitest';
import { AFTER_HOURS_COLUMNS, buildAfterHoursEntries } from './afterHoursEntry';
import { AFTER_HOURS_PAGE_SIZE, fetchAfterHoursPage } from './afterHoursFetch';
const cols: { label: string; type: string }[] = AFTER_HOURS_COLUMNS.map((label) => ({ label, type: label === 'Alert Date Time' ? 'datetime' : 'string' }));
const payload = (rows: unknown[], columns = cols) => `google.visualization.Query.setResponse(${JSON.stringify({ status: 'ok', table: { cols: columns, rows } })});`;
afterEach(() => vi.unstubAllGlobals());

describe('After-hours Google Sheets pagination', () => {
  it('keeps formatted FMS dates, source columns and an uncapped continuation offset', async () => {
    const cells = { c: [{ v: 'TRUCK-1' }, { v: 'Unauthorised Entry' }, { v: 'Date(2026,0,10,1,58,3)', f: '01/10/2026 1:58:03' },
      { v: 'Thong' }, { v: 'Thongfleet' }, { v: 'Demo Driver 1' }] };
    const mock = vi.fn().mockResolvedValue(new Response(payload(Array(AFTER_HOURS_PAGE_SIZE + 1).fill(cells))));
    vi.stubGlobal('fetch', mock);
    const page = await fetchAfterHoursPage('sheet', '0', 26000);
    expect(page.rows).toHaveLength(1000);
    expect(page.rows[0]['Alert Date Time']).toBe('01/10/2026 1:58:03');
    expect(page).toMatchObject({ hasMore: true, nextOffset: 27000 });
    const query = new URL(mock.mock.calls[0][0]).searchParams;
    expect(query.get('tq')).toBe('select * limit 1001 offset 26000');
    expect(query.get('headers')).toBe('1');
    expect(mock.mock.calls[0][1].cache).toBe('no-store');
  });
  it('finishes only when the source page is exhausted', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(payload([]))));
    expect(await fetchAfterHoursPage('sheet', '0', 1000)).toMatchObject({ rows: [], hasMore: false });
  });
  it('rejects Google HTTP-200 error envelopes and missing required headers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('google.visualization.Query.setResponse({"status":"error"});'))
      .mockResolvedValueOnce(new Response(payload([], cols.slice(0, 3)))));
    await expect(fetchAfterHoursPage('sheet', '0', 0)).rejects.toThrow('unsuccessful');
    await expect(fetchAfterHoursPage('sheet', '0', 0)).rejects.toThrow('Fleet, Geofence Name, Driver Name');
  });
  it('maps moved columns by header and ignores User Name even when it looks like a fleet', async () => {
    const values: Record<string, string> = { 'Vehicle No': 'TRUCK-1', 'Driver Name': 'Actual Driver', 'Alert Type': 'Unauthorised Entry',
      'Alert Date Time': '01/10/2026 7:30:00', Fleet: 'Thong', 'Geofence Name': 'Thongfleet', 'User Name': 'WRONG FLEET' };
    const moved = ['Fleet', 'User Name', 'Driver Name', 'Geofence Name', 'Vehicle No', 'Alert Date Time', 'Alert Type'];
    const columns = moved.map((label) => ({ label, type: 'string' }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(payload([{ c: moved.map((label) => ({ v: values[label] })) }], columns))));
    const page = await fetchAfterHoursPage('sheet', '0', 0);
    const result = buildAfterHoursEntries(page.rows, { startTime: '08:00', endTime: '16:00', timeZone: 'Asia/Bangkok', geofenceNames: ['Thongfleet'] },
      { from: '2026-10-01', to: '2026-10-05' }, ['Thong']);
    expect(result.entries[0]).toMatchObject({ vehicle: 'TRUCK-1', driver: 'Actual Driver', fleet: 'Thong', status: 'early' });
  });
  it('rejects duplicate Fleet headers rather than choosing an ambiguous scope column', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(payload([], [...cols, { label: 'Fleet', type: 'string' }]))));
    await expect(fetchAfterHoursPage('sheet', '0', 0)).rejects.toThrow('unique');
  });
});

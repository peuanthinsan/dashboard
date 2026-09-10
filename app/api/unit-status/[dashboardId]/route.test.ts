import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), getUser: vi.fn(), getDashboardByPublicId: vi.fn(), getCompanyById: vi.fn(), getOrganizationById: vi.fn(), remember: vi.fn() }));
vi.mock('app/auth', () => ({ auth: mocks.auth }));
vi.mock('app/db', () => mocks);
vi.mock('app/unit-camera-history', () => ({ cameraHistorySourceKey: (...parts: unknown[]) => JSON.stringify(parts), rememberUnitCameras: mocks.remember }));
import { GET } from './route';

const dashboard = { id: 1, publicId: 'dashboard-1', companyId: 7, organizationId: 11, organizationIds: [11, 12],
  template: 'UnitStatus', sheetId: 'abcdefghijklmnopqrstuvwx1234567890', sheetGid: '123' };
const now = new Date('2026-09-10T05:00:00Z');
const primaryHeaders = ['vehicleno', 'username', 'datatime', 'recording'];
const primaryRows = [
  ['N-1', 'Acme', '10/09/2026 11:59:00', '1,2,3'],
  ['S-1', 'Acme', '10/09/2026 11:59:00', '1,2'],
  ['OUT', 'Acme', '10/09/2026 11:59:00', '1'],
  ['FOREIGN', 'Other', '10/09/2026 11:59:00', '1'],
];
const channelRows = [['N-1', 3, 'North'], ['S-1', 2, 'South'], ['OUT', 1, 'Other Fleet'], ['FOREIGN', 1, 'North']];
const gviz = (headers: string[], rows: unknown[][]) => `google.visualization.Query.setResponse(${JSON.stringify({ status: 'ok', table: {
  cols: headers.map((label) => ({ label, type: 'string' })), rows: rows.map((values) => ({ c: values.map((v) => ({ v })) })),
} })});`;
const call = () => GET(new Request('https://dashboard.example/api/unit-status/dashboard-1?sheetId=attacker&recording=9'), { params: Promise.resolve({ dashboardId: 'dashboard-1' }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
  mocks.auth.mockResolvedValue({ user: { email: 'viewer@example.test' } });
  mocks.getUser.mockResolvedValue([{ companyIds: [7], organizationIds: [11, 12], isAdmin: false }]);
  mocks.getDashboardByPublicId.mockResolvedValue([dashboard]);
  mocks.getCompanyById.mockResolvedValue([{ name: 'Acme' }]);
  mocks.getOrganizationById.mockImplementation(async (id) => [{ name: id === 11 ? 'North' : 'South' }]);
  mocks.remember.mockImplementation(async (_source, units) => Object.fromEntries(units.map((unit: { cameraHistoryKey: string; cameraObservations: unknown[] }) => [unit.cameraHistoryKey, unit.cameraObservations])));
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(new URL(url).searchParams.get('sheet') === 'CH'
    ? gviz(['Vehicle No', 'CH', 'Fleet'], channelRows) : gviz(primaryHeaders, primaryRows))));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('authorized durable UnitStatus snapshots', () => {
  it('uses stored source and exact scope before persisting/returning telemetry', async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const payload = await response.json();
    expect(payload.rows.map((row: Record<string, unknown>) => row.vehicleno)).toEqual(['N-1', 'S-1']);
    expect(payload.channelRows.map((row: Record<string, unknown>) => row['Vehicle No'])).toEqual(['N-1', 'S-1']);
    expect(payload.historyAvailable).toBe(true);
    expect(mocks.remember.mock.calls[0][1].map((unit: { vehicleNo: string }) => unit.vehicleNo)).toEqual(['N-1', 'S-1']);
    expect(mocks.remember.mock.calls[0][0]).toContain('gid:123');
    for (const [url] of vi.mocked(fetch).mock.calls) expect(String(url)).toContain(`/d/${dashboard.sheetId}/`);
  });

  it.each([
    { companyIds: [8], organizationIds: [11, 12] },
    { companyIds: [7], organizationIds: [11] },
    { companyIds: [7], organizationIds: [], isAdmin: true },
  ])('rejects insufficient company/all-fleet entitlement before source reads: %j', async (user) => {
    mocks.getUser.mockResolvedValue([user]);
    expect((await call()).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.remember).not.toHaveBeenCalled();
  });

  it('rejects anonymous requests and unresolved scopes', async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    mocks.auth.mockResolvedValue({ user: { email: 'viewer@example.test' } });
    mocks.getOrganizationById.mockResolvedValue([]);
    expect((await call()).status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fails visibly on bad primary data without changing history', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('google.visualization.Query.setResponse({"status":"error"});'));
    expect((await call()).status).toBe(502);
    expect(mocks.remember).not.toHaveBeenCalled();
  });

  it('does not broaden fleet scope if CH metadata fails', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => new Response(String(url).includes('sheet=CH') ? 'invalid' : gviz(primaryHeaders, primaryRows)));
    const response = await call();
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.rows).toEqual([]);
    expect(payload.metadataAvailable).toBe(false);
    expect(mocks.remember.mock.calls[0][1]).toEqual([]);
  });

  it('keeps source-proven authorized fleets available during a CH outage', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => new Response(String(url).includes('sheet=CH') ? 'invalid'
      : gviz([...primaryHeaders, 'Fleet'], primaryRows.map((row, index) => [...row, index === 0 ? 'North' : 'Other Fleet']))));
    const response = await call();
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.rows.map((row: Record<string, unknown>) => row.vehicleno)).toEqual(['N-1']);
    expect(payload.metadataAvailable).toBe(false);
  });

  it('returns the source snapshot with a visible degraded flag if history persistence fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.remember.mockRejectedValue(new Error('database unavailable'));
    const response = await call();
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.rows).toHaveLength(2);
    expect(payload.historyAvailable).toBe(false);
    expect(Object.keys(payload.cameraHistory)).toHaveLength(2);
    log.mockRestore();
  });

  it('retains the legacy BIGTH named source and resolves ALCHEM account alias', async () => {
    mocks.getDashboardByPublicId.mockResolvedValue([{ ...dashboard, template: 'BIGTHUnitStatus', sheetGid: '', organizationId: null, organizationIds: [] }]);
    mocks.getCompanyById.mockResolvedValue([{ name: 'ALCHEM' }]);
    vi.mocked(fetch).mockImplementation(async (url) => new Response(String(url).includes('sheet=CH')
      ? gviz(['Vehicle No', 'CH', 'Fleet'], []) : gviz(primaryHeaders, [['A-1', 'Alcsongdee', '10/09/2026 11:59:00', '1,2']])));
    const response = await call();
    expect(response.status).toBe(200);
    expect((await response.json()).rows).toHaveLength(1);
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('sheet=Unitstatus'))).toBe(true);
  });
});

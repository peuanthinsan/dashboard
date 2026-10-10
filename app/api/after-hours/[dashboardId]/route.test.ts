import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), getUser: vi.fn(), getDashboardByPublicId: vi.fn(), getOrganizationById: vi.fn(), fetchPage: vi.fn() }));
vi.mock('app/auth', () => ({ auth: mocks.auth }));
vi.mock('app/db', () => mocks);
vi.mock('app/dashboards/afterHoursFetch', () => ({ fetchAfterHoursPage: mocks.fetchPage }));
import { GET } from './route';

const settings = { startTime: '08:00', endTime: '16:00', timeZone: 'Asia/Bangkok', geofenceNames: ['Thongfleet'] };
const dashboard = { id: 1, publicId: 'report-1', companyId: 7, organizationId: 11, organizationIds: [11, 12],
  template: 'AfterHoursEntry', sheetId: 'abcdefghijklmnopqrstuvwx1234567890', sheetGid: '0', afterHoursSettings: settings };
const row = (fleet: string, day = '01') => ({ 'Vehicle No': `TRUCK-${fleet}`, 'User Name': 'THONGTRANSPORT MASTER,THONGTRANSPORT,SONGDEEAPI', 'Fleet': fleet, 'Driver Name': 'Demo Driver',
  'Geofence Name': 'Thongfleet customer', 'Alert Type': 'Unauthorised Entry', 'Alert Date Time': `${day}/10/2026 7:30:00` });
const call = (query = 'from=2026-10-01&to=2026-10-05') => GET(new Request(`https://dashboard.example/api/after-hours/report-1?${query}`), { params: Promise.resolve({ dashboardId: 'report-1' }) });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { email: 'viewer@example.test' } });
  mocks.getUser.mockResolvedValue([{ companyIds: [7], organizationIds: [11, 12], isAdmin: false }]);
  mocks.getDashboardByPublicId.mockResolvedValue([dashboard]);
  mocks.getOrganizationById.mockImplementation(async (id) => [{ name: id === 11 ? 'Thong' : 'Other authorized fleet' }]);
  mocks.fetchPage.mockResolvedValue({ rows: [row('Thong'), row('FOREIGN'), row('Thong', '06')], hasMore: false, nextOffset: 1000 });
});

describe('After-hours server authorization and saved configuration', () => {
  it('returns only scoped period entries and ignores client attempts to replace source/schedule/scope', async () => {
    const response = await call('from=2026-10-01&to=2026-10-05&sheetId=attacker&startTime=06:00&scopes=[]');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const result = await response.json();
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({ fleet: 'Thong', driver: 'Demo Driver', status: 'early', differenceSeconds: 1800 });
    expect(result.settings).toEqual(settings);
    expect(mocks.fetchPage.mock.calls[0].slice(0, 3)).toEqual([dashboard.sheetId, '0', 0]);
  });
  it.each([{ companyIds: [8], organizationIds: [11, 12] }, { companyIds: [7], organizationIds: [11] },
    { companyIds: [7], organizationIds: [], isAdmin: true }])('rejects insufficient company/all-fleet access: %j', async (user) => {
    mocks.getUser.mockResolvedValue([user]);
    expect((await call()).status).toBe(403);
    expect(mocks.fetchPage).not.toHaveBeenCalled();
  });
  it('requires a session and does not broaden an unresolved fleet', async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    mocks.auth.mockResolvedValue({ user: { email: 'viewer@example.test' } });
    mocks.getOrganizationById.mockResolvedValue([]);
    expect((await call()).status).toBe(503);
    expect(mocks.fetchPage).not.toHaveBeenCalled();
  });
  it.each(['from=2026-02-30&to=2026-03-02', 'from=2026-10-05&to=2026-10-01', 'from=2026-10-01',
    'from=2026-10-01&to=2026-10-05&offset=-1', 'from=2026-10-01&to=2026-10-05&offset=1.5'])('rejects invalid parameters: %s', async (query) => {
    expect((await call(query)).status).toBe(400);
    expect(mocks.fetchPage).not.toHaveBeenCalled();
  });
  it('requires saved valid hours and customer areas', async () => {
    mocks.getDashboardByPublicId.mockResolvedValue([{ ...dashboard, afterHoursSettings: null }]);
    expect((await call()).status).toBe(422);
    expect(mocks.fetchPage).not.toHaveBeenCalled();
  });
  it('reloads the saved schedule for subsequent requests', async () => {
    mocks.getDashboardByPublicId.mockResolvedValue([{ ...dashboard, afterHoursSettings: { ...settings, startTime: '07:00' } }]);
    expect((await (await call()).json()).entries[0].status).toBe('within');
  });
  it('fails visibly on source errors instead of returning zero totals', async () => {
    mocks.fetchPage.mockRejectedValue(new Error('Missing Google Sheet columns: Fleet'));
    const response = await call();
    expect(response.status).toBe(502);
    expect((await response.json()).error).toContain('Fleet');
  });
});

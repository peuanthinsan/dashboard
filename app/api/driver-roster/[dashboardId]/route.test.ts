import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), getUser: vi.fn(), getDashboardByPublicId: vi.fn(), getOrganizationById: vi.fn(), fetchDriverRoster: vi.fn() }));
vi.mock('app/auth', () => ({ auth: mocks.auth }));
vi.mock('app/db', () => mocks);
vi.mock('app/dashboards/driverRosterFetch', () => ({ fetchDriverRoster: mocks.fetchDriverRoster }));
import { GET } from './route';
const settings = { sheetId: 'abcdefghijk', sheetGid: '123', defaultFleet: 'SERVICE', namePolicy: 'vehicle' };
const dashboard = { companyId: 7, organizationIds: [11, 12], template: 'Summary', driverRosterSettings: settings };
const call = () => GET(new Request('https://example.test/api/driver-roster/test?sheetId=attacker&fleets=[]'), { params: Promise.resolve({ dashboardId: 'test' }) });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { email: 'viewer@example.test' } });
  mocks.getUser.mockResolvedValue([{ companyIds: [7], organizationIds: [11, 12] }]);
  mocks.getDashboardByPublicId.mockResolvedValue([dashboard]);
  mocks.getOrganizationById.mockImplementation(async (id) => [{ name: id === 11 ? 'SERVICE' : 'SECOND' }]);
  mocks.fetchDriverRoster.mockResolvedValue([{ vehicle: '1001', driver: 'A', fleet: 'SERVICE' }, { vehicle: '2001', driver: 'B', fleet: 'OTHER' }]);
});
describe('driver roster access', () => {
  it('uses saved configuration and filters the entire roster to authorized dashboard fleets', async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect((await response.json()).entries).toEqual([{ vehicle: '1001', driver: 'A', fleet: 'SERVICE' }]);
    expect(mocks.fetchDriverRoster.mock.calls[0][0]).toEqual(settings);
  });
  it.each([{ companyIds: [8], organizationIds: [11, 12] }, { companyIds: [7], organizationIds: [11] }, { companyIds: [7], organizationIds: [], isAdmin: true }])('rejects incomplete scope access %j', async (user) => {
    mocks.getUser.mockResolvedValue([user]);
    expect((await call()).status).toBe(403); expect(mocks.fetchDriverRoster).not.toHaveBeenCalled();
  });
  it('requires sign-in and fails closed if a scoped fleet cannot be resolved', async () => {
    mocks.auth.mockResolvedValue(null); expect((await call()).status).toBe(401);
    mocks.auth.mockResolvedValue({ user: { email: 'viewer@example.test' } });
    mocks.getOrganizationById.mockResolvedValue([]); expect((await call()).status).toBe(503);
    expect(mocks.fetchDriverRoster).not.toHaveBeenCalled();
  });
  it('does not return zeros for unconfigured or unavailable sources', async () => {
    mocks.getDashboardByPublicId.mockResolvedValue([{ ...dashboard, driverRosterSettings: null }]);
    expect((await call()).status).toBe(422);
    mocks.getDashboardByPublicId.mockResolvedValue([dashboard]);
    mocks.fetchDriverRoster.mockRejectedValue(new Error('Source unavailable'));
    const response = await call(); expect(response.status).toBe(502); expect((await response.json()).error).toBe('Source unavailable');
  });
});

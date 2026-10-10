import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), getDashboardByPublicId: vi.fn(), updateDashboardAfterHoursSettings: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('app/admin/admin-utils', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('app/db', () => mocks);
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
import { saveAfterHoursSchedule } from './afterHoursActions';

const settings = { startTime: '08:00', endTime: '16:00', timeZone: 'Asia/Bangkok', geofenceNames: ['Thongfleet'] };
const dashboard = { id: 7, publicId: 'report-1', template: 'AfterHoursEntry', companyId: 3, organizationIds: [4, 5], afterHoursSettings: settings };
const input = { dashboardId: 'report-1', startTime: '07:00', endTime: '18:00' };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireAdmin.mockResolvedValue({ isAdmin: true, companyIds: [3], organizationIds: [4, 5] });
  mocks.getDashboardByPublicId.mockResolvedValue([dashboard]);
});

describe('Saving shared after-hours settings inline', () => {
  it('requires Admin before loading a dashboard or writing settings', async () => {
    mocks.requireAdmin.mockRejectedValue(new Error('Admin required'));
    await expect(saveAfterHoursSchedule(input)).rejects.toThrow('Admin required');
    expect(mocks.getDashboardByPublicId).not.toHaveBeenCalled();
    expect(mocks.updateDashboardAfterHoursSettings).not.toHaveBeenCalled();
  });
  it.each([{ companyIds: [8], organizationIds: [4, 5] }, { companyIds: [3], organizationIds: [4] }])('requires assigned company and every fleet: %j', async (user) => {
    mocks.requireAdmin.mockResolvedValue({ isAdmin: true, ...user });
    await expect(saveAfterHoursSchedule(input)).rejects.toThrow('access');
    expect(mocks.updateDashboardAfterHoursSettings).not.toHaveBeenCalled();
  });
  it.each(['', 'Summary'])('rejects missing or incorrect template: %s', async (template) => {
    mocks.getDashboardByPublicId.mockResolvedValue(template ? [{ ...dashboard, template }] : []);
    await expect(saveAfterHoursSchedule(input)).rejects.toThrow('not found');
    expect(mocks.updateDashboardAfterHoursSettings).not.toHaveBeenCalled();
  });
  it.each([{ startTime: '22:00', endTime: '06:00' }, { startTime: '08:00', endTime: '08:00' }, { startTime: '7:00', endTime: '18:00' }])('does not save invalid hours: %j', async (hours) => {
    await expect(saveAfterHoursSchedule({ ...input, ...hours })).rejects.toThrow('allowed hours');
    expect(mocks.updateDashboardAfterHoursSettings).not.toHaveBeenCalled();
  });
  it('saves only allowed hours on the resolved dashboard, preserving server-side areas and timezone', async () => {
    const maliciousExtraFields = { ...input, id: 999, geofenceNames: ['Other'], timeZone: 'UTC' };
    const expected = { ...settings, startTime: '07:00', endTime: '18:00' };
    expect(await saveAfterHoursSchedule(maliciousExtraFields)).toEqual(expected);
    expect(mocks.updateDashboardAfterHoursSettings).toHaveBeenCalledExactlyOnceWith(7, expected);
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/dashboard/report-1');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/dashboards');
  });
  it('does not report a failed database save as successful', async () => {
    mocks.updateDashboardAfterHoursSettings.mockRejectedValue(new Error('Save failed'));
    await expect(saveAfterHoursSchedule(input)).rejects.toThrow('Save failed');
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

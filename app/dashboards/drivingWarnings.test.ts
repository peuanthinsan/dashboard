import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/auth', () => ({ auth: vi.fn() }));
vi.mock('app/db', () => ({
  getDashboardByPublicId: vi.fn(),
  getUser: vi.fn(),
  getLineChannelById: vi.fn(),
  insertPendingDrivingWarning: vi.fn(),
  markWarningSent: vi.fn(),
  markWarningFailed: vi.fn(),
  getWarningsForDashboard: vi.fn(),
}));
vi.mock('app/lib/lineMessagingApi', () => ({ sendLinePushMessage: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { sendDrivingWarning } from './drivingWarnings';
import { auth } from 'app/auth';
import * as dbModule from 'app/db';
import { sendLinePushMessage } from 'app/lib/lineMessagingApi';

function makeFormData(payload: object): FormData {
  const fd = new FormData();
  fd.set('payload', JSON.stringify(payload));
  return fd;
}

const baseUser = [{ id: 7, email: 'op@example.com', isAdmin: true, companyIds: [1], organizationIds: [10] }];
const baseDashboard = { id: 42, publicId: '11111111-1111-1111-1111-111111111111', name: 'ThongTrans', companyId: 1, organizationId: 10, lineChannelId: 5 };
const baseChannel = { id: 5, organizationId: 10, name: 'Bangkok Ops', groupId: 'C123', tokenPlaintext: 'TOKEN' };

beforeEach(() => {
  vi.resetAllMocks();
  (auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { email: 'op@example.com' } });
  (dbModule.getUser as ReturnType<typeof vi.fn>).mockResolvedValue(baseUser);
  (dbModule.getDashboardByPublicId as ReturnType<typeof vi.fn>).mockResolvedValue([baseDashboard]);
  (dbModule.getLineChannelById as ReturnType<typeof vi.fn>).mockResolvedValue(baseChannel);
  (dbModule.insertPendingDrivingWarning as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 99, lineStatus: 'pending', sentAt: null });
  (sendLinePushMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, messageId: 'M1' });
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('sendDrivingWarning — happy path', () => {
  it('returns success and marks the row sent (Drive Hours)', async () => {
    const fd = makeFormData({
      dashboardPublicId: '11111111-1111-1111-1111-111111111111',
      lineChannelId: 5,
      violation: {
        metric: 'drive_hrs',
        driver: 'Alice',
        vehicle: '72-1281',
        eventAt: '2026-05-01T04:14:00.000Z',
        threshold: 10,
        valueHours: 12.4,
        distanceKm: 142.6,
        loginAt: '2026-05-01T04:14:00.000Z',
        logoutAt: '2026-05-01T13:25:00.000Z',
        loginLocation: 'Thongfleet',
        logoutLocation: 'THONG TRANSPORT',
      },
      operatorNote: 'follow up',
    });
    const result = await sendDrivingWarning({ status: 'idle' }, fd);
    expect(result.status).toBe('success');
    expect(dbModule.markWarningSent).toHaveBeenCalledWith({ id: 99, messageId: 'M1' });
    const lineCall = (sendLinePushMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(lineCall.accessToken).toBe('TOKEN');
    expect(lineCall.groupId).toBe('C123');
    expect(lineCall.text).toContain('Alice');
    expect(lineCall.text).toContain('10');
  });

  it('returns error code=forbidden when user lacks access', async () => {
    (dbModule.getUser as ReturnType<typeof vi.fn>).mockResolvedValue([{ ...baseUser[0], isAdmin: false, companyIds: [], organizationIds: [] }]);
    const fd = makeFormData({
      dashboardPublicId: '11111111-1111-1111-1111-111111111111',
      lineChannelId: 5,
      violation: { metric: 'rest_hrs', driver: 'A', vehicle: 'V1', eventAt: '2026-05-01T04:14:00.000Z', threshold: 10, valueHours: 6, distanceKm: 80, loginAt: '2026-05-01T04:14:00.000Z', logoutAt: '2026-05-01T13:14:00.000Z', loginLocation: 'L1', logoutLocation: 'L2' },
    });
    const result = await sendDrivingWarning({ status: 'idle' }, fd);
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.code).toBe('forbidden');
  });

  it('returns error code=channel-mismatch when channel belongs to a different org', async () => {
    (dbModule.getLineChannelById as ReturnType<typeof vi.fn>).mockResolvedValue({ ...baseChannel, organizationId: 999 });
    const fd = makeFormData({
      dashboardPublicId: '11111111-1111-1111-1111-111111111111',
      lineChannelId: 5,
      violation: { metric: 'rest_hrs', driver: 'A', vehicle: 'V1', eventAt: '2026-05-01T04:14:00.000Z', threshold: 10, valueHours: 6, distanceKm: 80, loginAt: '2026-05-01T04:14:00.000Z', logoutAt: '2026-05-01T13:14:00.000Z', loginLocation: 'L1', logoutLocation: 'L2' },
    });
    const result = await sendDrivingWarning({ status: 'idle' }, fd);
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.code).toBe('channel-mismatch');
  });

  it('returns error code=line-api and marks failed when LINE returns 4xx', async () => {
    (sendLinePushMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, code: 'line-api', errorMessage: 'Invalid token' });
    const fd = makeFormData({
      dashboardPublicId: '11111111-1111-1111-1111-111111111111',
      lineChannelId: 5,
      violation: { metric: 'rest_hrs', driver: 'A', vehicle: 'V1', eventAt: '2026-05-01T04:14:00.000Z', threshold: 10, valueHours: 6, distanceKm: 80, loginAt: '2026-05-01T04:14:00.000Z', logoutAt: '2026-05-01T13:14:00.000Z', loginLocation: 'L1', logoutLocation: 'L2' },
    });
    const result = await sendDrivingWarning({ status: 'idle' }, fd);
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.code).toBe('line-api');
    expect(dbModule.markWarningFailed).toHaveBeenCalled();
  });
});

describe('sendDrivingWarning — breach guard', () => {
  const base = {
    dashboardPublicId: '11111111-1111-1111-1111-111111111111',
    lineChannelId: 5,
  };
  const violation = (metric: string, threshold: number, valueHours: number) => ({
    metric,
    driver: 'A',
    vehicle: 'V1',
    eventAt: '2026-05-01T04:14:00.000Z',
    threshold,
    valueHours,
    distanceKm: 80,
    loginAt: '2026-05-01T04:14:00.000Z',
    logoutAt: '2026-05-01T13:14:00.000Z',
    loginLocation: 'L1',
    logoutLocation: 'L2',
  });

  it('rejects a compliant drive-hours row (value below threshold)', async () => {
    const fd = makeFormData({ ...base, violation: violation('drive_hrs', 10, 8) });
    const result = await sendDrivingWarning({ status: 'idle' }, fd);
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.code).toBe('invalid-input');
    expect(dbModule.insertPendingDrivingWarning).not.toHaveBeenCalled();
    expect(sendLinePushMessage).not.toHaveBeenCalled();
  });

  it('rejects a compliant rest-hours row (rest at/above threshold)', async () => {
    const fd = makeFormData({ ...base, violation: violation('rest_hrs', 8, 12) });
    const result = await sendDrivingWarning({ status: 'idle' }, fd);
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.code).toBe('invalid-input');
    expect(sendLinePushMessage).not.toHaveBeenCalled();
  });

  it('rejects a zero rest-hours row (no rest recorded ≠ violation)', async () => {
    const fd = makeFormData({ ...base, violation: violation('rest_hrs', 8, 0) });
    const result = await sendDrivingWarning({ status: 'idle' }, fd);
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.code).toBe('invalid-input');
  });

  it('still sends for a genuine rest-hours violation (below threshold)', async () => {
    const fd = makeFormData({ ...base, violation: violation('rest_hrs', 8, 5.5) });
    const result = await sendDrivingWarning({ status: 'idle' }, fd);
    expect(result.status).toBe('success');
    expect(sendLinePushMessage).toHaveBeenCalled();
  });
});

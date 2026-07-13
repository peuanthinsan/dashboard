'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth } from 'app/auth';
import {
  getDashboardByPublicId,
  getUser,
  getLineChannelById,
  insertPendingDrivingWarning,
  markWarningSent,
  markWarningFailed,
} from 'app/db';
import { sendLinePushMessage } from 'app/lib/lineMessagingApi';
import {
  buildDriveHoursMessageThai,
  buildDriveHoursMessageEnglish,
  buildRestHoursMessageThai,
  buildRestHoursMessageEnglish,
  buildCntDrvHoursMessageThai,
  buildCntDrvHoursMessageEnglish,
} from './drivingWarningMessage';
import { computeViolationKey } from './dashboardDataUtils';

const ViolationDriveHrs = z.object({
  metric: z.literal('drive_hrs'),
  driver: z.string().min(1).max(128),
  vehicle: z.string().min(1).max(64),
  eventAt: z.string().datetime(),
  threshold: z.number().positive().max(24),
  valueHours: z.number().min(0).max(48),
  distanceKm: z.number().min(0).max(10_000).nullable(),
  loginAt: z.string().datetime().nullable(),
  logoutAt: z.string().datetime().nullable(),
  loginLocation: z.string().max(256).nullable(),
  logoutLocation: z.string().max(256).nullable(),
});

const ViolationRestHrs = z.object({
  metric: z.literal('rest_hrs'),
  driver: z.string().min(1).max(128),
  vehicle: z.string().min(1).max(64),
  eventAt: z.string().datetime(),
  threshold: z.number().positive().max(24),
  valueHours: z.number().min(0).max(48),
  distanceKm: z.number().min(0).max(10_000).nullable(),
  loginAt: z.string().datetime().nullable(),
  logoutAt: z.string().datetime().nullable(),
  loginLocation: z.string().max(256).nullable(),
  logoutLocation: z.string().max(256).nullable(),
});

const ViolationCntDrvHrs = z.object({
  metric: z.literal('cnt_drv_hrs'),
  driver: z.string().min(1).max(128),
  vehicle: z.string().min(1).max(64),
  eventAt: z.string().datetime(),
  threshold: z.number().positive().max(24),
  valueHours: z.number().min(0).max(48),
  distanceKm: z.number().min(0).max(10_000).nullable(),
  loginAt: z.string().datetime().nullable(),
  logoutAt: z.string().datetime().nullable(),
  loginLocation: z.string().max(256).nullable(),
  logoutLocation: z.string().max(256).nullable(),
});

const Input = z.object({
  // Use guid() (Zod v4) for the UUID-shape check. Strict uuid() rejects fixtures
  // like `1111…1111` because their variant/version nibbles don't match RFC 4122;
  // dashboard publicIds come from `randomUUID()` so the shape check is sufficient.
  dashboardPublicId: z.string().guid(),
  lineChannelId: z.number().int().positive(),
  violation: z.discriminatedUnion('metric', [ViolationDriveHrs, ViolationRestHrs, ViolationCntDrvHrs]),
  operatorNote: z.string().max(500).optional(),
});

export type SendDrivingWarningState =
  | { status: 'idle' }
  | { status: 'success'; warningId: number; sentAt: string; channelName: string }
  | {
      status: 'error';
      message: string;
      code:
        | 'unauth'
        | 'forbidden'
        | 'no-channel'
        | 'channel-mismatch'
        | 'line-api'
        | 'timeout'
        | 'already-sent'
        | 'invalid-input';
    };

export async function sendDrivingWarning(
  _prev: SendDrivingWarningState,
  formData: FormData,
): Promise<SendDrivingWarningState> {
  const session = await auth();
  if (!session?.user?.email) {
    return { status: 'error', code: 'unauth', message: 'Sign in required.' };
  }

  const rawPayload = formData.get('payload');
  if (typeof rawPayload !== 'string') {
    return { status: 'error', code: 'invalid-input', message: 'Missing payload.' };
  }
  let parsed;
  try {
    parsed = Input.parse(JSON.parse(rawPayload));
  } catch {
    return { status: 'error', code: 'invalid-input', message: 'Invalid payload.' };
  }

  // The threshold tabs list ALL completed shifts, not just violations — reject
  // payloads that don't actually breach, or one click sends the driver a
  // factually false LINE warning and inflates the warned-drivers KPI.
  // Mirrors ThresholdSubPage.isExceeding: rest violations are BELOW threshold.
  const breach = parsed.violation.metric === 'rest_hrs'
    ? parsed.violation.valueHours > 0 && parsed.violation.valueHours < parsed.violation.threshold
    : parsed.violation.valueHours > parsed.violation.threshold;
  if (!breach) {
    return {
      status: 'error',
      code: 'invalid-input',
      message: 'Value does not breach the threshold — no warning to send.',
    };
  }

  const users = await getUser(session.user.email);
  if (users.length === 0) {
    return { status: 'error', code: 'unauth', message: 'User not found.' };
  }
  const user = users[0];

  const dashboards = await getDashboardByPublicId(parsed.dashboardPublicId);
  if (dashboards.length === 0) {
    return { status: 'error', code: 'forbidden', message: 'Dashboard not found.' };
  }
  const dashboard = dashboards[0];

  const isAdmin = !!user.isAdmin;
  const matchesCompany = (user.companyIds ?? []).includes(dashboard.companyId ?? -1);
  const matchesOrganization =
    !dashboard.organizationId || (user.organizationIds ?? []).includes(dashboard.organizationId);
  if (!isAdmin && !(matchesCompany && matchesOrganization)) {
    return { status: 'error', code: 'forbidden', message: 'You do not have access to this dashboard.' };
  }

  const channel = await getLineChannelById(parsed.lineChannelId);
  if (!channel) {
    return { status: 'error', code: 'no-channel', message: 'LINE channel not found.' };
  }
  if (channel.organizationId !== dashboard.organizationId) {
    return { status: 'error', code: 'channel-mismatch', message: 'Channel does not belong to this fleet.' };
  }

  const v = parsed.violation;
  const violationKey = computeViolationKey({
    metric: v.metric,
    driver: v.driver,
    vehicle: v.vehicle,
    eventAtIso: v.eventAt,
    threshold: v.threshold,
  });

  const eventAt = new Date(v.eventAt);
  const vehicleNo = v.vehicle;

  const inserted = await insertPendingDrivingWarning({
    dashboardId: dashboard.id,
    violationKey,
    driverName: v.driver,
    vehicleNo,
    eventAt,
    metric: v.metric,
    threshold: v.threshold,
    valueHours: v.valueHours,
    distanceKm: v.distanceKm ?? null,
    loginAt: v.loginAt ? new Date(v.loginAt) : null,
    logoutAt: v.logoutAt ? new Date(v.logoutAt) : null,
    loginLocation: v.loginLocation,
    logoutLocation: v.logoutLocation,
    lineChannelId: channel.id,
    sentByUserId: user.id,
    operatorNote: parsed.operatorNote ?? null,
  });

  // No row means the upsert hit an already-'sent' warning (it is left untouched): don't
  // re-push a duplicate LINE message or double-count the warned driver on a repeat click.
  if (!inserted) {
    return { status: 'error', code: 'already-sent', message: 'This warning has already been sent.' };
  }

  const lang = (process.env.DASHBOARD_LANG ?? 'th') as 'th' | 'en';
  const dashboardName = dashboard.name ?? 'Songdee';
  const text = v.metric === 'drive_hrs'
    ? (lang === 'th'
        ? buildDriveHoursMessageThai({ ...v, distanceKm: v.distanceKm, operatorNote: parsed.operatorNote, dashboardName })
        : buildDriveHoursMessageEnglish({ ...v, distanceKm: v.distanceKm, operatorNote: parsed.operatorNote, dashboardName }))
    : v.metric === 'rest_hrs'
      ? (lang === 'th'
          ? buildRestHoursMessageThai({ ...v, distanceKm: v.distanceKm, operatorNote: parsed.operatorNote, dashboardName })
          : buildRestHoursMessageEnglish({ ...v, distanceKm: v.distanceKm, operatorNote: parsed.operatorNote, dashboardName }))
      : (lang === 'th'
          ? buildCntDrvHoursMessageThai({ ...v, distanceKm: v.distanceKm, operatorNote: parsed.operatorNote, dashboardName })
          : buildCntDrvHoursMessageEnglish({ ...v, distanceKm: v.distanceKm, operatorNote: parsed.operatorNote, dashboardName }));

  const lineResult = await sendLinePushMessage({
    accessToken: channel.tokenPlaintext as unknown as string,
    groupId: channel.groupId,
    text,
  });

  if (!lineResult.ok) {
    await markWarningFailed({ id: inserted.id, errorMessage: lineResult.errorMessage });
    return {
      status: 'error',
      code: lineResult.code === 'timeout' ? 'timeout' : 'line-api',
      message: lineResult.errorMessage,
    };
  }

  await markWarningSent({ id: inserted.id, messageId: lineResult.messageId });
  revalidatePath(`/dashboard/${parsed.dashboardPublicId}`);

  return {
    status: 'success',
    warningId: inserted.id,
    sentAt: new Date().toISOString(),
    channelName: channel.name,
  };
}

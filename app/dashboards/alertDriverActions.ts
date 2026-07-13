'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth } from 'app/auth';
import {
  getDashboardByPublicId,
  getUser,
  upsertAlertDriverOverride,
  deleteAlertDriverOverride,
  upsertAlertDriverOverrides,
  deleteAlertDriverOverrides,
} from 'app/db';

const AlertKey = z.string().min(1).max(64);

const Input = z.object({
  dashboardPublicId: z.string().guid(),
  alertKey: AlertKey,
  driverName: z.string().max(128),
});

const BulkInput = z.object({
  dashboardPublicId: z.string().guid(),
  alertKeys: z.array(AlertKey).min(1).max(500),
  driverName: z.string().max(128),
});

export type SaveAlertDriverNameResult =
  | { ok: true; driverName: string }
  | { ok: false; message: string };

/**
 * Resolve the dashboard and verify the signed-in user may edit it.
 * Returns the dashboard row id, or an error result.
 */
async function authorizeDashboardEdit(
  dashboardPublicId: string,
): Promise<{ ok: true; dashboardId: number } | { ok: false; message: string }> {
  const session = await auth();
  if (!session?.user?.email) {
    return { ok: false, message: 'Sign in required.' };
  }

  const users = await getUser(session.user.email);
  if (users.length === 0) {
    return { ok: false, message: 'User not found.' };
  }
  const user = users[0];

  const dashboards = await getDashboardByPublicId(dashboardPublicId);
  if (dashboards.length === 0) {
    return { ok: false, message: 'Dashboard not found.' };
  }
  const dashboard = dashboards[0];

  const isAdmin = !!user.isAdmin;
  const matchesCompany = (user.companyIds ?? []).includes(dashboard.companyId ?? -1);
  // Mirror the view gate: require entitlement to EVERY scoped fleet, not just the legacy
  // scalar organizationId — otherwise a user who can't VIEW a multi-fleet dashboard could
  // still edit its driver-name overrides.
  const scopedOrgIds =
    dashboard.organizationIds && dashboard.organizationIds.length > 0
      ? dashboard.organizationIds
      : dashboard.organizationId != null
        ? [dashboard.organizationId]
        : [];
  const matchesOrganization =
    scopedOrgIds.length === 0 ||
    scopedOrgIds.every((oid) => (user.organizationIds ?? []).includes(oid));
  if (!isAdmin && !(matchesCompany && matchesOrganization)) {
    return { ok: false, message: 'You do not have access to this dashboard.' };
  }

  return { ok: true, dashboardId: dashboard.id };
}

/**
 * Set (or clear, when driverName is blank) a manual driver name for one
 * alert row on a Detail dashboard. Sheet data is read-only, so the override
 * lives in Postgres keyed by a content hash of the alert row.
 */
export async function saveAlertDriverName(input: {
  dashboardPublicId: string;
  alertKey: string;
  driverName: string;
}): Promise<SaveAlertDriverNameResult> {
  let parsed;
  try {
    parsed = Input.parse(input);
  } catch {
    return { ok: false, message: 'Invalid input.' };
  }

  const access = await authorizeDashboardEdit(parsed.dashboardPublicId);
  if (!access.ok) return access;

  const driverName = parsed.driverName.trim();
  if (driverName) {
    await upsertAlertDriverOverride({
      dashboardId: access.dashboardId,
      alertKey: parsed.alertKey,
      driverName,
    });
  } else {
    await deleteAlertDriverOverride({
      dashboardId: access.dashboardId,
      alertKey: parsed.alertKey,
    });
  }

  revalidatePath(`/dashboard/${parsed.dashboardPublicId}`);
  return { ok: true, driverName };
}

/**
 * Set (or clear, when driverName is blank) a manual driver name for many
 * alert rows at once. Callers with more than 500 rows should chunk requests.
 */
export async function saveAlertDriverNamesBulk(input: {
  dashboardPublicId: string;
  alertKeys: string[];
  driverName: string;
}): Promise<SaveAlertDriverNameResult> {
  let parsed;
  try {
    parsed = BulkInput.parse(input);
  } catch {
    return { ok: false, message: 'Invalid input.' };
  }

  const access = await authorizeDashboardEdit(parsed.dashboardPublicId);
  if (!access.ok) return access;

  const driverName = parsed.driverName.trim();
  const alertKeys = Array.from(new Set(parsed.alertKeys));
  if (driverName) {
    await upsertAlertDriverOverrides({
      dashboardId: access.dashboardId,
      alertKeys,
      driverName,
    });
  } else {
    await deleteAlertDriverOverrides({
      dashboardId: access.dashboardId,
      alertKeys,
    });
  }

  revalidatePath(`/dashboard/${parsed.dashboardPublicId}`);
  return { ok: true, driverName };
}

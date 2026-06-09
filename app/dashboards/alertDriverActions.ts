'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth } from 'app/auth';
import {
  getDashboardByPublicId,
  getUser,
  upsertAlertDriverOverride,
  deleteAlertDriverOverride,
} from 'app/db';

const Input = z.object({
  dashboardPublicId: z.string().guid(),
  alertKey: z.string().min(1).max(64),
  driverName: z.string().max(128),
});

export type SaveAlertDriverNameResult =
  | { ok: true; driverName: string }
  | { ok: false; message: string };

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
  const session = await auth();
  if (!session?.user?.email) {
    return { ok: false, message: 'Sign in required.' };
  }

  let parsed;
  try {
    parsed = Input.parse(input);
  } catch {
    return { ok: false, message: 'Invalid input.' };
  }

  const users = await getUser(session.user.email);
  if (users.length === 0) {
    return { ok: false, message: 'User not found.' };
  }
  const user = users[0];

  const dashboards = await getDashboardByPublicId(parsed.dashboardPublicId);
  if (dashboards.length === 0) {
    return { ok: false, message: 'Dashboard not found.' };
  }
  const dashboard = dashboards[0];

  const isAdmin = !!user.isAdmin;
  const matchesCompany = (user.companyIds ?? []).includes(dashboard.companyId ?? -1);
  const matchesOrganization =
    !dashboard.organizationId || (user.organizationIds ?? []).includes(dashboard.organizationId);
  if (!isAdmin && !(matchesCompany && matchesOrganization)) {
    return { ok: false, message: 'You do not have access to this dashboard.' };
  }

  const driverName = parsed.driverName.trim();
  if (driverName) {
    await upsertAlertDriverOverride({
      dashboardId: dashboard.id,
      alertKey: parsed.alertKey,
      driverName,
    });
  } else {
    await deleteAlertDriverOverride({
      dashboardId: dashboard.id,
      alertKey: parsed.alertKey,
    });
  }

  revalidatePath(`/dashboard/${parsed.dashboardPublicId}`);
  return { ok: true, driverName };
}

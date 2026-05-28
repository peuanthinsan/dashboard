'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from 'app/admin/admin-utils';
import { updateDashboardDrivingThresholds } from 'app/db';
import { normalizeDrivingThresholds } from './drivingThresholds';

export async function saveDrivingThresholdsInline(input: {
  dashboardRowId: number;
  dashboardPublicId: string;
  thresholds: unknown;
}) {
  await requireAdmin();
  const thresholds = normalizeDrivingThresholds(input.thresholds);
  await updateDashboardDrivingThresholds(input.dashboardRowId, thresholds);
  revalidatePath(`/dashboard/${input.dashboardPublicId}`);
  revalidatePath('/admin/dashboards');
  return { ok: true as const };
}

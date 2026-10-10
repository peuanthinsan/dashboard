'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from 'app/admin/admin-utils';
import { getDashboardByPublicId, updateDashboardAfterHoursSettings } from 'app/db';
import { resolveTemplate } from './dashboardDataUtils';
import { validateAfterHoursSettings } from './afterHoursEntry';

export async function saveAfterHoursSchedule(input: { dashboardId: string; startTime: string; endTime: string }) {
  const user = await requireAdmin();
  const [dashboard] = await getDashboardByPublicId(input.dashboardId);
  if (!dashboard || resolveTemplate(dashboard.template) !== 'AfterHoursEntry') throw new Error('After-hours dashboard not found.');
  const organizationIds = dashboard.organizationIds?.length ? dashboard.organizationIds
    : dashboard.organizationId != null ? [dashboard.organizationId] : [];
  if (!(user.companyIds ?? []).includes(dashboard.companyId ?? -1)
    || !organizationIds.every((id) => (user.organizationIds ?? []).includes(id))) throw new Error('You do not have access to this dashboard.');
  // Only the hours are editable here. Keep the saved source, areas and fleet scope.
  const settings = validateAfterHoursSettings({ ...dashboard.afterHoursSettings, startTime: input.startTime, endTime: input.endTime });
  await updateDashboardAfterHoursSettings(dashboard.id, settings);
  revalidatePath(`/dashboard/${dashboard.publicId}`);
  revalidatePath('/admin/dashboards');
  return settings;
}

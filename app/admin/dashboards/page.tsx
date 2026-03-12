export const dynamic = 'force-dynamic';

import { revalidatePath } from 'next/cache';
import {
  createDashboard,
  deleteDashboard,
  getCompanies,
  getDashboards,
  getOrganizations,
  updateDashboard,
} from 'app/db';
import AdminShell from '../AdminShell';
import { parseSheetLink, requireAdmin } from '../admin-utils';
import DashboardsClient from './DashboardsClient';
import type { ActionState } from '../types';

export default async function AdminDashboardsPage() {
  await requireAdmin();
  const [dashboards, companies, organizations] = await Promise.all([
    getDashboards(),
    getCompanies(),
    getOrganizations(),
  ]);

  async function addDashboardAction(
    _prevState: ActionState,
    formData: FormData,
  ): Promise<ActionState> {
    'use server';
    await requireAdmin();
    const name = (formData.get('dashboardName') as string)?.trim();
    const template = (formData.get('template') as string)?.trim();
    const sheetUrl = (formData.get('sheetUrl') as string)?.trim();
    const notesValue = (formData.get('dashboardNotes') as string) ?? '';
    const notes = notesValue.trim() ? notesValue.trim() : null;
    const companyId = Number(formData.get('companyId'));
    const organizationValue = (formData.get('organizationId') as string) ?? '';
    if (!name || !template || !sheetUrl || !companyId) {
      return { status: 'error', message: 'Fill in all required dashboard fields.' };
    }
    const { sheetId, sheetGid } = parseSheetLink(sheetUrl);
    if (!sheetId) {
      return { status: 'error', message: 'Enter a valid Google Sheet link.' };
    }
    try {
      await createDashboard({
        name,
        template,
        sheetUrl,
        sheetId,
        sheetGid,
        companyId,
        organizationId: organizationValue ? Number(organizationValue) : null,
        notes,
      });
      revalidatePath('/admin/dashboards');
      return { status: 'success', message: 'Dashboard created.' };
    } catch (error) {
      console.error('Failed to create dashboard', error);
      return { status: 'error', message: 'Unable to create dashboard.' };
    }
  }

  async function manageDashboardAction(
    _prevState: ActionState,
    formData: FormData,
  ): Promise<ActionState> {
    'use server';
    await requireAdmin();
    const dashboardId = Number(formData.get('dashboardId'));
    const intent = (formData.get('intent') as string) ?? 'save';
    if (!dashboardId) {
      return { status: 'error', message: 'Missing dashboard selection.' };
    }
    if (intent === 'delete') {
      try {
        await deleteDashboard(dashboardId);
        revalidatePath('/admin/dashboards');
        return { status: 'success', message: 'Dashboard deleted.' };
      } catch (error) {
        console.error('Failed to delete dashboard', error);
        return { status: 'error', message: 'Unable to delete dashboard.' };
      }
    }

    const name = (formData.get('dashboardName') as string)?.trim();
    const template = (formData.get('template') as string)?.trim();
    const sheetUrl = (formData.get('sheetUrl') as string)?.trim();
    const notesValue = (formData.get('dashboardNotes') as string) ?? '';
    const notes = notesValue.trim() ? notesValue.trim() : null;
    const companyId = Number(formData.get('companyId'));
    const organizationValue = (formData.get('organizationId') as string) ?? '';
    if (!name || !template || !sheetUrl || !companyId) {
      return { status: 'error', message: 'Fill in all required dashboard fields.' };
    }
    const { sheetId, sheetGid } = parseSheetLink(sheetUrl);
    if (!sheetId) {
      return { status: 'error', message: 'Enter a valid Google Sheet link.' };
    }
    try {
      await updateDashboard({
        id: dashboardId,
        name,
        template,
        sheetUrl,
        sheetId,
        sheetGid,
        companyId,
        organizationId: organizationValue ? Number(organizationValue) : null,
        notes,
      });
      revalidatePath('/admin/dashboards');
      return { status: 'success', message: 'Dashboard updated.' };
    } catch (error) {
      console.error('Failed to update dashboard', error);
      return { status: 'error', message: 'Unable to update dashboard.' };
    }
  }

  return (
    <AdminShell
      backHref="/admin"
      backLabel="Back to admin overview"
      eyebrow="Admin tools"
      title="Dashboards"
      description="Create dashboards for a company and link them to Google Sheets."
    >
      <DashboardsClient
        dashboards={dashboards}
        companies={companies}
        organizations={organizations}
        addDashboardAction={addDashboardAction}
        manageDashboardAction={manageDashboardAction}
      />
    </AdminShell>
  );
}

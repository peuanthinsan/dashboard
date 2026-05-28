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
import {
  bulkCreateDashboards,
  bulkReassignDashboards,
  bulkDeleteDashboards,
  bulkUpdateDashboardFields,
  bulkApplyDashboardAlertRules,
  bulkEditDashboardAlertRule,
  bulkRemoveDashboardAlertRule,
} from 'app/db-bulk';
import AdminShell from '../AdminShell';
import { parseSheetLink, requireAdmin } from '../admin-utils';
import { getDashboardLang } from 'app/dashboard/i18n';
import { getAdminCopy } from '../i18n-copy';
import DashboardsClient from './DashboardsClient';
import type { ActionState } from '../types';
import { parseDrivingThresholdsFromFormData } from 'app/dashboards/drivingThresholds';
import type { AlertRule } from 'app/dashboards/dashboardDataUtils';

function parseAlertRulesFromFormData(formData: FormData): AlertRule[] | null {
  const raw = (formData.get('alertRulesJson') as string) ?? '';
  if (!raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed as AlertRule[];
  } catch {
    return null;
  }
}

export default async function AdminDashboardsPage() {
  await requireAdmin();
  const lang = await getDashboardLang();
  const copy = getAdminCopy(lang);

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
    const alertTypesRaw = formData.getAll('alertTypes');
    const alertTypes = Array.isArray(alertTypesRaw)
      ? alertTypesRaw.map((v) => String(v).trim()).filter(Boolean)
      : [];
    const remarksRaw = formData.getAll('remarks');
    const remarks = Array.isArray(remarksRaw)
      ? remarksRaw.map((v) => String(v).trim()).filter(Boolean)
      : [];
    const _drive = Number(formData.get('_drivingDriveMax'));
    const _rest = Number(formData.get('_drivingRestMin'));
    if (!formData.get('drivingThresholdsJson') && (_drive > 0 || _rest > 0)) {
      formData.set('drivingThresholdsJson', JSON.stringify({
        driveHours: _drive > 0 ? [_drive] : [],
        restHours: _rest > 0 ? [_rest] : [],
      }));
    }
    const drivingThresholds = parseDrivingThresholdsFromFormData(formData);
    const alertRules = parseAlertRulesFromFormData(formData);
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
        alertTypes: alertTypes.length > 0 ? alertTypes : null,
        remarks: remarks.length > 0 ? remarks : null,
        drivingThresholds: drivingThresholds as unknown as {
          continuousDrivingMaxHours: number;
          restMinimumHours: number;
          workingHoursMax: number;
        },
        alertRules,
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
    const alertTypesRaw = formData.getAll('alertTypes');
    const alertTypes = Array.isArray(alertTypesRaw)
      ? alertTypesRaw.map((v) => String(v).trim()).filter(Boolean)
      : [];
    const remarksRaw = formData.getAll('remarks');
    const remarks = Array.isArray(remarksRaw)
      ? remarksRaw.map((v) => String(v).trim()).filter(Boolean)
      : [];
    const _drive = Number(formData.get('_drivingDriveMax'));
    const _rest = Number(formData.get('_drivingRestMin'));
    if (!formData.get('drivingThresholdsJson') && (_drive > 0 || _rest > 0)) {
      formData.set('drivingThresholdsJson', JSON.stringify({
        driveHours: _drive > 0 ? [_drive] : [],
        restHours: _rest > 0 ? [_rest] : [],
      }));
    }
    const drivingThresholds = parseDrivingThresholdsFromFormData(formData);
    const alertRules = parseAlertRulesFromFormData(formData);
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
        alertTypes: alertTypes.length > 0 ? alertTypes : null,
        remarks: remarks.length > 0 ? remarks : null,
        drivingThresholds: drivingThresholds as unknown as {
          continuousDrivingMaxHours: number;
          restMinimumHours: number;
          workingHoursMax: number;
        },
        alertRules,
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
      backLabel={copy.backToAdminOverview}
      eyebrow={copy.adminTools}
      title={copy.dashboardsNav}
      description={copy.createDashboardsForCompany}
      workflowHint={copy.workflowDashboards}
      lang={lang}
    >
      <DashboardsClient
        dashboards={dashboards}
        companies={companies}
        organizations={organizations}
        addDashboardAction={addDashboardAction}
        manageDashboardAction={manageDashboardAction}
        bulkCreateAction={bulkCreateDashboards}
        bulkReassignAction={bulkReassignDashboards}
        bulkDeleteAction={bulkDeleteDashboards}
        bulkUpdateFieldsAction={bulkUpdateDashboardFields}
        bulkApplyRulesAction={bulkApplyDashboardAlertRules}
        bulkEditRuleAction={bulkEditDashboardAlertRule}
        bulkRemoveRuleAction={bulkRemoveDashboardAlertRule}
      />
    </AdminShell>
  );
}

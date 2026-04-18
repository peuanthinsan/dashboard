export const dynamic = 'force-dynamic';

import { revalidatePath } from 'next/cache';
import { createCompany, deleteCompany, getCompanies, updateCompany } from 'app/db';
import { bulkCreateCompanies, bulkDeleteCompanies, bulkApplyCompanyAlertRules, bulkEditCompanyAlertRule, bulkRemoveCompanyAlertRule } from 'app/db-bulk';
import AdminShell from '../AdminShell';
import { requireAdmin } from '../admin-utils';
import { getDashboardLang } from 'app/dashboard/i18n';
import { getAdminCopy } from '../i18n-copy';
import CompaniesClient from './CompaniesClient';
import type { ActionState } from '../types';
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

export default async function AdminCompaniesPage() {
  await requireAdmin();
  const lang = await getDashboardLang();
  const copy = getAdminCopy(lang);
  const companies = await getCompanies();

  async function addCompanyAction(
    _prevState: ActionState,
    formData: FormData,
  ): Promise<ActionState> {
    'use server';
    await requireAdmin();
    const name = (formData.get('companyName') as string)?.trim();
    if (!name) {
      return { status: 'error', message: 'Enter a company name.' };
    }
    try {
      await createCompany(name);
      revalidatePath('/admin/companies');
      revalidatePath('/admin/users');
      revalidatePath('/admin/dashboards');
      return { status: 'success', message: 'Company created.' };
    } catch (error) {
      console.error('Failed to create company', error);
      return { status: 'error', message: 'Unable to create company.' };
    }
  }

  async function manageCompanyAction(
    _prevState: ActionState,
    formData: FormData,
  ): Promise<ActionState> {
    'use server';
    await requireAdmin();
    const companyId = Number(formData.get('companyId'));
    const intent = (formData.get('intent') as string) ?? 'save';
    if (!companyId) {
      return { status: 'error', message: 'Missing company selection.' };
    }
    try {
      if (intent === 'delete') {
        await deleteCompany(companyId);
        revalidatePath('/admin/companies');
        revalidatePath('/admin/users');
        revalidatePath('/admin/dashboards');
        return { status: 'success', message: 'Company deleted.' };
      }
      const name = (formData.get('companyName') as string)?.trim();
      if (!name) {
        return { status: 'error', message: 'Enter a company name.' };
      }
      const alertRules = parseAlertRulesFromFormData(formData);
      await updateCompany(companyId, name, alertRules);
      revalidatePath('/admin/companies');
      revalidatePath('/admin/users');
      revalidatePath('/admin/dashboards');
      return { status: 'success', message: 'Company updated.' };
    } catch (error) {
      console.error('Failed to update company', error);
      return { status: 'error', message: 'Unable to update company.' };
    }
  }

  return (
    <AdminShell
      backHref="/admin"
      backLabel={copy.backToAdminOverview}
      eyebrow={copy.administration}
      title={copy.companies}
      description={copy.createAndManageCompanyRecords}
      workflowHint={copy.workflowCompanies}
      lang={lang}
    >
      <CompaniesClient
        companies={companies}
        addCompanyAction={addCompanyAction}
        manageCompanyAction={manageCompanyAction}
        bulkCreateAction={bulkCreateCompanies}
        bulkDeleteAction={bulkDeleteCompanies}
        bulkApplyRulesAction={bulkApplyCompanyAlertRules}
        bulkEditRuleAction={bulkEditCompanyAlertRule}
        bulkRemoveRuleAction={bulkRemoveCompanyAlertRule}
      />
    </AdminShell>
  );
}

import { revalidatePath } from 'next/cache';
import { createCompany, deleteCompany, getCompanies, updateCompany } from 'app/db';
import AdminShell from '../AdminShell';
import { requireAdmin } from '../admin-utils';
import CompaniesClient from './CompaniesClient';
import type { ActionState } from '../types';

export default async function AdminCompaniesPage() {
  await requireAdmin();
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
      await updateCompany(companyId, name);
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
      backLabel="Back to admin overview"
      eyebrow="Administration"
      title="Companies"
      description="Create and manage company records."
    >
      <CompaniesClient
        companies={companies}
        addCompanyAction={addCompanyAction}
        manageCompanyAction={manageCompanyAction}
      />
    </AdminShell>
  );
}

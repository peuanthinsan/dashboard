import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { createCompany, deleteCompany, getCompanies, updateCompany } from 'app/db';
import AdminNav from '../AdminNav';
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
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-[1252px] flex-col gap-6 sm:gap-8">
        <header className="flex flex-col gap-3">
          <Link
            href="/admin"
            className="inline-flex w-fit items-center gap-2 text-sm text-slate-300 transition hover:text-white"
          >
            <span aria-hidden="true">←</span>
            Back to admin overview
          </Link>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold">Companies</h1>
            <p className="text-sm text-slate-300">Create and manage company records.</p>
          </div>
          <AdminNav />
        </header>

        <CompaniesClient
          companies={companies}
          addCompanyAction={addCompanyAction}
          manageCompanyAction={manageCompanyAction}
        />
      </div>
    </div>
  );
}

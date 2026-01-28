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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 px-4 py-8 text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-white sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-[1252px] flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/70">
          <Link
            href="/admin"
            className="inline-flex w-fit items-center gap-2 text-sm text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          >
            <span aria-hidden="true">←</span>
            Back to admin overview
          </Link>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              Administration
            </p>
            <h1 className="text-2xl font-semibold sm:text-3xl">Companies</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">Create and manage company records.</p>
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

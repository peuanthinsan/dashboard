import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { createOrganization, deleteOrganization, getOrganizations, updateOrganization } from 'app/db';
import AdminNav from '../AdminNav';
import { requireAdmin } from '../admin-utils';
import OrganizationsClient from './OrganizationsClient';
import type { ActionState } from '../types';

export default async function AdminOrganizationsPage() {
  await requireAdmin();
  const organizations = await getOrganizations();

  async function addOrganizationAction(
    _prevState: ActionState,
    formData: FormData,
  ): Promise<ActionState> {
    'use server';
    await requireAdmin();
    const name = (formData.get('organizationName') as string)?.trim();
    if (!name) {
      return { status: 'error', message: 'Enter an organization name.' };
    }
    try {
      await createOrganization(name);
      revalidatePath('/admin/organizations');
      revalidatePath('/admin/users');
      revalidatePath('/admin/dashboards');
      return { status: 'success', message: 'Organization created.' };
    } catch (error) {
      console.error('Failed to create organization', error);
      return { status: 'error', message: 'Unable to create organization.' };
    }
  }

  async function manageOrganizationAction(
    _prevState: ActionState,
    formData: FormData,
  ): Promise<ActionState> {
    'use server';
    await requireAdmin();
    const organizationId = Number(formData.get('organizationId'));
    const intent = (formData.get('intent') as string) ?? 'save';
    if (!organizationId) {
      return { status: 'error', message: 'Missing organization selection.' };
    }
    try {
      if (intent === 'delete') {
        await deleteOrganization(organizationId);
        revalidatePath('/admin/organizations');
        revalidatePath('/admin/users');
        revalidatePath('/admin/dashboards');
        return { status: 'success', message: 'Organization deleted.' };
      }
      const name = (formData.get('organizationName') as string)?.trim();
      if (!name) {
        return { status: 'error', message: 'Enter an organization name.' };
      }
      await updateOrganization(organizationId, name);
      revalidatePath('/admin/organizations');
      revalidatePath('/admin/users');
      revalidatePath('/admin/dashboards');
      return { status: 'success', message: 'Organization updated.' };
    } catch (error) {
      console.error('Failed to update organization', error);
      return { status: 'error', message: 'Unable to update organization.' };
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-white sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-[1252px] flex-col gap-8">
        <header className="flex flex-col gap-3">
          <Link
            href="/admin"
            className="inline-flex w-fit items-center gap-2 text-sm text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          >
            <span aria-hidden="true">←</span>
            Back to admin overview
          </Link>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold sm:text-3xl">Organizations</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Create and manage organization groups.
            </p>
          </div>
          <AdminNav />
        </header>

        <OrganizationsClient
          organizations={organizations}
          addOrganizationAction={addOrganizationAction}
          manageOrganizationAction={manageOrganizationAction}
        />
      </div>
    </div>
  );
}

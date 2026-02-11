import { revalidatePath } from 'next/cache';
import { createOrganization, deleteOrganization, getCompanies, getOrganizations, updateOrganization } from 'app/db';
import AdminShell from '../AdminShell';
import { requireAdmin } from '../admin-utils';
import OrganizationsClient from './OrganizationsClient';
import type { ActionState } from '../types';

export default async function AdminOrganizationsPage() {
  await requireAdmin();
  const [organizations, companies] = await Promise.all([getOrganizations(), getCompanies()]);

  async function addOrganizationAction(
    _prevState: ActionState,
    formData: FormData,
  ): Promise<ActionState> {
    'use server';
    await requireAdmin();
    const name = (formData.get('organizationName') as string)?.trim();
    const companyIdValue = (formData.get('companyId') as string) ?? '';
    const companyId = companyIdValue ? Number(companyIdValue) : null;
    if (!name || (companyIdValue && Number.isNaN(companyId))) {
      return { status: 'error', message: 'Enter a fleet name.' };
    }
    try {
      await createOrganization(name, companyId);
      revalidatePath('/admin/organizations');
      revalidatePath('/admin/users');
      revalidatePath('/admin/dashboards');
      return { status: 'success', message: 'Fleet created.' };
    } catch (error) {
      console.error('Failed to create organization', error);
      return { status: 'error', message: 'Unable to create fleet.' };
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
      return { status: 'error', message: 'Missing fleet selection.' };
    }
    try {
      if (intent === 'delete') {
        await deleteOrganization(organizationId);
        revalidatePath('/admin/organizations');
        revalidatePath('/admin/users');
        revalidatePath('/admin/dashboards');
        return { status: 'success', message: 'Fleet deleted.' };
      }
      const name = (formData.get('organizationName') as string)?.trim();
      const companyIdValue = (formData.get('companyId') as string) ?? '';
      const companyId = companyIdValue ? Number(companyIdValue) : null;
      if (!name || (companyIdValue && Number.isNaN(companyId))) {
        return { status: 'error', message: 'Enter a fleet name.' };
      }
      await updateOrganization(organizationId, name, companyId);
      revalidatePath('/admin/organizations');
      revalidatePath('/admin/users');
      revalidatePath('/admin/dashboards');
      return { status: 'success', message: 'Fleet updated.' };
    } catch (error) {
      console.error('Failed to update organization', error);
      return { status: 'error', message: 'Unable to update fleet.' };
    }
  }

  return (
    <AdminShell
      backHref="/admin"
      backLabel="Back to admin overview"
      eyebrow="Administration"
      title="Fleets"
      description="Create and manage fleet groups."
    >
      <OrganizationsClient
        organizations={organizations}
        companies={companies}
        addOrganizationAction={addOrganizationAction}
        manageOrganizationAction={manageOrganizationAction}
      />
    </AdminShell>
  );
}

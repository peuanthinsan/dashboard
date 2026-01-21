import { revalidatePath } from 'next/cache';
import {
  createOrganization,
  deleteOrganization,
  getOrganizations,
  updateOrganization,
} from 'app/db';
import { OrganizationsSectionClient } from '../AdminSections';
import { requireAdmin } from '../requireAdmin';

type ActionState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

export default async function OrganizationsPage() {
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
        return { status: 'success', message: 'Organization deleted.' };
      }
      const name = (formData.get('organizationName') as string)?.trim();
      if (!name) {
        return { status: 'error', message: 'Enter an organization name.' };
      }
      await updateOrganization(organizationId, name);
      revalidatePath('/admin/organizations');
      return { status: 'success', message: 'Organization updated.' };
    } catch (error) {
      console.error('Failed to update organization', error);
      return { status: 'error', message: 'Unable to update organization.' };
    }
  }

  return (
    <OrganizationsSectionClient
      organizations={organizations}
      addOrganizationAction={addOrganizationAction}
      manageOrganizationAction={manageOrganizationAction}
    />
  );
}

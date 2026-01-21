import {
  createCompany,
  createOrganization,
  deleteCompany,
  deleteOrganization,
  getCompanies,
  getOrganizations,
  updateCompany,
  updateOrganization,
} from 'app/db';
import AdminCompaniesClient from './AdminCompaniesClient';
import { requireAdmin, revalidateAdminPaths, type ActionState } from '../admin-helpers';

type FormAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>;

export default async function AdminCompaniesPage() {
  await requireAdmin();

  const [companies, organizations] = await Promise.all([getCompanies(), getOrganizations()]);

  const addCompanyAction: FormAction = async (_prevState, formData) => {
    'use server';
    await requireAdmin();
    const name = (formData.get('companyName') as string)?.trim();
    if (!name) {
      return { status: 'error', message: 'Enter a company name.' };
    }
    try {
      await createCompany(name);
      revalidateAdminPaths();
      return { status: 'success', message: 'Company created.' };
    } catch (error) {
      console.error('Failed to create company', error);
      return { status: 'error', message: 'Unable to create company.' };
    }
  };

  const manageCompanyAction: FormAction = async (_prevState, formData) => {
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
        revalidateAdminPaths();
        return { status: 'success', message: 'Company deleted.' };
      }
      const name = (formData.get('companyName') as string)?.trim();
      if (!name) {
        return { status: 'error', message: 'Enter a company name.' };
      }
      await updateCompany(companyId, name);
      revalidateAdminPaths();
      return { status: 'success', message: 'Company updated.' };
    } catch (error) {
      console.error('Failed to update company', error);
      return { status: 'error', message: 'Unable to update company.' };
    }
  };

  const addOrganizationAction: FormAction = async (_prevState, formData) => {
    'use server';
    await requireAdmin();
    const name = (formData.get('organizationName') as string)?.trim();
    if (!name) {
      return { status: 'error', message: 'Enter an organization name.' };
    }
    try {
      await createOrganization(name);
      revalidateAdminPaths();
      return { status: 'success', message: 'Organization created.' };
    } catch (error) {
      console.error('Failed to create organization', error);
      return { status: 'error', message: 'Unable to create organization.' };
    }
  };

  const manageOrganizationAction: FormAction = async (_prevState, formData) => {
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
        revalidateAdminPaths();
        return { status: 'success', message: 'Organization deleted.' };
      }
      const name = (formData.get('organizationName') as string)?.trim();
      if (!name) {
        return { status: 'error', message: 'Enter an organization name.' };
      }
      await updateOrganization(organizationId, name);
      revalidateAdminPaths();
      return { status: 'success', message: 'Organization updated.' };
    } catch (error) {
      console.error('Failed to update organization', error);
      return { status: 'error', message: 'Unable to update organization.' };
    }
  };

  return (
    <AdminCompaniesClient
      companies={companies}
      organizations={organizations}
      addCompanyAction={addCompanyAction}
      manageCompanyAction={manageCompanyAction}
      addOrganizationAction={addOrganizationAction}
      manageOrganizationAction={manageOrganizationAction}
    />
  );
}

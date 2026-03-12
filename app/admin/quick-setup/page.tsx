export const dynamic = 'force-dynamic';

import { revalidatePath } from 'next/cache';
import {
  createCompany,
  createOrganization,
  createUserWithRole,
  createDashboard,
  getCompanies,
  getOrganizations,
  getUser,
} from 'app/db';
import AdminShell from '../AdminShell';
import { parseSheetLink, requireAdmin } from '../admin-utils';
import QuickSetupClient from './QuickSetupClient';
import type { ActionState } from '../types';

type QuickSetupState = ActionState & {
  createdCompanyId?: number;
  createdOrganizationId?: number;
  createdUserId?: number;
  createdDashboardId?: number;
};

export default async function QuickSetupPage() {
  await requireAdmin();
  const [companies, organizations] = await Promise.all([getCompanies(), getOrganizations()]);

  async function quickSetupAction(
    _prevState: QuickSetupState,
    formData: FormData,
  ): Promise<QuickSetupState> {
    'use server';
    await requireAdmin();

    const companyName = (formData.get('companyName') as string)?.trim();
    const fleetName = (formData.get('fleetName') as string)?.trim();
    const userEmail = (formData.get('userEmail') as string)?.trim();
    const userPassword = (formData.get('userPassword') as string)?.trim();
    const dashboardName = (formData.get('dashboardName') as string)?.trim();
    const template = (formData.get('template') as string)?.trim() || 'Summary';
    const sheetUrl = (formData.get('sheetUrl') as string)?.trim();

    const useExistingCompany = formData.get('useExistingCompany') === 'on';
    const existingCompanyId = Number(formData.get('existingCompanyId'));
    const useExistingFleet = formData.get('useExistingFleet') === 'on';
    const existingFleetId = Number(formData.get('existingFleetId'));

    if (!useExistingCompany && !companyName) {
      return { status: 'error', message: 'Enter a company name or select an existing one.' };
    }
    if (!dashboardName || !sheetUrl) {
      return { status: 'error', message: 'Dashboard name and sheet link are required.' };
    }

    const { sheetId, sheetGid } = parseSheetLink(sheetUrl);
    if (!sheetId) {
      return { status: 'error', message: 'Enter a valid Google Sheet link.' };
    }

    try {
      // Step 1: Company
      let companyId: number;
      if (useExistingCompany && existingCompanyId) {
        companyId = existingCompanyId;
      } else {
        const result = await createCompany(companyName);
        companyId = result.id;
      }

      // Step 2: Fleet (optional)
      let organizationId: number | null = null;
      if (useExistingFleet && existingFleetId) {
        organizationId = existingFleetId;
      } else if (fleetName) {
        const result = await createOrganization(fleetName, companyId);
        organizationId = result.id;
      }

      // Step 3: User (optional)
      let userId: number | undefined;
      if (userEmail && userPassword) {
        const existing = await getUser(userEmail);
        if (existing.length > 0) {
          return { status: 'error', message: `User ${userEmail} already exists.` };
        }
        const result = await createUserWithRole({ email: userEmail, password: userPassword, isAdmin: false });
        userId = result.id;
      }

      // Step 4: Dashboard
      const dashboard = await createDashboard({
        name: dashboardName,
        template,
        sheetUrl,
        sheetId,
        sheetGid,
        companyId,
        organizationId,
        notes: null,
      });

      revalidatePath('/admin');
      revalidatePath('/admin/companies');
      revalidatePath('/admin/organizations');
      revalidatePath('/admin/users');
      revalidatePath('/admin/dashboards');
      revalidatePath('/dashboard');

      return {
        status: 'success',
        message: 'Customer setup complete! Company, dashboard, and all resources have been created.',
        createdCompanyId: companyId,
        createdOrganizationId: organizationId ?? undefined,
        createdUserId: userId,
        createdDashboardId: dashboard.id,
      };
    } catch (error) {
      console.error('Quick setup failed', error);
      return { status: 'error', message: 'Setup failed. Check the server logs for details.' };
    }
  }

  return (
    <AdminShell
      backHref="/admin"
      backLabel="Back to admin overview"
      eyebrow="Quick setup"
      title="Onboard a new customer"
      description="Create a company, fleet, user account, and dashboard in one step."
    >
      <QuickSetupClient
        companies={companies}
        organizations={organizations}
        quickSetupAction={quickSetupAction}
      />
    </AdminShell>
  );
}

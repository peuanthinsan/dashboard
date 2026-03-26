export const dynamic = 'force-dynamic';

import { revalidatePath } from 'next/cache';
import {
  createCompany,
  createOrganization,
  createUserWithRole,
  createDashboard,
  getCompanies,
  getOrganizations,
  getOrganizationById,
  getUser,
  updateUserAssignments,
} from 'app/db';
import { bulkCreateDashboards } from 'app/db-bulk';
import AdminShell from '../AdminShell';
import { parseSheetLink, requireAdmin } from '../admin-utils';
import { getDashboardLang } from 'app/dashboard/i18n';
import { getAdminCopy } from '../i18n-copy';
import QuickSetupClient from './QuickSetupClient';
import type { ActionState } from '../types';

const COMPLETE_SET_TEMPLATES = ['Summary', 'Simple', 'Detail', 'Driving'] as const;

type QuickSetupState = ActionState & {
  createdCompanyId?: number;
  createdOrganizationId?: number;
  createdOrganizationIds?: number[];
  createdUserId?: number;
  createdDashboardId?: number;
  createdDashboardCount?: number;
};

export default async function QuickSetupPage() {
  await requireAdmin();
  const lang = await getDashboardLang();
  const copy = getAdminCopy(lang);
  const [companies, organizations] = await Promise.all([getCompanies(), getOrganizations()]);

  async function quickSetupAction(
    _prevState: QuickSetupState,
    formData: FormData,
  ): Promise<QuickSetupState> {
    'use server';
    await requireAdmin();

    const companyName = (formData.get('companyName') as string)?.trim();
    const fleetNamesRaw = (formData.get('fleetNames') as string) ?? '';
    const fleetNameLines = fleetNamesRaw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const userEmail = (formData.get('userEmail') as string)?.trim();
    const userPassword = (formData.get('userPassword') as string)?.trim();
    const dashboardName = (formData.get('dashboardName') as string)?.trim();
    const template = (formData.get('template') as string)?.trim() || 'Summary';
    const sheetUrl = (formData.get('sheetUrl') as string)?.trim();
    const createCompleteSet = formData.get('createCompleteSet') === 'on';

    const useExistingCompany = formData.get('useExistingCompany') === 'on';
    const existingCompanyId = Number(formData.get('existingCompanyId'));
    const useExistingFleet = formData.get('useExistingFleet') === 'on';
    const existingFleetId = Number(formData.get('existingFleetId'));
    const dashboardFleetTarget = ((formData.get('dashboardFleetTarget') as string) ?? '__none__').trim();

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

      // Step 2: Fleet(s) (optional)
      let organizationId: number | null = null;
      const organizationIdsForUser: number[] = [];

      if (useExistingFleet && existingFleetId) {
        const fleetRows = await getOrganizationById(existingFleetId);
        const fleet = fleetRows[0];
        if (fleet?.companyId != null && fleet.companyId !== companyId) {
          return { status: 'error', message: 'Selected fleet does not belong to the selected company.' };
        }
        organizationId = existingFleetId;
        organizationIdsForUser.push(existingFleetId);
      } else if (fleetNameLines.length > 0) {
        const createdPairs: { name: string; id: number }[] = [];
        for (const name of fleetNameLines) {
          try {
            const result = await createOrganization(name, companyId);
            createdPairs.push({ name, id: result.id });
          } catch {
            // duplicate global fleet name or DB error — skip this line
          }
        }
        if (createdPairs.length === 0) {
          return {
            status: 'error',
            message:
              'No fleets could be created. Each fleet name must be unique across the whole system. Check for duplicates and try again.',
          };
        }
        organizationIdsForUser.push(...createdPairs.map((p) => p.id));

        if (createdPairs.length === 1) {
          organizationId = createdPairs[0].id;
        } else if (dashboardFleetTarget === '__none__' || dashboardFleetTarget === '') {
          organizationId = null;
        } else {
          const match = createdPairs.find((p) => p.name === dashboardFleetTarget);
          organizationId = match?.id ?? createdPairs[0].id;
        }
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
        await updateUserAssignments(userId, {
          companyIds: [companyId],
          organizationIds: organizationIdsForUser,
          isAdmin: false,
        });
      }

      // Step 4: Dashboard(s)
      let createdDashboardId: number | undefined;
      let createdDashboardCount: number;

      if (createCompleteSet) {
        const items = COMPLETE_SET_TEMPLATES.map((t) => ({
          name: dashboardName,
          template: t,
          sheetId,
          sheetGid,
          sheetUrl,
          companyId,
          organizationId: organizationId ?? undefined,
          notes: undefined as string | undefined,
        }));
        const result = await bulkCreateDashboards(items);
        createdDashboardCount = result.created;
        createdDashboardId = undefined;
      } else {
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
        createdDashboardId = dashboard.id;
        createdDashboardCount = 1;
      }

      revalidatePath('/admin');
      revalidatePath('/admin/companies');
      revalidatePath('/admin/organizations');
      revalidatePath('/admin/users');
      revalidatePath('/admin/dashboards');
      revalidatePath('/dashboard');

      const dashboardMsg =
        createCompleteSet
          ? `${createdDashboardCount} dashboards (complete set)`
          : 'dashboard';

      const fleetCount = organizationIdsForUser.length;
      const fleetSummary =
        fleetCount === 0
          ? ''
          : fleetCount === 1
            ? '1 fleet, '
            : `${fleetCount} fleets, `;

      return {
        status: 'success',
        message: `Customer setup complete! Company, ${fleetSummary}${dashboardMsg}, and related resources have been created.`,
        createdCompanyId: companyId,
        createdOrganizationId: organizationId ?? undefined,
        createdOrganizationIds: organizationIdsForUser.length > 1 ? organizationIdsForUser : undefined,
        createdUserId: userId,
        createdDashboardId,
        createdDashboardCount,
      };
    } catch (error) {
      console.error('Quick setup failed', error);
      return { status: 'error', message: 'Setup failed. Check the server logs for details.' };
    }
  }

  return (
    <AdminShell
      backHref="/admin"
      backLabel={copy.backToAdminOverview}
      eyebrow={copy.quickSetup}
      title={copy.onboardNewCustomer}
      description={copy.onboardNewCustomerDesc}
      lang={lang}
    >
      <QuickSetupClient
        companies={companies}
        organizations={organizations}
        quickSetupAction={quickSetupAction}
      />
    </AdminShell>
  );
}

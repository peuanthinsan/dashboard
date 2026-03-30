export const dynamic = 'force-dynamic';

import { revalidatePath } from 'next/cache';
import {
  createCompany,
  createOrganization,
  createUserWithRole,
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

const TEMPLATE_ORDER = ['Summary', 'Simple', 'Detail', 'Driving'] as const;
const ALLOWED_TEMPLATES = new Set<string>(TEMPLATE_ORDER);

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
    const sheetUrl = (formData.get('sheetUrl') as string)?.trim();
    const drivingSheetUrlOptional = (formData.get('drivingSheetUrl') as string)?.trim();
    const rawTemplates = formData.getAll('templates').filter((v): v is string => typeof v === 'string');
    const selectedTemplateSet = new Set(rawTemplates.filter((t) => ALLOWED_TEMPLATES.has(t)));
    const selectedTemplates = TEMPLATE_ORDER.filter((t) => selectedTemplateSet.has(t));

    const useExistingCompany = formData.get('useExistingCompany') === 'on';
    const existingCompanyId = Number(formData.get('existingCompanyId'));
    const useExistingFleet = formData.get('useExistingFleet') === 'on';
    const existingFleetIdRaw = formData.getAll('existingFleetId');
    const existingFleetIds = Array.from(
      new Set(
        existingFleetIdRaw
          .filter((v): v is string => typeof v === 'string')
          .map((v) => Number(v))
          .filter((n) => Number.isFinite(n) && n > 0),
      ),
    );
    const dashboardFleetTarget = ((formData.get('dashboardFleetTarget') as string) ?? '__none__').trim();

    if (!useExistingCompany && !companyName) {
      return { status: 'error', message: 'Enter a company name or select an existing one.' };
    }
    if (!dashboardName || !sheetUrl) {
      return { status: 'error', message: 'Dashboard name and sheet link are required.' };
    }
    if (selectedTemplates.length === 0) {
      return { status: 'error', message: 'Select at least one dashboard template.' };
    }

    const mainSheet = parseSheetLink(sheetUrl);
    const mainSheetId = mainSheet.sheetId;
    if (!mainSheetId) {
      return { status: 'error', message: 'Enter a valid Google Sheet link.' };
    }
    const mainSheetGid = mainSheet.sheetGid;

    const includesDriving = selectedTemplates.includes('Driving');
    let drivingSheet: { sheetId: string; sheetGid: string; sheetUrl: string } | null = null;
    if (includesDriving && drivingSheetUrlOptional) {
      const parsed = parseSheetLink(drivingSheetUrlOptional);
      if (!parsed.sheetId) {
        return {
          status: 'error',
          message: 'The driving / driver report sheet link is invalid. Fix it or leave that field blank.',
        };
      }
      drivingSheet = {
        sheetId: parsed.sheetId,
        sheetGid: parsed.sheetGid,
        sheetUrl: drivingSheetUrlOptional,
      };
    }

    const sheetForTemplate = (t: string) => {
      if (t === 'Driving' && drivingSheet) {
        return drivingSheet;
      }
      return {
        sheetId: mainSheetId,
        sheetGid: mainSheetGid,
        sheetUrl,
      };
    };

    try {
      // Step 1: Company
      let companyId: number;
      if (useExistingCompany && existingCompanyId) {
        companyId = existingCompanyId;
      } else {
        const result = await createCompany(companyName);
        companyId = result.id;
      }

      // Step 2: Fleet(s) (optional) — existing (multi) or newly created names
      const organizationIdsForUser: number[] = [];
      let fleetPairs: { name: string; id: number }[] = [];

      if (useExistingFleet) {
        for (const fid of existingFleetIds) {
          const fleetRows = await getOrganizationById(fid);
          const fleet = fleetRows[0];
          if (!fleet) {
            return { status: 'error', message: 'One or more selected fleets were not found.' };
          }
          if (fleet.companyId != null && fleet.companyId !== companyId) {
            return { status: 'error', message: 'Every selected fleet must belong to the company you chose.' };
          }
          organizationIdsForUser.push(fid);
          const fleetLabel = fleet.name?.trim() ? fleet.name.trim() : `Fleet #${fid}`;
          fleetPairs.push({ name: fleetLabel, id: fid });
        }
      } else if (fleetNameLines.length > 0) {
        for (const name of fleetNameLines) {
          try {
            const result = await createOrganization(name, companyId);
            fleetPairs.push({ name, id: result.id });
          } catch {
            // duplicate global fleet name or DB error — skip this line
          }
        }
        if (fleetPairs.length === 0) {
          return {
            status: 'error',
            message:
              'No fleets could be created. Each fleet name must be unique across the whole system. Check for duplicates and try again.',
          };
        }
        organizationIdsForUser.push(...fleetPairs.map((p) => p.id));
      }

      // Which fleet(s) get the new dashboard(s): one org, all fleets, or company-level only
      let dashboardOrganizationTargets: (number | null)[];
      if (fleetPairs.length === 0) {
        dashboardOrganizationTargets = [null];
      } else if (fleetPairs.length === 1) {
        dashboardOrganizationTargets = [fleetPairs[0].id];
      } else if (dashboardFleetTarget === '__all__') {
        dashboardOrganizationTargets = fleetPairs.map((p) => p.id);
      } else if (dashboardFleetTarget === '__none__' || dashboardFleetTarget === '') {
        dashboardOrganizationTargets = [null];
      } else {
        const match = fleetPairs.find((p) => p.name === dashboardFleetTarget);
        dashboardOrganizationTargets = [match?.id ?? fleetPairs[0].id];
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

      // Dashboards — one row per (fleet target × selected template)
      const items: {
        name: string;
        template: string;
        sheetId: string;
        sheetGid: string;
        sheetUrl: string;
        companyId: number;
        organizationId?: number;
        notes?: string;
      }[] = [];
      for (const orgTarget of dashboardOrganizationTargets) {
        for (const t of selectedTemplates) {
          const s = sheetForTemplate(t);
          items.push({
            name: dashboardName,
            template: t,
            sheetId: s.sheetId,
            sheetGid: s.sheetGid,
            sheetUrl: s.sheetUrl,
            companyId,
            organizationId: orgTarget ?? undefined,
            notes: undefined,
          });
        }
      }
      const result = await bulkCreateDashboards(items);
      const createdDashboardCount = result.created;
      const createdDashboardId = undefined;

      revalidatePath('/admin');
      revalidatePath('/admin/companies');
      revalidatePath('/admin/organizations');
      revalidatePath('/admin/users');
      revalidatePath('/admin/dashboards');
      revalidatePath('/dashboard');

      const fleetTargetsCount = dashboardOrganizationTargets.filter((id) => id != null).length;
      const tplPart =
        selectedTemplates.length === TEMPLATE_ORDER.length
          ? 'full template set'
          : `${selectedTemplates.length} template${selectedTemplates.length === 1 ? '' : 's'}`;
      const dashboardMsg = `${createdDashboardCount} dashboard${createdDashboardCount === 1 ? '' : 's'} (${tplPart}${
        fleetTargetsCount > 1 ? ` × ${fleetTargetsCount} fleets` : ''
      })`;

      const fleetCount = organizationIdsForUser.length;
      const fleetSummary =
        fleetCount === 0
          ? ''
          : fleetCount === 1
            ? '1 fleet, '
            : `${fleetCount} fleets, `;

      const singleOrgForBadge =
        dashboardOrganizationTargets.length === 1
          ? dashboardOrganizationTargets[0]
          : undefined;

      return {
        status: 'success',
        message: `Customer setup complete! Company, ${fleetSummary}${dashboardMsg}, and related resources have been created.`,
        createdCompanyId: companyId,
        createdOrganizationId: singleOrgForBadge ?? undefined,
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

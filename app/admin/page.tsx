export const dynamic = 'force-dynamic';

import Link from 'next/link';
import AdminShell from './AdminShell';
import { AdminSection, AdminSectionHeader, AdminStatCard } from './admin-components';
import { requireAdmin } from './admin-utils';
import { getCompanies, getOrganizations, getUsers, getDashboards } from 'app/db';
import { getDashboardLang } from 'app/dashboard/i18n';
import { getAdminCopy } from './i18n-copy';
import { btnPrimary, cardHover, badgeInfo, heading2, heading3, textSecondary } from 'app/ui/design-tokens';

function SetupCard({
  step,
  href,
  title,
  description,
  count,
  workflowHint,
  openSectionLabel,
}: {
  step: number;
  href: string;
  title: string;
  description: string;
  count: number;
  workflowHint: string;
  openSectionLabel: string;
}) {
  return (
    <Link href={href} className={`${cardHover} group flex flex-col gap-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 gap-4">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-700 transition group-hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:group-hover:bg-zinc-600"
            aria-hidden
          >
            {step}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={heading2}>{title}</span>
              <span className={badgeInfo}>{count}</span>
            </div>
            <p className={`mt-2 leading-relaxed ${textSecondary}`}>{description}</p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{workflowHint}</p>
          </div>
        </div>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition group-hover:bg-zinc-100 group-hover:text-zinc-600 dark:group-hover:bg-zinc-800 dark:group-hover:text-zinc-300"
          aria-hidden
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </span>
      </div>
      <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">{openSectionLabel}</span>
    </Link>
  );
}

export default async function AdminPage() {
  await requireAdmin();
  const lang = await getDashboardLang();
  const copy = getAdminCopy(lang);
  const [companies, organizations, users, dashboards] = await Promise.all([
    getCompanies(),
    getOrganizations(),
    getUsers(),
    getDashboards(),
  ]);

  const adminCount = users.filter((u) => u.isAdmin).length;

  return (
    <AdminShell
      backHref="/dashboard"
      backLabel={copy.backToDashboards}
      eyebrow={copy.adminHub}
      title={copy.administration}
      description={copy.adminDescription}
      lang={lang}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard label={copy.companies} value={companies.length} description={copy.activeCompanyProfiles} />
        <AdminStatCard label={copy.fleets} value={organizations.length} description={copy.fleetGroupsConfigured} />
        <AdminStatCard label={copy.users} value={users.length} description={copy.adminsCount(adminCount)} />
        <AdminStatCard label={copy.dashboardsNav} value={dashboards.length} description={copy.acrossAllCompanies} />
      </div>

      <AdminSection>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className={heading3}>{copy.newCustomerCta}</h2>
            <p className={`mt-1 ${textSecondary}`}>{copy.quickSetupDesc}</p>
          </div>
          <Link href="/admin/quick-setup" className={btnPrimary}>
            {copy.startQuickSetup}
          </Link>
        </div>
      </AdminSection>

      <AdminSection>
        <AdminSectionHeader
          title={copy.administrationSections}
          description={copy.setupFlowSummary}
          count={4}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SetupCard
            step={1}
            href="/admin/companies"
            title={copy.companies}
            description={copy.createAndManage}
            count={companies.length}
            workflowHint={copy.workflowCompanies}
            openSectionLabel={copy.openSection}
          />
          <SetupCard
            step={2}
            href="/admin/organizations"
            title={copy.fleets}
            description={copy.createAndManageFleets}
            count={organizations.length}
            workflowHint={copy.workflowFleets}
            openSectionLabel={copy.openSection}
          />
          <SetupCard
            step={3}
            href="/admin/dashboards"
            title={copy.dashboardsNav}
            description={copy.setTemplatesAndLinks}
            count={dashboards.length}
            workflowHint={copy.workflowDashboards}
            openSectionLabel={copy.openSection}
          />
          <SetupCard
            step={4}
            href="/admin/users"
            title={copy.users}
            description={copy.assignUsersCompaniesFleets}
            count={users.length}
            workflowHint={copy.workflowUsers}
            openSectionLabel={copy.openSection}
          />
        </div>
      </AdminSection>
    </AdminShell>
  );
}

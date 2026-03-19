export const dynamic = 'force-dynamic';

import Link from 'next/link';
import AdminShell from './AdminShell';
import { AdminSection, AdminSectionHeader, AdminStatCard } from './admin-components';
import { requireAdmin } from './admin-utils';
import { getCompanies, getOrganizations, getUsers, getDashboards } from 'app/db';
import { getDashboardLang } from 'app/dashboard/i18n';
import { getAdminCopy } from './i18n-copy';
import { btnPrimary, cardHover, badgeInfo, heading3, textSecondary } from 'app/ui/design-tokens';

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

  const sections = [
    { href: '/admin/companies', title: copy.companies, description: copy.createAndManage, count: companies.length, badge: copy.manageProfiles },
    { href: '/admin/organizations', title: copy.fleets, description: copy.createAndManageFleets, count: organizations.length, badge: copy.manageGroups },
    { href: '/admin/users', title: copy.users, description: copy.assignUsersCompaniesFleets, count: users.length, badge: copy.accessAndRoles },
    { href: '/admin/dashboards', title: copy.dashboardsNav, description: copy.setTemplatesAndLinks, count: dashboards.length, badge: copy.templatesAndLinks },
  ];

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
        <AdminSectionHeader
          title={copy.administrationSections}
          description={copy.administrationSectionsDesc}
          count={4}
        />
        <div className="grid gap-4 md:grid-cols-2">
          {sections.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className={`${cardHover} group flex flex-col gap-3`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={heading3}>{card.title}</span>
                    <span className={badgeInfo}>{card.count}</span>
                  </div>
                  <p className={`mt-2 ${textSecondary}`}>{card.description}</p>
                </div>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition group-hover:bg-zinc-100 group-hover:text-zinc-600 dark:group-hover:bg-zinc-800 dark:group-hover:text-zinc-300">
                  <svg
                    aria-hidden="true"
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
              <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
                {copy.openSection}
              </span>
            </Link>
          ))}
        </div>
      </AdminSection>

      <AdminSection className="sm:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className={heading3}>{copy.quickSetup}</h2>
            <p className={`mt-1 ${textSecondary}`}>
              {copy.quickSetupDesc}
            </p>
          </div>
          <Link href="/admin/quick-setup" className={btnPrimary}>
            {copy.startQuickSetup}
          </Link>
        </div>
      </AdminSection>
    </AdminShell>
  );
}

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import AdminShell from './AdminShell';
import { AdminSection, AdminSectionHeader, AdminStatCard } from './admin-components';
import { requireAdmin } from './admin-utils';
import { getCompanies, getOrganizations, getUsers, getDashboards } from 'app/db';
import { btnPrimary, cardHover, badgeInfo, heading3, textSecondary } from 'app/ui/design-tokens';

export default async function AdminPage() {
  await requireAdmin();
  const [companies, organizations, users, dashboards] = await Promise.all([
    getCompanies(),
    getOrganizations(),
    getUsers(),
    getDashboards(),
  ]);

  const adminCount = users.filter((u) => u.isAdmin).length;

  const sections = [
    {
      href: '/admin/companies',
      title: 'Companies',
      description: 'Create and manage company profiles.',
      count: companies.length,
      badge: 'Profiles',
    },
    {
      href: '/admin/organizations',
      title: 'Fleets',
      description: 'Create and manage fleet groups.',
      count: organizations.length,
      badge: 'Groups',
    },
    {
      href: '/admin/users',
      title: 'Users',
      description: 'Assign users, companies, and fleets.',
      count: users.length,
      badge: 'Access',
    },
    {
      href: '/admin/dashboards',
      title: 'Dashboards',
      description: 'Set templates and Google Sheet links.',
      count: dashboards.length,
      badge: 'Templates',
    },
  ];

  return (
    <AdminShell
      backHref="/dashboard"
      backLabel="Back to dashboards"
      eyebrow="Admin hub"
      title="Administration"
      description="Manage companies, fleets, users, and dashboards from one place."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard label="Companies" value={companies.length} description="Active company profiles" />
        <AdminStatCard label="Fleets" value={organizations.length} description="Fleet groups configured" />
        <AdminStatCard label="Users" value={users.length} description={`${adminCount} admin${adminCount !== 1 ? 's' : ''}`} />
        <AdminStatCard label="Dashboards" value={dashboards.length} description="Across all companies" />
      </div>

      <AdminSection>
        <AdminSectionHeader
          title="Administration sections"
          description="Manage company data, fleet structure, users, and dashboard templates."
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
                Open section
              </span>
            </Link>
          ))}
        </div>
      </AdminSection>

      <AdminSection className="sm:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className={heading3}>Quick setup</h2>
            <p className={`mt-1 ${textSecondary}`}>
              Onboard a new customer in minutes — create company, fleet, user, and dashboard in one flow.
            </p>
          </div>
          <Link href="/admin/quick-setup" className={btnPrimary}>
            Start quick setup
          </Link>
        </div>
      </AdminSection>
    </AdminShell>
  );
}

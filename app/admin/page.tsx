import Link from 'next/link';
import { badgeClass, cardClass, iconButtonClass } from 'app/ui/classNames';
import AdminShell from './AdminShell';
import { AdminSection, AdminSectionHeader } from './admin-components';
import { requireAdmin } from './admin-utils';

export default async function AdminPage() {
  await requireAdmin();

  return (
    <AdminShell
      backHref="/dashboard"
      backLabel="Back to dashboards"
      eyebrow="Admin hub"
      title="Administration"
      description="Choose a section to manage companies, organizations, users, and dashboards."
    >
      <AdminSection>
        <AdminSectionHeader
          title="Administration sections"
          description="Manage company data, org structure, users, and dashboard templates."
          count={4}
        />
        <div className="grid gap-4 md:grid-cols-2">
          {[
            {
              href: '/admin/companies',
              title: 'Companies',
              description: 'Create and manage company profiles.',
              badge: 'Profiles',
            },
            {
              href: '/admin/organizations',
              title: 'Organizations',
              description: 'Create and manage organization groups.',
              badge: 'Groups',
            },
            {
              href: '/admin/users',
              title: 'Users',
              description: 'Assign users, companies, and organizations.',
              badge: 'Access',
            },
            {
              href: '/admin/dashboards',
              title: 'Dashboards',
              description: 'Set templates and Google Sheet links.',
              badge: 'Templates',
            },
          ].map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className={cardClass}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-base font-semibold text-slate-900 dark:text-white">
                      {card.title}
                    </span>
                    <div className={badgeClass}>
                      <span className="h-2 w-2 rounded-full bg-emerald-400/80 dark:bg-emerald-300" />
                      {card.badge}
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                    {card.description}
                  </p>
                </div>
                <span className={iconButtonClass}>
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
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                Open section
              </span>
            </Link>
          ))}
        </div>
      </AdminSection>
    </AdminShell>
  );
}

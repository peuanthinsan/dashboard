import Link from 'next/link';
import AdminShell from './AdminShell';
import { requireAdmin } from './admin-utils';

const ADMIN_SECTIONS = [
  {
    href: '/admin/companies',
    title: 'Companies',
    description: 'Create and update companies that dashboards belong to.',
  },
  {
    href: '/admin/organizations',
    title: 'Organizations',
    description: 'Set up organization filters for dashboards and user access.',
  },
  {
    href: '/admin/users',
    title: 'Users',
    description: 'Invite users, reset passwords, and assign access.',
  },
  {
    href: '/admin/dashboards',
    title: 'Dashboards',
    description: 'Manage the dashboards and their Google Sheet sources.',
  },
];

export default async function AdminPage() {
  await requireAdmin();

  return (
    <AdminShell
      title="Administration"
      description="Choose a section to manage companies, users, and dashboard access."
    >
      <section className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
        <h2 className="text-lg font-medium">Manage</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {ADMIN_SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="group flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition hover:border-slate-600"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-white">{section.title}</h3>
                <span className="text-sm text-slate-400 transition group-hover:text-slate-200">
                  Open →
                </span>
              </div>
              <p className="text-sm text-slate-400">{section.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}

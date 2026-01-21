import Link from 'next/link';
import { requireAdmin } from './requireAdmin';

const ADMIN_SECTIONS = [
  {
    title: 'Companies',
    description: 'Create and manage companies connected to dashboards.',
    href: '/admin/companies',
  },
  {
    title: 'Organizations',
    description: 'Manage organization groupings for company dashboards.',
    href: '/admin/organizations',
  },
  {
    title: 'Users',
    description: 'Assign users to companies or organizations and grant admin access.',
    href: '/admin/users',
  },
  {
    title: 'Dashboards',
    description: 'Create dashboards, assign templates, and link Google Sheets.',
    href: '/admin/dashboards',
  },
];

export default async function AdminPage() {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <Link
            href="/dashboard"
            className="inline-flex w-fit items-center gap-2 text-sm text-slate-300 transition hover:text-white"
          >
            <span aria-hidden="true">←</span>
            Back to dashboards
          </Link>
          <h1 className="text-3xl font-semibold">Administration</h1>
          <p className="text-sm text-slate-300">
            Choose a section to manage companies, users, organizations, or dashboards.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          {ADMIN_SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="group flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg transition hover:border-slate-600"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">{section.title}</h2>
                <span className="text-sm text-slate-400 transition group-hover:text-white">
                  View →
                </span>
              </div>
              <p className="text-sm text-slate-300">{section.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

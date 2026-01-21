import Link from 'next/link';
import AdminNav from './AdminNav';
import { requireAdmin } from './admin-utils';

export default async function AdminPage() {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-[1252px] flex-col gap-8">
        <header className="flex flex-col gap-3">
          <Link
            href="/dashboard"
            className="inline-flex w-fit items-center gap-2 text-sm text-slate-300 transition hover:text-white"
          >
            <span aria-hidden="true">←</span>
            Back to dashboards
          </Link>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold sm:text-3xl">Administration</h1>
            <p className="text-sm text-slate-300">
              Choose a section to manage companies, organizations, users, and dashboards.
            </p>
          </div>
          <AdminNav />
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {[
            {
              href: '/admin/companies',
              title: 'Companies',
              description: 'Create and manage company profiles.',
            },
            {
              href: '/admin/organizations',
              title: 'Organizations',
              description: 'Create and manage organization groups.',
            },
            {
              href: '/admin/users',
              title: 'Users',
              description: 'Assign users, companies, and organizations.',
            },
            {
              href: '/admin/dashboards',
              title: 'Dashboards',
              description: 'Set templates and Google Sheet links.',
            },
          ].map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="flex h-full flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg transition hover:border-slate-600"
            >
              <h2 className="text-lg font-semibold">{card.title}</h2>
              <p className="text-sm text-slate-300">{card.description}</p>
              <span className="mt-auto text-sm text-indigo-300">Open section →</span>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}

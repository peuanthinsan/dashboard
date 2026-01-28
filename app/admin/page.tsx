import Link from 'next/link';
import AdminNav from './AdminNav';
import { requireAdmin } from './admin-utils';

export default async function AdminPage() {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 px-4 py-8 text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-white sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-[1252px] flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/70">
          <Link
            href="/dashboard"
            className="inline-flex w-fit items-center gap-2 text-sm text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          >
            <span aria-hidden="true">←</span>
            Back to dashboards
          </Link>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              Admin hub
            </p>
            <h1 className="text-2xl font-semibold sm:text-3xl">Administration</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
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
              className="group flex h-full flex-col gap-2 rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-lg transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-2xl dark:border-slate-800/80 dark:bg-slate-900/60 dark:hover:border-slate-600"
            >
              <h2 className="text-lg font-semibold">{card.title}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">{card.description}</p>
              <span className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-indigo-500 transition group-hover:text-indigo-600 dark:text-indigo-300 dark:group-hover:text-indigo-200">
                Open section
                <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}

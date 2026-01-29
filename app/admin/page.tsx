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

        <section className="grid gap-6 rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/70">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Administration sections</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Manage company data, org structure, users, and dashboard templates.
              </p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
              4 total
            </span>
          </div>

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
                className="group flex h-full flex-col justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl dark:border-slate-800/80 dark:bg-slate-950/60 dark:hover:border-slate-600"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-base font-semibold text-slate-900 dark:text-white">
                        {card.title}
                      </span>
                      <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
                        <span className="h-2 w-2 rounded-full bg-emerald-400/80 dark:bg-emerald-300" />
                        {card.badge}
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                      {card.description}
                    </p>
                  </div>
                  <span className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-500 transition group-hover:border-indigo-200 group-hover:bg-indigo-50 group-hover:text-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:border-indigo-500/40 dark:group-hover:bg-indigo-500/10 dark:group-hover:text-indigo-200">
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
        </section>
      </div>
    </div>
  );
}

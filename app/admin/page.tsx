import Link from 'next/link';
import { requireAdmin } from './admin-helpers';

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
            Choose a section to manage companies, users, and dashboards.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <Link
            href="/admin/companies"
            className="flex h-full flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg transition hover:border-slate-600"
          >
            <h2 className="text-lg font-semibold">Companies & organizations</h2>
            <p className="text-sm text-slate-300">
              Create companies and organizations that dashboards and users depend on.
            </p>
            <span className="mt-auto text-sm font-medium text-indigo-300">
              Manage companies →
            </span>
          </Link>

          <Link
            href="/admin/users"
            className="flex h-full flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg transition hover:border-slate-600"
          >
            <h2 className="text-lg font-semibold">Users</h2>
            <p className="text-sm text-slate-300">
              Invite admins and control access to companies and organizations.
            </p>
            <span className="mt-auto text-sm font-medium text-indigo-300">Manage users →</span>
          </Link>

          <Link
            href="/admin/dashboards"
            className="flex h-full flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg transition hover:border-slate-600"
          >
            <h2 className="text-lg font-semibold">Dashboards</h2>
            <p className="text-sm text-slate-300">
              Configure dashboards, sheet links, and templates per company.
            </p>
            <span className="mt-auto text-sm font-medium text-indigo-300">
              Manage dashboards →
            </span>
          </Link>
        </section>
      </div>
    </div>
  );
}

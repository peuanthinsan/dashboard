'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import {
  DASHBOARD_TEMPLATES,
  DashboardRow,
  INITIAL_STATE,
  StatusMessage,
  useRefreshOnSuccess,
  type ActionState,
  type Company,
  type Dashboard,
  type FormAction,
  type Organization,
} from '../components/AdminShared';

type AdminDashboardsClientProps = {
  dashboards: Dashboard[];
  companies: Company[];
  organizations: Organization[];
  addDashboardAction: FormAction;
  manageDashboardAction: FormAction;
};

export default function AdminDashboardsClient({
  dashboards,
  companies,
  organizations,
  addDashboardAction,
  manageDashboardAction,
}: AdminDashboardsClientProps) {
  const [dashboardCreateState, dashboardCreateAction] = useFormState(
    addDashboardAction,
    INITIAL_STATE,
  );

  useRefreshOnSuccess(dashboardCreateState);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <Link
            href="/admin"
            className="inline-flex w-fit items-center gap-2 text-sm text-slate-300 transition hover:text-white"
          >
            <span aria-hidden="true">←</span>
            Back to admin home
          </Link>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold">Dashboards</h1>
            <p className="text-sm text-slate-300">
              Create dashboards for a company, optionally filter by organization, and set the
              template + sheet link.
            </p>
          </div>
          <nav className="flex flex-wrap gap-3 text-sm text-slate-300">
            <Link href="/admin/companies" className="hover:text-white">
              Companies
            </Link>
            <span aria-hidden="true">•</span>
            <Link href="/admin/users" className="hover:text-white">
              Users
            </Link>
            <span aria-hidden="true">•</span>
            <Link href="/admin/dashboards" className="text-white">
              Dashboards
            </Link>
          </nav>
        </header>

        <section className="grid gap-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
          <form
            action={dashboardCreateAction}
            className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 md:grid-cols-2"
          >
            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-400">Dashboard name</label>
              <input
                name="dashboardName"
                placeholder="Operations overview"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-400">Google Sheet link</label>
              <input
                name="sheetUrl"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-400">Company</label>
              <select
                name="companyId"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              >
                <option value="">Select company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-400">Organization (optional)</label>
              <select
                name="organizationId"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              >
                <option value="">No organization</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-400">Template</label>
              <select
                name="template"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              >
                {DASHBOARD_TEMPLATES.map((template) => (
                  <option key={template} value={template}>
                    {template}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
              >
                Create dashboard
              </button>
            </div>
            <StatusMessage state={dashboardCreateState as ActionState} />
          </form>

          <div className="grid gap-4">
            {dashboards.length === 0 ? (
              <p className="text-sm text-slate-400">
                No dashboards yet. Create one to make it available to users.
              </p>
            ) : (
              dashboards.map((dashboard) => (
                <DashboardRow
                  key={dashboard.id}
                  dashboard={dashboard}
                  companies={companies}
                  organizations={organizations}
                  action={manageDashboardAction}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

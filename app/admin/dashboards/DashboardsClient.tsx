'use client';

import { useFormState } from 'react-dom';
import { confirmDelete, INITIAL_STATE, StatusMessage, useRefreshOnSuccess } from '../admin-client-utils';
import type { ActionState, Company, Dashboard, Organization } from '../types';

const DASHBOARD_TEMPLATES = ['Summary', 'Detail', 'Simple', 'Video Samples'] as const;

type FormAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>;

type DashboardsClientProps = {
  dashboards: Dashboard[];
  companies: Company[];
  organizations: Organization[];
  addDashboardAction: FormAction;
  manageDashboardAction: FormAction;
};

function DashboardRow({
  dashboard,
  companies,
  organizations,
  action,
}: {
  dashboard: Dashboard;
  companies: Company[];
  organizations: Organization[];
  action: FormAction;
}) {
  const [state, formAction] = useFormState(action, INITIAL_STATE);
  useRefreshOnSuccess(state);

  return (
    <div className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 md:grid-cols-[1.2fr_1.4fr_1fr_1fr_0.8fr_auto]">
      <form action={formAction} className="contents">
        <input type="hidden" name="dashboardId" value={dashboard.id} />
        <div className="flex flex-col gap-2">
          <label className="text-xs text-slate-400">Dashboard name</label>
          <input
            name="dashboardName"
            defaultValue={dashboard.name ?? ''}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs text-slate-400">Sheet link</label>
          <input
            name="sheetUrl"
            defaultValue={dashboard.sheetUrl ?? ''}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs text-slate-400">Company</label>
          <select
            name="companyId"
            defaultValue={dashboard.companyId ?? ''}
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
          <label className="text-xs text-slate-400">Organization</label>
          <select
            name="organizationId"
            defaultValue={dashboard.organizationId ?? ''}
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
            defaultValue={dashboard.template ?? 'Summary'}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          >
            {DASHBOARD_TEMPLATES.map((template) => (
              <option key={template} value={template}>
                {template}
              </option>
            ))}
          </select>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
          <button
            type="submit"
            name="intent"
            value="save"
            className="w-full rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-white hover:border-slate-500 sm:w-auto"
          >
            Save
          </button>
          <button
            type="submit"
            name="intent"
            value="delete"
            onClick={confirmDelete}
            className="w-full rounded-lg border border-rose-500/50 px-3 py-2 text-sm font-semibold text-rose-200 hover:border-rose-400 sm:w-auto"
          >
            Delete
          </button>
        </div>
        <StatusMessage state={state} />
      </form>
    </div>
  );
}

export default function DashboardsClient({
  dashboards,
  companies,
  organizations,
  addDashboardAction,
  manageDashboardAction,
}: DashboardsClientProps) {
  const [dashboardCreateState, dashboardCreateAction] = useFormState(
    addDashboardAction,
    INITIAL_STATE,
  );
  useRefreshOnSuccess(dashboardCreateState);

  return (
    <section className="grid gap-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg sm:p-6">
      <header className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Dashboards</h2>
        <p className="text-sm text-slate-300">
          Create dashboards for a company, optionally filter by organization, and set the
          template + sheet link.
        </p>
      </header>

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
        <StatusMessage state={dashboardCreateState} />
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
  );
}

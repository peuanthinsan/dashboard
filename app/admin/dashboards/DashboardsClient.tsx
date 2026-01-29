'use client';

import { useFormState } from 'react-dom';
import { INITIAL_STATE, StatusMessage, useRefreshOnSuccess } from '../admin-client-utils';
import ConfirmDeleteDialog from '../ConfirmDeleteDialog';
import { AdminPanel, AdminSection, AdminSectionHeader, AdminStatCard } from '../admin-components';
import {
  ADMIN_DELETE_BUTTON,
  ADMIN_FORM_PANEL,
  ADMIN_INPUT,
  ADMIN_LABEL,
  ADMIN_PRIMARY_BUTTON,
  ADMIN_SAVE_BUTTON,
  ADMIN_SELECT,
  ADMIN_TEXTAREA,
  ADMIN_TEXT_MUTED,
  ADMIN_TEXT_SUBTLE,
} from '../admin-ui';
import type { ActionState, Company, Dashboard, Organization } from '../types';

const DASHBOARD_TEMPLATES = ['Summary', 'Detail', 'Simple', 'Video'] as const;

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
  const formId = `dashboard-${dashboard.id}`;

  return (
    <>
      <tr className="align-top">
        <td className="px-4 py-3">
          <form id={formId} action={formAction} />
          <input type="hidden" name="dashboardId" value={dashboard.id} form={formId} />
          <input
            name="dashboardName"
            aria-label="Dashboard name"
            defaultValue={dashboard.name ?? ''}
            form={formId}
            className={ADMIN_INPUT}
          />
        </td>
        <td className="px-4 py-3">
          <input
            name="sheetUrl"
            aria-label="Sheet link"
            defaultValue={dashboard.sheetUrl ?? ''}
            form={formId}
            className={ADMIN_INPUT}
          />
        </td>
        <td className="px-4 py-3">
          <select
            name="companyId"
            aria-label="Company"
            defaultValue={dashboard.companyId ?? ''}
            form={formId}
            className={ADMIN_SELECT}
          >
            <option value="">Select company</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </td>
        <td className="px-4 py-3">
          <select
            name="organizationId"
            aria-label="Organization"
            defaultValue={dashboard.organizationId ?? ''}
            form={formId}
            className={ADMIN_SELECT}
          >
            <option value="">No organization</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        </td>
        <td className="px-4 py-3">
          <select
            name="template"
            aria-label="Template"
            defaultValue={dashboard.template ?? 'Summary'}
            form={formId}
            className={ADMIN_SELECT}
          >
            {DASHBOARD_TEMPLATES.map((template) => (
              <option key={template} value={template}>
                {template}
              </option>
            ))}
          </select>
        </td>
        <td className="px-4 py-3">
          <textarea
            name="dashboardNotes"
            aria-label="Notes"
            defaultValue={dashboard.notes ?? ''}
            rows={2}
            form={formId}
            className={`${ADMIN_TEXTAREA} min-h-[2.5rem] w-full`}
          />
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              name="intent"
              value="save"
              form={formId}
              className={ADMIN_SAVE_BUTTON}
            >
              Save
            </button>
            <ConfirmDeleteDialog
              title="Delete dashboard"
              description="This will permanently delete the dashboard entry."
              triggerClassName={ADMIN_DELETE_BUTTON}
              confirmClassName={ADMIN_DELETE_BUTTON}
              formId={formId}
            />
          </div>
        </td>
      </tr>
      {state.status !== 'idle' ? (
        <tr>
          <td colSpan={7} className="px-4 pb-4">
            <StatusMessage state={state} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

export default function DashboardsClient({
  dashboards,
  companies,
  organizations,
  addDashboardAction,
  manageDashboardAction,
}: DashboardsClientProps) {
  const totalDashboards = dashboards.length;

  const [dashboardCreateState, dashboardCreateAction] = useFormState(
    addDashboardAction,
    INITIAL_STATE,
  );
  useRefreshOnSuccess(dashboardCreateState);

  return (
    <AdminSection>
      <AdminSectionHeader
        eyebrow="Dashboard builder"
        title="Dashboards"
        description="Create dashboards for a company, optionally filter by organization, and set the template + sheet link."
        count={totalDashboards}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="Total dashboards"
          value={totalDashboards}
          description="Available dashboards across companies."
        />
        <AdminStatCard
          label="Companies"
          value={companies.length}
          description="Dashboard assignments by company."
        />
        <AdminStatCard label="Setup guide" variant="gradient" className="sm:col-span-2">
          <ul className={`space-y-2 text-xs ${ADMIN_TEXT_MUTED}`}>
            <li>Paste a full Google Sheet link for validation.</li>
            <li>Use organization filters to control scope.</li>
          </ul>
        </AdminStatCard>
      </div>

      <div className="grid gap-6">
        <form
          action={dashboardCreateAction}
          className={`${ADMIN_FORM_PANEL} grid gap-4`}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Create dashboard</h3>
            <span className={ADMIN_LABEL}>Required fields *</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className={ADMIN_LABEL}>Dashboard name *</label>
              <input
                name="dashboardName"
                placeholder="Operations overview"
                className={ADMIN_INPUT}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className={ADMIN_LABEL}>Google Sheet link *</label>
              <input
                name="sheetUrl"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className={ADMIN_INPUT}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className={ADMIN_LABEL}>Company *</label>
              <select
                name="companyId"
                className={ADMIN_SELECT}
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
              <label className={ADMIN_LABEL}>Organization (optional)</label>
              <select
                name="organizationId"
                className={ADMIN_SELECT}
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
              <label className={ADMIN_LABEL}>Template *</label>
              <select
                name="template"
                className={ADMIN_SELECT}
              >
                {DASHBOARD_TEMPLATES.map((template) => (
                  <option key={template} value={template}>
                    {template}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <label className={ADMIN_LABEL}>Dashboard notes (optional)</label>
              <textarea
                name="dashboardNotes"
                rows={3}
                placeholder="Add any notes that should appear on the dashboard."
                className={`${ADMIN_TEXTAREA} resize-none`}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={`text-xs ${ADMIN_TEXT_SUBTLE}`}>
              Links are validated and parsed automatically.
            </p>
            <button type="submit" className={ADMIN_PRIMARY_BUTTON}>
              Create dashboard
            </button>
          </div>
          <StatusMessage state={dashboardCreateState} />
        </form>

        <AdminPanel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Manage dashboards</h3>
              <p className={`mt-1 text-sm ${ADMIN_TEXT_SUBTLE}`}>
                Update dashboard details, organization filters, and sheet links.
              </p>
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200/70 dark:border-slate-800/70">
            <div className="max-h-[520px] overflow-auto">
              <table className="min-w-[1200px] w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left">
                      Dashboard
                    </th>
                    <th scope="col" className="px-4 py-3 text-left">
                      Sheet link
                    </th>
                    <th scope="col" className="px-4 py-3 text-left">
                      Company
                    </th>
                    <th scope="col" className="px-4 py-3 text-left">
                      Organization
                    </th>
                    <th scope="col" className="px-4 py-3 text-left">
                      Template
                    </th>
                    <th scope="col" className="px-4 py-3 text-left">
                      Notes
                    </th>
                    <th scope="col" className="px-4 py-3 text-left">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 bg-white dark:divide-slate-800/70 dark:bg-slate-950/40">
                  {dashboards.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={`px-4 py-6 text-sm ${ADMIN_TEXT_SUBTLE}`}>
                        No dashboards yet. Create one to make it available to users.
                      </td>
                    </tr>
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
                </tbody>
              </table>
            </div>
          </div>
        </AdminPanel>
      </div>
    </AdminSection>
  );
}

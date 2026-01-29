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
    <tr className="border-b border-slate-200/70 align-top text-sm last:border-b-0 dark:border-slate-800/70">
      <td className="p-3">
        <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
          Dashboard name
          <input
            name="dashboardName"
            defaultValue={dashboard.name ?? ''}
            className={ADMIN_INPUT}
            form={formId}
          />
        </label>
      </td>
      <td className="p-3">
        <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
          Sheet link
          <input
            name="sheetUrl"
            defaultValue={dashboard.sheetUrl ?? ''}
            className={ADMIN_INPUT}
            form={formId}
          />
        </label>
      </td>
      <td className="p-3">
        <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
          Company
          <select
            name="companyId"
            defaultValue={dashboard.companyId ?? ''}
            className={ADMIN_SELECT}
            form={formId}
          >
            <option value="">Select company</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>
      </td>
      <td className="p-3">
        <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
          Organization
          <select
            name="organizationId"
            defaultValue={dashboard.organizationId ?? ''}
            className={ADMIN_SELECT}
            form={formId}
          >
            <option value="">No organization</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        </label>
      </td>
      <td className="p-3">
        <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
          Notes
          <textarea
            name="dashboardNotes"
            defaultValue={dashboard.notes ?? ''}
            rows={2}
            className={`${ADMIN_TEXTAREA} min-h-[2.5rem]`}
            form={formId}
          />
        </label>
      </td>
      <td className="p-3">
        <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
          Template
          <select
            name="template"
            defaultValue={dashboard.template ?? 'Summary'}
            className={ADMIN_SELECT}
            form={formId}
          >
            {DASHBOARD_TEMPLATES.map((template) => (
              <option key={template} value={template}>
                {template}
              </option>
            ))}
          </select>
        </label>
      </td>
      <td className="p-3">
        <form id={formId} action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="dashboardId" value={dashboard.id} />
          <button type="submit" name="intent" value="save" className={ADMIN_SAVE_BUTTON}>
            Save
          </button>
          <ConfirmDeleteDialog
            title="Delete dashboard"
            description="This will permanently delete the dashboard entry."
            triggerClassName={ADMIN_DELETE_BUTTON}
            confirmClassName={ADMIN_DELETE_BUTTON}
            formId={formId}
          />
          <StatusMessage state={state} />
        </form>
      </td>
    </tr>
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
                Inline edit dashboard details, organization filters, and sheet links.
              </p>
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/70 dark:border-slate-800/70">
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50/95 text-xs uppercase tracking-wide text-slate-500 backdrop-blur dark:bg-slate-950/95 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-3">Dashboard</th>
                    <th className="px-3 py-3">Sheet link</th>
                    <th className="px-3 py-3">Company</th>
                    <th className="px-3 py-3">Organization</th>
                    <th className="px-3 py-3">Notes</th>
                    <th className="px-3 py-3">Template</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-950">
                  {dashboards.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={`px-3 py-6 text-sm ${ADMIN_TEXT_SUBTLE}`}>
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

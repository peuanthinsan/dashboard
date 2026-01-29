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
      <tr className="border-b border-slate-200/70 text-sm last:border-b-0 dark:border-slate-800/70">
        <td className="p-3 align-top">
          <form id={formId} action={formAction} className="hidden">
            <input type="hidden" name="dashboardId" value={dashboard.id} />
          </form>
          <div className="flex flex-col gap-2">
            <label className={ADMIN_LABEL}>Dashboard name</label>
            <input
              name="dashboardName"
              form={formId}
              defaultValue={dashboard.name ?? ''}
              className={ADMIN_INPUT}
            />
          </div>
        </td>
        <td className="p-3 align-top">
          <div className="flex flex-col gap-2">
            <label className={ADMIN_LABEL}>Sheet link</label>
            <input
              name="sheetUrl"
              form={formId}
              defaultValue={dashboard.sheetUrl ?? ''}
              className={ADMIN_INPUT}
            />
          </div>
        </td>
        <td className="p-3 align-top">
          <div className="flex flex-col gap-2">
            <label className={ADMIN_LABEL}>Company</label>
            <select
              name="companyId"
              form={formId}
              defaultValue={dashboard.companyId ?? ''}
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
        </td>
        <td className="p-3 align-top">
          <div className="flex flex-col gap-2">
            <label className={ADMIN_LABEL}>Organization</label>
            <select
              name="organizationId"
              form={formId}
              defaultValue={dashboard.organizationId ?? ''}
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
        </td>
        <td className="p-3 align-top">
          <div className="flex flex-col gap-2">
            <label className={ADMIN_LABEL}>Notes</label>
            <textarea
              name="dashboardNotes"
              form={formId}
              defaultValue={dashboard.notes ?? ''}
              rows={2}
              className={`${ADMIN_TEXTAREA} min-w-[160px]`}
            />
          </div>
        </td>
        <td className="p-3 align-top">
          <div className="flex flex-col gap-2">
            <label className={ADMIN_LABEL}>Template</label>
            <select
              name="template"
              form={formId}
              defaultValue={dashboard.template ?? 'Summary'}
              className={ADMIN_SELECT}
            >
              {DASHBOARD_TEMPLATES.map((template) => (
                <option key={template} value={template}>
                  {template}
                </option>
              ))}
            </select>
          </div>
        </td>
        <td className="p-3 align-top">
          <div className="flex flex-col items-start gap-2">
            <button
              type="submit"
              form={formId}
              name="intent"
              value="save"
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
      <tr className="border-b border-slate-200/70 last:border-b-0 dark:border-slate-800/70">
        <td colSpan={7} className="px-3 pb-3">
          <StatusMessage state={state} />
        </td>
      </tr>
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
          {dashboards.length === 0 ? (
            <p className={`mt-4 text-sm ${ADMIN_TEXT_SUBTLE}`}>
              No dashboards yet. Create one to make it available to users.
            </p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/95 dark:border-slate-800/70 dark:bg-slate-950/60">
              <div className="max-h-[560px] overflow-auto">
                <table className="min-w-[1120px] w-full text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50/95 text-xs uppercase text-slate-500 backdrop-blur dark:bg-slate-950/90 dark:text-slate-400">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Dashboard
                      </th>
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Sheet link
                      </th>
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Company
                      </th>
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Organization
                      </th>
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Notes
                      </th>
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Template
                      </th>
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboards.map((dashboard) => (
                      <DashboardRow
                        key={dashboard.id}
                        dashboard={dashboard}
                        companies={companies}
                        organizations={organizations}
                        action={manageDashboardAction}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </AdminPanel>
      </div>
    </AdminSection>
  );
}

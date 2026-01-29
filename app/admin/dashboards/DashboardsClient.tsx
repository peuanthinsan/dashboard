'use client';

import { useId } from 'react';
import { useFormState } from 'react-dom';
import AdminField from '../AdminField';
import { INITIAL_STATE, StatusMessage, useRefreshOnSuccess } from '../admin-client-utils';
import ConfirmDeleteDialog from '../ConfirmDeleteDialog';
import {
  ADMIN_DELETE_BUTTON,
  ADMIN_FIELD_INPUT,
  ADMIN_FIELD_TEXTAREA,
  ADMIN_FORM_CARD,
  ADMIN_GRADIENT_CARD,
  ADMIN_HELP_TEXT,
  ADMIN_MANAGE_CARD,
  ADMIN_PANEL,
  ADMIN_PRIMARY_BUTTON,
  ADMIN_SAVE_BUTTON,
  ADMIN_SECTION_BADGE,
  ADMIN_STAT_CARD,
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
  const rowId = useId();
  const nameId = `${rowId}-dashboard-name`;
  const sheetId = `${rowId}-sheet-url`;
  const companyId = `${rowId}-company`;
  const organizationId = `${rowId}-organization`;
  const notesId = `${rowId}-notes`;
  const templateId = `${rowId}-template`;

  return (
    <div className="grid gap-4 rounded-2xl border border-slate-200/70 bg-white/95 p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-800/70 dark:bg-slate-950/60 md:grid-cols-[1.1fr_1.4fr_1fr_1fr_0.6fr_0.8fr_auto]">
      <form action={formAction} className="contents">
        <input type="hidden" name="dashboardId" value={dashboard.id} />
        <AdminField id={nameId} label="Dashboard name" className="flex flex-col gap-2">
          <input
            name="dashboardName"
            defaultValue={dashboard.name ?? ''}
            className={ADMIN_FIELD_INPUT}
          />
        </AdminField>
        <AdminField id={sheetId} label="Sheet link" className="flex flex-col gap-2">
          <input
            name="sheetUrl"
            defaultValue={dashboard.sheetUrl ?? ''}
            className={ADMIN_FIELD_INPUT}
          />
        </AdminField>
        <AdminField id={companyId} label="Company" className="flex flex-col gap-2">
          <select
            name="companyId"
            defaultValue={dashboard.companyId ?? ''}
            className={ADMIN_FIELD_INPUT}
          >
            <option value="">Select company</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </AdminField>
        <AdminField id={organizationId} label="Organization" className="flex flex-col gap-2">
          <select
            name="organizationId"
            defaultValue={dashboard.organizationId ?? ''}
            className={ADMIN_FIELD_INPUT}
          >
            <option value="">No organization</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        </AdminField>
        <AdminField id={notesId} label="Notes" className="flex flex-col gap-2">
          <textarea
            name="dashboardNotes"
            defaultValue={dashboard.notes ?? ''}
            rows={1}
            className={`${ADMIN_FIELD_TEXTAREA} w-[148px]`}
          />
        </AdminField>
        <AdminField id={templateId} label="Template" className="flex flex-col gap-2">
          <select
            name="template"
            defaultValue={dashboard.template ?? 'Summary'}
            className={ADMIN_FIELD_INPUT}
          >
            {DASHBOARD_TEMPLATES.map((template) => (
              <option key={template} value={template}>
                {template}
              </option>
            ))}
          </select>
        </AdminField>
        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
          <button type="submit" name="intent" value="save" className={ADMIN_SAVE_BUTTON}>
            Save
          </button>
          <ConfirmDeleteDialog
            title="Delete dashboard"
            description="This will permanently delete the dashboard entry."
            triggerClassName={ADMIN_DELETE_BUTTON}
            confirmClassName={ADMIN_DELETE_BUTTON}
          />
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
  const totalDashboards = dashboards.length;

  const [dashboardCreateState, dashboardCreateAction] = useFormState(
    addDashboardAction,
    INITIAL_STATE,
  );
  useRefreshOnSuccess(dashboardCreateState);
  const formId = useId();
  const createNameId = `${formId}-create-name`;
  const createSheetId = `${formId}-create-sheet`;
  const createCompanyId = `${formId}-create-company`;
  const createOrganizationId = `${formId}-create-organization`;
  const createTemplateId = `${formId}-create-template`;
  const createNotesId = `${formId}-create-notes`;

  return (
    <section className={ADMIN_PANEL}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            Dashboard builder
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">Dashboards</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Create dashboards for a company, optionally filter by organization, and set the
            template + sheet link.
          </p>
        </div>
        <span className={ADMIN_SECTION_BADGE}>{totalDashboards} total</span>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className={ADMIN_STAT_CARD}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Total dashboards
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{totalDashboards}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Available dashboards across companies.
          </p>
        </div>
        <div className={ADMIN_STAT_CARD}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Companies
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{companies.length}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Dashboard assignments by company.
          </p>
        </div>
        <div className={`${ADMIN_GRADIENT_CARD} sm:col-span-2`}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Setup guide
          </p>
          <ul className="mt-2 space-y-2 text-xs text-slate-600 dark:text-slate-300">
            <li>Paste a full Google Sheet link for validation.</li>
            <li>Use organization filters to control scope.</li>
          </ul>
        </div>
      </div>

      <div className="grid gap-6">
        <form
          action={dashboardCreateAction}
          className={`grid gap-4 ${ADMIN_FORM_CARD}`}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Create dashboard</h3>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Required fields *</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField
              id={createNameId}
              label="Dashboard name"
              required
              className="flex flex-col gap-2"
              helperText="Make it obvious to the team what this covers."
            >
              <input
                name="dashboardName"
                placeholder="Operations overview"
                className={ADMIN_FIELD_INPUT}
              />
            </AdminField>
            <AdminField
              id={createSheetId}
              label="Google Sheet link"
              required
              className="flex flex-col gap-2"
              helperText="Use the shareable URL from Google Sheets."
            >
              <input
                name="sheetUrl"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className={ADMIN_FIELD_INPUT}
              />
            </AdminField>
            <AdminField id={createCompanyId} label="Company" required className="flex flex-col gap-2">
              <select
                name="companyId"
                className={ADMIN_FIELD_INPUT}
              >
                <option value="">Select company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </AdminField>
            <AdminField
              id={createOrganizationId}
              label="Organization (optional)"
              className="flex flex-col gap-2"
              helperText="Leave empty to make the dashboard available to all teams."
            >
              <select
                name="organizationId"
                className={ADMIN_FIELD_INPUT}
              >
                <option value="">No organization</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </AdminField>
            <AdminField id={createTemplateId} label="Template" required className="flex flex-col gap-2">
              <select
                name="template"
                className={ADMIN_FIELD_INPUT}
              >
                {DASHBOARD_TEMPLATES.map((template) => (
                  <option key={template} value={template}>
                    {template}
                  </option>
                ))}
              </select>
            </AdminField>
            <AdminField
              id={createNotesId}
              label="Dashboard notes (optional)"
              className="flex flex-col gap-2 sm:col-span-2"
            >
              <textarea
                name="dashboardNotes"
                rows={3}
                placeholder="Add any notes that should appear on the dashboard."
                className={`resize-none ${ADMIN_FIELD_TEXTAREA}`}
              />
            </AdminField>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={ADMIN_HELP_TEXT}>
              Links are validated and parsed automatically.
            </p>
            <button type="submit" className={ADMIN_PRIMARY_BUTTON}>
              Create dashboard
            </button>
          </div>
          <StatusMessage state={dashboardCreateState} />
        </form>

        <div className={ADMIN_MANAGE_CARD}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Manage dashboards</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Update dashboard details, organization filters, and sheet links.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-4">
            {dashboards.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
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
        </div>
      </div>
    </section>
  );
}

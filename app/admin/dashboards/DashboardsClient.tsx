'use client';

import { useFormState } from 'react-dom';
import { INITIAL_STATE, StatusMessage, useRefreshOnSuccess } from '../admin-client-utils';
import {
  AdminCard,
  AdminListCard,
  AdminSection,
  AdminSectionHeader,
  AdminStat,
  AdminStatGrid,
} from '../admin-components';
import ConfirmDeleteDialog from '../ConfirmDeleteDialog';
import {
  ADMIN_DELETE_BUTTON,
  ADMIN_INPUT,
  ADMIN_INPUT_WITH_PLACEHOLDER,
  ADMIN_LABEL,
  ADMIN_PRIMARY_BUTTON,
  ADMIN_ROW_CARD,
  ADMIN_SAVE_BUTTON,
  ADMIN_TEXTAREA,
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

  return (
    <div
      className={`${ADMIN_ROW_CARD} grid gap-4 rounded-2xl md:grid-cols-[1.1fr_1.4fr_1fr_1fr_0.6fr_0.8fr_auto]`}
    >
      <form action={formAction} className="contents">
        <input type="hidden" name="dashboardId" value={dashboard.id} />
        <div className="flex flex-col gap-2">
          <label className={ADMIN_LABEL}>Dashboard name</label>
          <input
            name="dashboardName"
            defaultValue={dashboard.name ?? ''}
            className={ADMIN_INPUT}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className={ADMIN_LABEL}>Sheet link</label>
          <input
            name="sheetUrl"
            defaultValue={dashboard.sheetUrl ?? ''}
            className={ADMIN_INPUT}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className={ADMIN_LABEL}>Company</label>
          <select
            name="companyId"
            defaultValue={dashboard.companyId ?? ''}
            className={ADMIN_INPUT}
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
          <label className={ADMIN_LABEL}>Organization</label>
          <select
            name="organizationId"
            defaultValue={dashboard.organizationId ?? ''}
            className={ADMIN_INPUT}
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
          <label className={ADMIN_LABEL}>Notes</label>
          <textarea
            name="dashboardNotes"
            defaultValue={dashboard.notes ?? ''}
            rows={1}
            className={`w-[148px] ${ADMIN_TEXTAREA}`}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className={ADMIN_LABEL}>Template</label>
          <select
            name="template"
            defaultValue={dashboard.template ?? 'Summary'}
            className={ADMIN_INPUT}
          >
            {DASHBOARD_TEMPLATES.map((template) => (
              <option key={template} value={template}>
                {template}
              </option>
            ))}
          </select>
        </div>
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

  return (
    <AdminSection>
      <AdminSectionHeader
        kicker="Dashboard builder"
        title="Dashboards"
        description="Create dashboards for a company, optionally filter by organization, and set the template + sheet link."
        badgeText={`${totalDashboards} total`}
      />

      <AdminStatGrid>
        <AdminStat
          label="Total dashboards"
          value={totalDashboards}
          description="Available dashboards across companies."
        />
        <AdminStat
          label="Companies"
          value={companies.length}
          description="Dashboard assignments by company."
        />
        <AdminListCard
          title="Setup guide"
          items={['Paste a full Google Sheet link for validation.', 'Use organization filters to control scope.']}
          variant="gradient"
          className="sm:col-span-2"
        />
      </AdminStatGrid>

      <div className="grid gap-6">
        <form
          action={dashboardCreateAction}
          className="grid gap-4 rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm dark:border-slate-800/70 dark:from-slate-950/70 dark:to-slate-950/30"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Create dashboard</h3>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Required fields *</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className={ADMIN_LABEL}>Dashboard name *</label>
              <input
                name="dashboardName"
                placeholder="Operations overview"
                className={ADMIN_INPUT_WITH_PLACEHOLDER}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className={ADMIN_LABEL}>Google Sheet link *</label>
              <input
                name="sheetUrl"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className={ADMIN_INPUT_WITH_PLACEHOLDER}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className={ADMIN_LABEL}>Company *</label>
              <select
                name="companyId"
                className={ADMIN_INPUT}
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
                className={ADMIN_INPUT}
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
                className={ADMIN_INPUT}
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
                className={`resize-none ${ADMIN_INPUT_WITH_PLACEHOLDER}`}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={ADMIN_LABEL}>Links are validated and parsed automatically.</p>
            <button type="submit" className={ADMIN_PRIMARY_BUTTON}>
              Create dashboard
            </button>
          </div>
          <StatusMessage state={dashboardCreateState} />
        </form>

        <AdminCard className="p-5">
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
        </AdminCard>
      </div>
    </AdminSection>
  );
}

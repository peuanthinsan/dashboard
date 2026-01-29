'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFormState } from 'react-dom';
import { INITIAL_STATE, StatusMessage, useRefreshOnSuccess } from '../admin-client-utils';
import AdminModal from '../AdminModal';
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

const SUMMARY_LIMIT = 2;

function summarizeList(items: string[], emptyLabel = 'None') {
  if (items.length === 0) {
    return emptyLabel;
  }

  const visible = items.slice(0, SUMMARY_LIMIT);
  const remaining = items.length - visible.length;
  return remaining > 0 ? `${visible.join(', ')} +${remaining}` : visible.join(', ');
}

function DashboardRow({
  dashboard,
  companies,
  organizations,
  companyNameById,
  organizationNameById,
  action,
}: {
  dashboard: Dashboard;
  companies: Company[];
  organizations: Organization[];
  companyNameById: Map<number, string>;
  organizationNameById: Map<number, string>;
  action: FormAction;
}) {
  const [state, formAction] = useFormState(action, INITIAL_STATE);
  const [isOpen, setIsOpen] = useState(false);
  useRefreshOnSuccess(state);
  useEffect(() => {
    if (state.status === 'success') {
      setIsOpen(false);
    }
  }, [state.status]);

  const companySummary = summarizeList(
    dashboard.companyId && companyNameById.has(dashboard.companyId)
      ? [companyNameById.get(dashboard.companyId) ?? '']
      : [],
    'Unassigned',
  );
  const organizationSummary = summarizeList(
    dashboard.organizationId && organizationNameById.has(dashboard.organizationId)
      ? [organizationNameById.get(dashboard.organizationId) ?? '']
      : [],
    'None',
  );

  return (
    <>
      <tr className="border-b border-slate-200/70 text-sm text-slate-600 dark:border-slate-800/70 dark:text-slate-200">
        <td className="py-3 pr-4">
          <div className="font-semibold text-slate-900 dark:text-white">
            {dashboard.name ?? 'Untitled dashboard'}
          </div>
          <div className="text-xs text-slate-400">ID: {dashboard.id}</div>
        </td>
        <td className="py-3 pr-4">
          <span className="text-slate-600 dark:text-slate-300" title={companySummary}>
            {companySummary}
          </span>
        </td>
        <td className="py-3 pr-4">
          <span className="text-slate-600 dark:text-slate-300" title={organizationSummary}>
            {organizationSummary}
          </span>
        </td>
        <td className="py-3 pr-4">{dashboard.template ?? 'Summary'}</td>
        <td className="py-3 pr-4">
          <span className="block max-w-[220px] truncate" title={dashboard.sheetUrl ?? ''}>
            {dashboard.sheetUrl ?? 'No sheet link'}
          </span>
        </td>
        <td className="py-3 pr-4">
          <span className="block max-w-[220px] truncate" title={dashboard.notes ?? ''}>
            {dashboard.notes ?? '—'}
          </span>
        </td>
        <td className="py-3 text-right">
          <button type="button" className={ADMIN_SAVE_BUTTON} onClick={() => setIsOpen(true)}>
            Edit
          </button>
        </td>
      </tr>
      <AdminModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Edit dashboard"
        description="Update the template, sheet link, and assignment details."
        size="lg"
      >
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="dashboardId" value={dashboard.id} />
          <div className="grid gap-4 md:grid-cols-2">
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
              <label className={ADMIN_LABEL}>Organization</label>
              <select
                name="organizationId"
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
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className={ADMIN_LABEL}>Notes</label>
              <textarea
                name="dashboardNotes"
                defaultValue={dashboard.notes ?? ''}
                rows={3}
                className={ADMIN_TEXTAREA}
              />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className={ADMIN_LABEL}>Template</label>
              <select
                name="template"
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
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" name="intent" value="save" className={ADMIN_SAVE_BUTTON}>
                Save changes
              </button>
              <ConfirmDeleteDialog
                title="Delete dashboard"
                description="This will permanently delete the dashboard entry."
                triggerClassName={ADMIN_DELETE_BUTTON}
                confirmClassName={ADMIN_DELETE_BUTTON}
              />
            </div>
            <button type="button" className={ADMIN_SAVE_BUTTON} onClick={() => setIsOpen(false)}>
              Cancel
            </button>
          </div>
          <StatusMessage state={state} />
        </form>
      </AdminModal>
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
  const companyNameById = useMemo(
    () => new Map(companies.map((company) => [company.id, company.name])),
    [companies],
  );
  const organizationNameById = useMemo(
    () => new Map(organizations.map((organization) => [organization.id, organization.name])),
    [organizations],
  );

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
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Dashboard</th>
                  <th className="py-2 pr-4 font-semibold">Company</th>
                  <th className="py-2 pr-4 font-semibold">Organization</th>
                  <th className="py-2 pr-4 font-semibold">Template</th>
                  <th className="py-2 pr-4 font-semibold">Sheet link</th>
                  <th className="py-2 pr-4 font-semibold">Notes</th>
                  <th className="py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dashboards.length === 0 ? (
                  <tr>
                    <td className="py-4 text-sm text-slate-500" colSpan={7}>
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
                      companyNameById={companyNameById}
                      organizationNameById={organizationNameById}
                      action={manageDashboardAction}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </AdminPanel>
      </div>
    </AdminSection>
  );
}

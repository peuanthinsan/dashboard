'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFormState } from 'react-dom';
import { INITIAL_STATE, StatusMessage, useRefreshOnSuccess } from '../admin-client-utils';
import ConfirmDeleteDialog from '../ConfirmDeleteDialog';
import { AdminPanel, AdminSection, AdminSectionHeader, AdminStatCard } from '../admin-components';
import {
  ADMIN_DELETE_BUTTON,
  ADMIN_FORM_PANEL,
  ADMIN_INPUT,
  ADMIN_LABEL,
  ADMIN_PILL,
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

function formatEntityList(names: string[]) {
  if (names.length === 0) {
    return 'None';
  }

  const preview = names.slice(0, 2).join(', ');
  const remaining = names.length - 2;
  if (remaining > 0) {
    return `${preview} +${remaining}`;
  }

  return preview;
}

export default function DashboardsClient({
  dashboards,
  companies,
  organizations,
  addDashboardAction,
  manageDashboardAction,
}: DashboardsClientProps) {
  const totalDashboards = dashboards.length;
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(null);

  const companyLookup = useMemo(
    () => new Map(companies.map((company) => [String(company.id), company.name])),
    [companies],
  );
  const organizationLookup = useMemo(
    () => new Map(organizations.map((org) => [String(org.id), org.name])),
    [organizations],
  );
  const selectedDashboard =
    dashboards.find((dashboard) => String(dashboard.id) === selectedDashboardId) ?? null;

  const [editState, editAction] = useFormState(manageDashboardAction, INITIAL_STATE);
  useRefreshOnSuccess(editState);
  useEffect(() => {
    if (editState.status === 'success') {
      setSelectedDashboardId(null);
    }
  }, [editState.status]);

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
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/95 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/60">
            <div className="overflow-x-auto">
              <table className="min-w-[840px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Dashboard</th>
                    <th className="px-4 py-3 font-semibold">Company</th>
                    <th className="px-4 py-3 font-semibold">Organization</th>
                    <th className="px-4 py-3 font-semibold">Template</th>
                    <th className="px-4 py-3 font-semibold">Notes</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboards.map((dashboard) => {
                    const companyName = dashboard.companyId
                      ? companyLookup.get(String(dashboard.companyId))
                      : 'Unassigned';
                    const organizationName = dashboard.organizationId
                      ? organizationLookup.get(String(dashboard.organizationId))
                      : 'None';
                    const notesPreview = formatEntityList(
                      (dashboard.notes ?? '')
                        .split(',')
                        .map((note) => note.trim())
                        .filter(Boolean),
                    );

                    return (
                      <tr
                        key={dashboard.id}
                        className="border-t border-slate-200/70 text-slate-700 hover:bg-slate-50/80 dark:border-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-900/40"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900 dark:text-white">
                            {dashboard.name ?? 'Untitled'}
                          </div>
                          <div className={`text-xs ${ADMIN_TEXT_SUBTLE}`}>ID: {dashboard.id}</div>
                        </td>
                        <td className="px-4 py-3">
                          {companyName ?? 'Unknown'}
                        </td>
                        <td className="px-4 py-3">
                          {organizationName ?? 'Unknown'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`${ADMIN_PILL} bg-indigo-500/10 text-indigo-400`}>
                            {dashboard.template ?? 'Summary'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs ${ADMIN_TEXT_SUBTLE}`}>
                            {notesPreview}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedDashboardId(String(dashboard.id))}
                            className={ADMIN_SAVE_BUTTON}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {dashboards.length === 0 ? (
              <p className={`px-4 py-6 text-sm ${ADMIN_TEXT_SUBTLE}`}>
                No dashboards yet. Create one to make it available to users.
              </p>
            ) : null}
          </div>
        </AdminPanel>
      </div>
      {selectedDashboard ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4 py-6">
          <button
            type="button"
            aria-hidden="true"
            className="absolute inset-0 bg-slate-900/20 dark:bg-slate-950/80"
            onClick={() => setSelectedDashboardId(null)}
          />
          <div className="relative w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Edit dashboard</h3>
                <p className={`text-sm ${ADMIN_TEXT_SUBTLE}`}>
                  Update dashboard metadata, sheet link, and assignments.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDashboardId(null)}
                className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-600 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-300"
              >
                Close
              </button>
            </div>
            <form
              key={selectedDashboard.id}
              action={editAction}
              className="mt-4 grid gap-4"
            >
              <input type="hidden" name="dashboardId" value={selectedDashboard.id} />
              <div className="grid gap-4 md:grid-cols-2">
                <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                  Dashboard name
                  <input
                    name="dashboardName"
                    defaultValue={selectedDashboard.name ?? ''}
                    className={ADMIN_INPUT}
                  />
                </label>
                <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                  Sheet link
                  <input
                    name="sheetUrl"
                    defaultValue={selectedDashboard.sheetUrl ?? ''}
                    className={ADMIN_INPUT}
                  />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                  Company
                  <select
                    name="companyId"
                    defaultValue={selectedDashboard.companyId ?? ''}
                    className={ADMIN_SELECT}
                  >
                    <option value="">Select company</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                  Organization
                  <select
                    name="organizationId"
                    defaultValue={selectedDashboard.organizationId ?? ''}
                    className={ADMIN_SELECT}
                  >
                    <option value="">No organization</option>
                    {organizations.map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                  Template
                  <select
                    name="template"
                    defaultValue={selectedDashboard.template ?? 'Summary'}
                    className={ADMIN_SELECT}
                  >
                    {DASHBOARD_TEMPLATES.map((template) => (
                      <option key={template} value={template}>
                        {template}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                Notes
                <textarea
                  name="dashboardNotes"
                  defaultValue={selectedDashboard.notes ?? ''}
                  rows={3}
                  className={`${ADMIN_TEXTAREA} resize-none`}
                />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <StatusMessage state={editState} />
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
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AdminSection>
  );
}

'use client';

import { useMemo, useState } from 'react';
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

type ModalProps = {
  isOpen: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
};

function Modal({ isOpen, title, description, onClose, children }: ModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button
        type="button"
        aria-hidden="true"
        className="absolute inset-0 bg-slate-900/20 dark:bg-slate-950/80"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-modal-title"
        className="relative w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-950"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="dashboard-modal-title"
              className="text-lg font-semibold text-slate-900 dark:text-white"
            >
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500"
          >
            Close
          </button>
        </div>
        <div className="mt-6">{children}</div>
      </div>
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
  const [search, setSearch] = useState('');
  const [selectedDashboard, setSelectedDashboard] = useState<Dashboard | null>(null);

  const [dashboardCreateState, dashboardCreateAction] = useFormState(
    addDashboardAction,
    INITIAL_STATE,
  );
  useRefreshOnSuccess(dashboardCreateState);
  const [dashboardManageState, dashboardManageAction] = useFormState(
    manageDashboardAction,
    INITIAL_STATE,
  );
  useRefreshOnSuccess(dashboardManageState);

  const companyNameMap = useMemo(
    () => new Map(companies.map((company) => [company.id, company.name])),
    [companies],
  );
  const organizationNameMap = useMemo(
    () => new Map(organizations.map((organization) => [organization.id, organization.name])),
    [organizations],
  );

  const filteredDashboards = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) {
      return dashboards;
    }
    return dashboards.filter((dashboard) => {
      const nameMatch = (dashboard.name ?? '').toLowerCase().includes(normalized);
      const sheetMatch = (dashboard.sheetUrl ?? '').toLowerCase().includes(normalized);
      const companyMatch = dashboard.companyId
        ? companyNameMap.get(dashboard.companyId)?.toLowerCase().includes(normalized)
        : false;
      const orgMatch = dashboard.organizationId
        ? organizationNameMap.get(dashboard.organizationId)?.toLowerCase().includes(normalized)
        : false;
      return nameMatch || sheetMatch || companyMatch || orgMatch;
    });
  }, [dashboards, search, companyNameMap, organizationNameMap]);

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
            <li>Edit dashboards in modal views for dense lists.</li>
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
                Update dashboard details, organization filters, and sheet links without scrolling.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xs ${ADMIN_TEXT_SUBTLE}`}>{filteredDashboards.length} results</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, company, org"
                className={`${ADMIN_INPUT} h-9 w-full min-w-[220px] sm:w-64`}
              />
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/70 dark:border-slate-800/70">
            <div className="max-h-[540px] overflow-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-widest text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Dashboard</th>
                    <th className="px-4 py-3 font-semibold">Company</th>
                    <th className="px-4 py-3 font-semibold">Organization</th>
                    <th className="px-4 py-3 font-semibold">Template</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                  {filteredDashboards.map((dashboard) => (
                    <tr key={dashboard.id} className="bg-white/80 hover:bg-slate-50 dark:bg-slate-950/40 dark:hover:bg-slate-900/60">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900 dark:text-white">
                          {dashboard.name ?? 'Untitled dashboard'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {dashboard.sheetUrl ?? 'No sheet link'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {dashboard.companyId ? companyNameMap.get(dashboard.companyId) ?? '—' : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {dashboard.organizationId
                          ? organizationNameMap.get(dashboard.organizationId) ?? '—'
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {dashboard.template ?? 'Summary'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedDashboard(dashboard)}
                          className={ADMIN_SAVE_BUTTON}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredDashboards.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                        No dashboards found. Create one or update your search.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </AdminPanel>
      </div>

      <Modal
        isOpen={!!selectedDashboard}
        title={selectedDashboard ? `Edit dashboard: ${selectedDashboard.name ?? 'Untitled'}` : 'Edit dashboard'}
        description="Edit details, assignment, and notes for this dashboard."
        onClose={() => setSelectedDashboard(null)}
      >
        {selectedDashboard ? (
          <form action={dashboardManageAction} className="grid gap-4">
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
            <div className="grid gap-4 md:grid-cols-2">
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
            </div>
            <div className="grid gap-4 md:grid-cols-2">
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
              <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                Notes
                <textarea
                  name="dashboardNotes"
                  defaultValue={selectedDashboard.notes ?? ''}
                  rows={3}
                  className={`${ADMIN_TEXTAREA} resize-none`}
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <StatusMessage state={dashboardManageState} />
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
        ) : null}
      </Modal>
    </AdminSection>
  );
}

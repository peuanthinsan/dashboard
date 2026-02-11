'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFormState } from 'react-dom';
import AdminModal from '../AdminModal';
import { INITIAL_STATE, StatusMessage, useRefreshOnSuccess } from '../admin-client-utils';
import ConfirmDeleteDialog from '../ConfirmDeleteDialog';
import { AdminPanel, AdminSection, AdminSectionHeader, AdminStatCard } from '../admin-components';
import {
  ADMIN_DELETE_BUTTON,
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

function DashboardRow({
  dashboard,
  companies,
  organizations,
  action,
  companyName,
  organizationName,
}: {
  dashboard: Dashboard;
  companies: Company[];
  organizations: Organization[];
  action: FormAction;
  companyName: string;
  organizationName: string;
}) {
  const [state, formAction] = useFormState(action, INITIAL_STATE);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    dashboard.companyId ? String(dashboard.companyId) : '',
  );
  useRefreshOnSuccess(state);

  useEffect(() => {
    if (state.status === 'success') {
      setIsOpen(false);
    }
  }, [state.status]);

  useEffect(() => {
    setSelectedCompanyId(dashboard.companyId ? String(dashboard.companyId) : '');
  }, [dashboard.companyId, isOpen]);

  const organizationsForCompany = useMemo(() => {
    if (!selectedCompanyId) {
      return organizations;
    }
    return organizations.filter((organization) => String(organization.companyId ?? '') === selectedCompanyId);
  }, [organizations, selectedCompanyId]);

  return (
    <>
      <tr className="border-b border-slate-200/70 text-sm text-slate-700 last:border-b-0 dark:border-slate-800/70 dark:text-slate-200">
        <td className="px-4 py-3">
          <div className="font-semibold text-slate-900 dark:text-white">
            {dashboard.name ?? 'Untitled dashboard'}
          </div>
          <div className="mt-1 text-xs text-slate-500">ID {dashboard.id}</div>
        </td>
        <td className="px-4 py-3">{companyName}</td>
        <td className="px-4 py-3">{organizationName}</td>
        <td className="px-4 py-3">
          <span className={`${ADMIN_PILL} bg-slate-100 text-slate-600`}>
            {dashboard.template ?? 'Summary'}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className="block max-w-[14rem] truncate text-xs text-slate-500" title={dashboard.sheetUrl ?? ''}>
            {dashboard.sheetUrl ?? '—'}
          </span>
        </td>
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className={ADMIN_SAVE_BUTTON}
          >
            Edit
          </button>
        </td>
      </tr>

      <AdminModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Edit dashboard"
        description="Update dashboard details, templates, and assignments."
      >
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="dashboardId" value={dashboard.id} />
          <div className="grid gap-4 md:grid-cols-2">
            <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
              Dashboard name
              <input
                name="dashboardName"
                defaultValue={dashboard.name ?? ''}
                className={ADMIN_INPUT}
              />
            </label>
            <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
              Sheet link
              <input
                name="sheetUrl"
                defaultValue={dashboard.sheetUrl ?? ''}
                className={ADMIN_INPUT}
              />
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
              Company
              <select
                name="companyId"
                defaultValue={dashboard.companyId ?? ''}
                className={ADMIN_SELECT}
                onChange={(event) => setSelectedCompanyId(event.target.value)}
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
              Fleet
              <select
                name="organizationId"
                defaultValue={dashboard.organizationId ?? ''}
                className={ADMIN_SELECT}
              >
                <option value="">No fleet</option>
                {organizationsForCompany.map((organization) => (
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
                defaultValue={dashboard.template ?? 'Summary'}
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
                defaultValue={dashboard.notes ?? ''}
                rows={4}
                className={`${ADMIN_TEXTAREA} resize-none`}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <StatusMessage state={state} />
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
  const companyMap = useMemo(
    () => new Map(companies.map((company) => [company.id, company.name ?? 'Unassigned'])),
    [companies],
  );
  const organizationMap = useMemo(
    () => new Map(organizations.map((organization) => [organization.id, organization.name ?? 'No fleet'])),
    [organizations],
  );

  const [dashboardCreateState, dashboardCreateAction] = useFormState(
    addDashboardAction,
    INITIAL_STATE,
  );
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createCompanyId, setCreateCompanyId] = useState('');
  useRefreshOnSuccess(dashboardCreateState);

  useEffect(() => {
    if (dashboardCreateState.status === 'success') {
      setIsCreateOpen(false);
      setCreateCompanyId('');
    }
  }, [dashboardCreateState.status]);

  const organizationsForCreateCompany = useMemo(() => {
    if (!createCompanyId) {
      return organizations;
    }
    return organizations.filter((organization) => String(organization.companyId ?? '') === createCompanyId);
  }, [organizations, createCompanyId]);

  return (
    <AdminSection>
      <AdminSectionHeader
        eyebrow="Dashboard builder"
        title="Dashboards"
        description="Create dashboards for a company, optionally filter by fleet, and set the template + sheet link."
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
            <li>Use fleet filters to control scope.</li>
          </ul>
        </AdminStatCard>
      </div>

      <div className="grid gap-6">
        <AdminPanel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Manage dashboards</h3>
              <p className={`mt-1 text-sm ${ADMIN_TEXT_SUBTLE}`}>
                Scan and edit large dashboard lists quickly.
              </p>
            </div>
            <button type="button" onClick={() => setIsCreateOpen(true)} className={ADMIN_PRIMARY_BUTTON}>
              Create dashboard
            </button>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/60">
            <div className="max-h-[32rem] overflow-auto">
              <table className="min-w-full border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Dashboard</th>
                    <th className="px-4 py-3 font-semibold">Company</th>
                    <th className="px-4 py-3 font-semibold">Fleet</th>
                    <th className="px-4 py-3 font-semibold">Template</th>
                    <th className="px-4 py-3 font-semibold">Sheet link</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
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
                      companyName={
                        dashboard.companyId ? companyMap.get(dashboard.companyId) ?? 'Unassigned' : 'Unassigned'
                      }
                      organizationName={
                        dashboard.organizationId
                          ? organizationMap.get(dashboard.organizationId) ?? 'No fleet'
                          : 'No fleet'
                      }
                    />
                  ))}
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

      <AdminModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create dashboard"
        description="Add a new dashboard, connect it to a sheet, and assign a company."
      >
        <form
          action={dashboardCreateAction}
          className="grid gap-4"
        >
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
                onChange={(event) => setCreateCompanyId(event.target.value)}
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
              <label className={ADMIN_LABEL}>Fleet (optional)</label>
              <select
                name="organizationId"
                className={ADMIN_SELECT}
              >
                <option value="">No fleet</option>
                {organizationsForCreateCompany.map((organization) => (
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
      </AdminModal>
    </AdminSection>
  );
}

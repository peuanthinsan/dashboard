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

  return (
    <div className="grid gap-4 rounded-2xl border border-slate-200/70 bg-white/95 p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-800/70 dark:bg-slate-950/60 md:grid-cols-[1.1fr_1.4fr_1fr_1fr_0.6fr_0.8fr_auto]">
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
        <div className="flex flex-col gap-2">
          <label className={ADMIN_LABEL}>Notes</label>
          <textarea
            name="dashboardNotes"
            defaultValue={dashboard.notes ?? ''}
            rows={1}
            className={`${ADMIN_TEXTAREA} w-[148px]`}
          />
        </div>
        <div className="flex flex-col gap-2">
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
  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [organizationFilter, setOrganizationFilter] = useState('all');
  const [templateFilter, setTemplateFilter] = useState('all');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const [dashboardCreateState, dashboardCreateAction] = useFormState(
    addDashboardAction,
    INITIAL_STATE,
  );
  useRefreshOnSuccess(dashboardCreateState);

  const companyNameById = useMemo(
    () =>
      new Map(companies.map((company) => [String(company.id), company.name.toLowerCase()])),
    [companies],
  );
  const organizationNameById = useMemo(
    () =>
      new Map(
        organizations.map((organization) => [String(organization.id), organization.name.toLowerCase()]),
      ),
    [organizations],
  );

  const filteredDashboards = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return dashboards.filter((dashboard) => {
      if (companyFilter !== 'all' && String(dashboard.companyId ?? '') !== companyFilter) {
        return false;
      }
      if (
        organizationFilter !== 'all' &&
        String(dashboard.organizationId ?? '') !== organizationFilter
      ) {
        return false;
      }
      if (templateFilter !== 'all' && dashboard.template !== templateFilter) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      const nameMatch = (dashboard.name ?? '').toLowerCase().includes(normalizedSearch);
      const sheetMatch = (dashboard.sheetUrl ?? '').toLowerCase().includes(normalizedSearch);
      const notesMatch = (dashboard.notes ?? '').toLowerCase().includes(normalizedSearch);
      const companyMatch = companyNameById
        .get(String(dashboard.companyId ?? ''))
        ?.includes(normalizedSearch);
      const organizationMatch = organizationNameById
        .get(String(dashboard.organizationId ?? ''))
        ?.includes(normalizedSearch);
      return (
        nameMatch ||
        sheetMatch ||
        notesMatch ||
        companyMatch ||
        organizationMatch
      );
    });
  }, [
    companyFilter,
    companyNameById,
    dashboards,
    organizationFilter,
    organizationNameById,
    searchTerm,
    templateFilter,
  ]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, companyFilter, organizationFilter, templateFilter, pageSize]);

  const totalFilteredDashboards = filteredDashboards.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredDashboards / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = totalFilteredDashboards === 0 ? 0 : (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalFilteredDashboards);
  const pagedDashboards = filteredDashboards.slice(startIndex, endIndex);

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
          <div className="mt-4 grid gap-4">
            <div className="grid gap-3 xl:grid-cols-[1.6fr_1fr_1fr_1fr_0.7fr]">
              <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                Search
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search name, sheet, notes, or org"
                  className={ADMIN_INPUT}
                />
              </label>
              <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                Company
                <select
                  value={companyFilter}
                  onChange={(event) => setCompanyFilter(event.target.value)}
                  className={ADMIN_SELECT}
                >
                  <option value="all">All companies</option>
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
                  value={organizationFilter}
                  onChange={(event) => setOrganizationFilter(event.target.value)}
                  className={ADMIN_SELECT}
                >
                  <option value="all">All organizations</option>
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
                  value={templateFilter}
                  onChange={(event) => setTemplateFilter(event.target.value)}
                  className={ADMIN_SELECT}
                >
                  <option value="all">All templates</option>
                  {DASHBOARD_TEMPLATES.map((template) => (
                    <option key={template} value={template}>
                      {template}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                Per page
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  className={ADMIN_SELECT}
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className={`text-xs ${ADMIN_TEXT_SUBTLE}`}>
                {totalFilteredDashboards === 0
                  ? 'No dashboards match these filters.'
                  : `Showing ${startIndex + 1}-${endIndex} of ${totalFilteredDashboards} dashboards.`}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={`${ADMIN_SAVE_BUTTON} disabled:cursor-not-allowed disabled:opacity-60`}
                  disabled={currentPage === 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  Previous
                </button>
                <span className={`text-xs font-semibold ${ADMIN_TEXT_SUBTLE}`}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  className={`${ADMIN_SAVE_BUTTON} disabled:cursor-not-allowed disabled:opacity-60`}
                  disabled={currentPage === totalPages}
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  Next
                </button>
              </div>
            </div>
            {dashboards.length === 0 ? (
              <p className={`text-sm ${ADMIN_TEXT_SUBTLE}`}>
                No dashboards yet. Create one to make it available to users.
              </p>
            ) : pagedDashboards.length === 0 ? (
              <p className={`text-sm ${ADMIN_TEXT_SUBTLE}`}>
                Try adjusting the filters to find dashboards.
              </p>
            ) : (
              pagedDashboards.map((dashboard) => (
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
        </AdminPanel>
      </div>
    </AdminSection>
  );
}

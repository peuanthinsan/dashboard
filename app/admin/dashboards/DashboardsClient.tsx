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
const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

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
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(25);
  const [page, setPage] = useState(1);

  const companyMap = useMemo(
    () => new Map(companies.map((company) => [company.id, company.name ?? ''])),
    [companies],
  );
  const organizationMap = useMemo(
    () => new Map(organizations.map((organization) => [organization.id, organization.name ?? ''])),
    [organizations],
  );

  const filteredDashboards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return dashboards;
    }

    return dashboards.filter((dashboard) => {
      const name = (dashboard.name ?? '').toLowerCase();
      const sheetUrl = (dashboard.sheetUrl ?? '').toLowerCase();
      const template = (dashboard.template ?? '').toLowerCase();
      const company = dashboard.companyId ? companyMap.get(dashboard.companyId) ?? '' : '';
      const organization = dashboard.organizationId
        ? organizationMap.get(dashboard.organizationId) ?? ''
        : '';
      const haystack = `${name} ${sheetUrl} ${template} ${company} ${organization}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [searchQuery, dashboards, companyMap, organizationMap]);

  const totalPages = Math.max(1, Math.ceil(filteredDashboards.length / pageSize));
  const pagedDashboards = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredDashboards.slice(start, start + pageSize);
  }, [filteredDashboards, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const [dashboardCreateState, dashboardCreateAction] = useFormState(
    addDashboardAction,
    INITIAL_STATE,
  );
  useRefreshOnSuccess(dashboardCreateState);

  const totalDashboardsLabel = `${filteredDashboards.length} of ${totalDashboards}`;
  const rangeStart = filteredDashboards.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(filteredDashboards.length, page * pageSize);

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
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <label className={`flex flex-col gap-1 ${ADMIN_LABEL}`}>
                Search dashboards
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search name, template, company, sheet"
                  className={`${ADMIN_INPUT} min-w-[240px]`}
                />
              </label>
              <label className={`flex flex-col gap-1 ${ADMIN_LABEL}`}>
                Rows per page
                <select
                  value={pageSize}
                  onChange={(event) =>
                    setPageSize(Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])
                  }
                  className={ADMIN_SELECT}
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>
                Showing {rangeStart}-{rangeEnd} ({totalDashboardsLabel})
              </span>
              <button
                type="button"
                className={ADMIN_SAVE_BUTTON}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
              >
                Previous
              </button>
              <button
                type="button"
                className={ADMIN_SAVE_BUTTON}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page === totalPages}
              >
                Next
              </button>
            </div>
          </div>
          <div className="mt-4 grid gap-4">
            {pagedDashboards.length === 0 ? (
              <p className={`text-sm ${ADMIN_TEXT_SUBTLE}`}>
                No dashboards match your search. Try adjusting the query or filters.
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

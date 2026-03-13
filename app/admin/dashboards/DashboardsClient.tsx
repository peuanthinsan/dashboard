'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useFormState } from 'react-dom';
import { useRouter } from 'next/navigation';
import AdminModal from '../AdminModal';
import { INITIAL_STATE, StatusMessage, useRefreshOnSuccess } from '../admin-client-utils';
import ConfirmDeleteDialog from '../ConfirmDeleteDialog';
import { AdminPanel, AdminSection, AdminSectionHeader, AdminStatCard } from '../admin-components';
import {
  ADMIN_DELETE_BUTTON,
  ADMIN_INPUT,
  ADMIN_LABEL,
  ADMIN_PRIMARY_BUTTON,
  ADMIN_SAVE_BUTTON,
  ADMIN_SELECT,
  ADMIN_TEXTAREA,
  ADMIN_TEXT_MUTED,
  ADMIN_TEXT_SUBTLE,
} from '../admin-ui';
import {
  tableHead,
  tableHeadCell,
  tableRow,
  tableCell,
  heading3,
  textSecondary,
  badgeDefault,
  btnDanger,
  btnSmall,
  btnSecondary,
} from 'app/ui/design-tokens';
import type { ActionState, Company, Dashboard, Organization } from '../types';
import type { bulkCreateDashboards, bulkReassignDashboards, bulkDeleteDashboards } from 'app/db-bulk';

const DASHBOARD_TEMPLATES = ['Summary', 'Detail', 'Simple', 'Video', 'Driving'] as const;

type FormAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>;
type BulkCreateFn = typeof bulkCreateDashboards;
type BulkReassignFn = typeof bulkReassignDashboards;
type BulkDeleteFn = typeof bulkDeleteDashboards;

type DashboardsClientProps = {
  dashboards: Dashboard[];
  companies: Company[];
  organizations: Organization[];
  addDashboardAction: FormAction;
  manageDashboardAction: FormAction;
  bulkCreateAction: BulkCreateFn;
  bulkReassignAction: BulkReassignFn;
  bulkDeleteAction: BulkDeleteFn;
};

function DashboardRow({
  dashboard,
  companies,
  organizations,
  action,
  companyName,
  organizationName,
  checked,
  onCheck,
}: {
  dashboard: Dashboard;
  companies: Company[];
  organizations: Organization[];
  action: FormAction;
  companyName: string;
  organizationName: string;
  checked: boolean;
  onCheck: (id: number, checked: boolean) => void;
}) {
  const [state, formAction] = useFormState(action, INITIAL_STATE);
  const [isOpen, setIsOpen] = useState(false);
  useRefreshOnSuccess(state);

  useEffect(() => {
    if (state.status === 'success') {
      setIsOpen(false);
    }
  }, [state.status]);

  return (
    <>
      <tr className={tableRow}>
        <td className="px-4 py-3">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onCheck(dashboard.id, e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
          />
        </td>
        <td className={tableCell}>
          <div className="font-semibold text-zinc-900 dark:text-white">
            {dashboard.name ?? 'Untitled dashboard'}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-400">
            <span>ID {dashboard.id}</span>
            {dashboard.publicId && (
              <a
                href={`/dashboard/${dashboard.publicId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-red-500 hover:underline dark:text-red-400"
              >
                Preview ↗
              </a>
            )}
          </div>
        </td>
        <td className={tableCell}>{companyName}</td>
        <td className={tableCell}>{organizationName}</td>
        <td className={tableCell}>
          <span className={badgeDefault}>
            {dashboard.template ?? 'Summary'}
          </span>
        </td>
        <td className={tableCell}>
          <span className="block max-w-[14rem] truncate text-xs text-zinc-400" title={dashboard.sheetUrl ?? ''}>
            {dashboard.sheetUrl ?? '—'}
          </span>
        </td>
        <td className={tableCell}>
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
  bulkCreateAction,
  bulkReassignAction,
  bulkDeleteAction,
}: DashboardsClientProps) {
  const router = useRouter();
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
  useRefreshOnSuccess(dashboardCreateState);

  useEffect(() => {
    if (dashboardCreateState.status === 'success') {
      setIsCreateOpen(false);
    }
  }, [dashboardCreateState.status]);

  // Bulk state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkCreateOpen, setIsBulkCreateOpen] = useState(false);
  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');
  const [isPending, startTransition] = useTransition();

  // Bulk create form state
  const [bulkTemplate, setBulkTemplate] = useState<string>(DASHBOARD_TEMPLATES[0]);
  const [bulkSheetUrl, setBulkSheetUrl] = useState('');
  const [bulkCompanyId, setBulkCompanyId] = useState('');
  const [bulkOrgIds, setBulkOrgIds] = useState<Set<number>>(new Set());
  const [bulkDashboardName, setBulkDashboardName] = useState('');
  const [bulkNotes, setBulkNotes] = useState('');

  // Reassign state
  const [reassignOrgId, setReassignOrgId] = useState('');

  function handleCheck(id: number, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(dashboards.map((d) => d.id)));
    } else {
      setSelectedIds(new Set());
    }
  }

  function toggleBulkOrg(id: number) {
    setBulkOrgIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBulkCreate() {
    const compId = parseInt(bulkCompanyId, 10);
    if (!bulkDashboardName.trim() || !bulkSheetUrl.trim() || !compId) return;

    const orgIds = Array.from(bulkOrgIds);
    const items =
      orgIds.length > 0
        ? orgIds.map((orgId) => ({
            name: bulkDashboardName.trim(),
            template: bulkTemplate,
            sheetId: '',
            sheetGid: '',
            sheetUrl: bulkSheetUrl.trim(),
            companyId: compId,
            organizationId: orgId,
            notes: bulkNotes.trim() || undefined,
          }))
        : [
            {
              name: bulkDashboardName.trim(),
              template: bulkTemplate,
              sheetId: '',
              sheetGid: '',
              sheetUrl: bulkSheetUrl.trim(),
              companyId: compId,
              organizationId: undefined,
              notes: bulkNotes.trim() || undefined,
            },
          ];

    startTransition(async () => {
      const result = await bulkCreateAction(items);
      setBulkStatus(`Created ${result.created} dashboard(s).`);
      setBulkDashboardName('');
      setBulkSheetUrl('');
      setBulkOrgIds(new Set());
      setBulkNotes('');
      router.refresh();
    });
  }

  function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    startTransition(async () => {
      await bulkDeleteAction(ids);
      setSelectedIds(new Set());
      router.refresh();
    });
  }

  function handleBulkReassign() {
    const ids = Array.from(selectedIds);
    const oId = parseInt(reassignOrgId, 10);
    if (ids.length === 0 || !oId) return;
    startTransition(async () => {
      await bulkReassignAction(ids, oId);
      setSelectedIds(new Set());
      setIsReassignOpen(false);
      router.refresh();
    });
  }

  // Filter orgs for the selected bulk company
  const filteredOrgs = useMemo(() => {
    const cId = parseInt(bulkCompanyId, 10);
    if (!cId) return organizations;
    return organizations.filter((o) => o.companyId === cId || o.companyId === null);
  }, [organizations, bulkCompanyId]);

  const allChecked = dashboards.length > 0 && selectedIds.size === dashboards.length;

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

      {/* Reassign Modal */}
      <AdminModal
        isOpen={isReassignOpen}
        onClose={() => setIsReassignOpen(false)}
        title="Reassign dashboards to fleet"
        description={`Reassign ${selectedIds.size} dashboard(s) to a different fleet.`}
      >
        <div className="grid gap-4">
          <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
            Fleet
            <select
              value={reassignOrgId}
              onChange={(e) => setReassignOrgId(e.target.value)}
              className={ADMIN_SELECT}
            >
              <option value="">Select fleet</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsReassignOpen(false)} className={ADMIN_SAVE_BUTTON}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleBulkReassign}
              disabled={isPending || !reassignOrgId}
              className={ADMIN_PRIMARY_BUTTON}
            >
              {isPending ? 'Reassigning…' : 'Reassign'}
            </button>
          </div>
        </div>
      </AdminModal>

      <div className="grid gap-6">
        {/* Bulk Create Panel */}
        <AdminPanel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className={heading3}>Bulk create from template</h3>
              <p className={`mt-1 ${textSecondary}`}>
                Create one dashboard per selected fleet, all sharing the same template and sheet.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsBulkCreateOpen((v) => !v)}
              className={ADMIN_SAVE_BUTTON}
            >
              {isBulkCreateOpen ? 'Hide bulk create' : 'Bulk create'}
            </button>
          </div>
          {isBulkCreateOpen && (
            <div className="mt-4 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                  Dashboard name *
                  <input
                    value={bulkDashboardName}
                    onChange={(e) => setBulkDashboardName(e.target.value)}
                    placeholder="Fleet Overview"
                    className={ADMIN_INPUT}
                  />
                </label>
                <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                  Google Sheet link *
                  <input
                    value={bulkSheetUrl}
                    onChange={(e) => setBulkSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className={ADMIN_INPUT}
                  />
                </label>
                <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                  Template *
                  <select
                    value={bulkTemplate}
                    onChange={(e) => setBulkTemplate(e.target.value)}
                    className={ADMIN_SELECT}
                  >
                    {DASHBOARD_TEMPLATES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                  Company *
                  <select
                    value={bulkCompanyId}
                    onChange={(e) => {
                      setBulkCompanyId(e.target.value);
                      setBulkOrgIds(new Set());
                    }}
                    className={ADMIN_SELECT}
                  >
                    <option value="">Select company</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              {filteredOrgs.length > 0 && (
                <div>
                  <p className={`mb-2 ${ADMIN_LABEL}`}>
                    Fleets (optional — one dashboard per checked fleet)
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {filteredOrgs.map((o) => (
                      <label key={o.id} className="flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
                        <input
                          type="checkbox"
                          checked={bulkOrgIds.has(o.id)}
                          onChange={() => toggleBulkOrg(o.id)}
                          className="h-4 w-4 rounded border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
                        />
                        {o.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                Notes (optional)
                <textarea
                  value={bulkNotes}
                  onChange={(e) => setBulkNotes(e.target.value)}
                  rows={2}
                  className={`${ADMIN_TEXTAREA} resize-none`}
                />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleBulkCreate}
                  disabled={isPending || !bulkDashboardName.trim() || !bulkSheetUrl.trim() || !bulkCompanyId}
                  className={ADMIN_PRIMARY_BUTTON}
                >
                  {isPending ? 'Creating…' : 'Create dashboards'}
                </button>
                {bulkStatus && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">{bulkStatus}</p>
                )}
              </div>
            </div>
          )}
        </AdminPanel>

        {/* Manage Panel */}
        <AdminPanel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className={heading3}>Manage dashboards</h3>
              <p className={`mt-1 ${textSecondary}`}>
                Scan and edit large dashboard lists quickly.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selectedIds.size > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsReassignOpen(true)}
                    disabled={isPending}
                    className={`${btnSecondary} ${btnSmall}`}
                  >
                    Reassign to fleet ({selectedIds.size})
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    disabled={isPending}
                    className={`${btnDanger} ${btnSmall}`}
                  >
                    {isPending ? 'Deleting…' : `Delete selected (${selectedIds.size})`}
                  </button>
                </>
              )}
              <button type="button" onClick={() => setIsCreateOpen(true)} className={ADMIN_PRIMARY_BUTTON}>
                Create dashboard
              </button>
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="max-h-[32rem] overflow-auto">
              <table className="min-w-full border-collapse text-left">
                <thead className={`sticky top-0 z-10 ${tableHead} bg-zinc-50 dark:bg-zinc-800/50`}>
                  <tr>
                    <th className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="h-4 w-4 rounded border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
                      />
                    </th>
                    <th className={tableHeadCell}>Dashboard</th>
                    <th className={tableHeadCell}>Company</th>
                    <th className={tableHeadCell}>Fleet</th>
                    <th className={tableHeadCell}>Template</th>
                    <th className={tableHeadCell}>Sheet link</th>
                    <th className={tableHeadCell}>Actions</th>
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
                      checked={selectedIds.has(dashboard.id)}
                      onCheck={handleCheck}
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
      </AdminModal>
    </AdminSection>
  );
}

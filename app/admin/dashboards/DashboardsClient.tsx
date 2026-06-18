'use client';

import { useActionState, useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import AdminModal from '../AdminModal';
import {
  INITIAL_STATE,
  StatusMessage,
  useDeferredCloseOnSuccess,
  useRefreshOnSuccess,
} from '../admin-client-utils';
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
import MultiSelect from 'app/ui/MultiSelect';
import type { ActionState, Company, Dashboard, Organization } from '../types';
import AlertRulesEditor from '../AlertRulesEditor';
import ExistingRulesTable from '../ExistingRulesTable';
import ConfirmActionDialog from '../ConfirmActionDialog';
import type {
  bulkCreateDashboards,
  bulkReassignDashboards,
  bulkDeleteDashboards,
  bulkUpdateDashboardFields,
  bulkApplyDashboardAlertRules,
  bulkEditDashboardAlertRule,
  bulkRemoveDashboardAlertRule,
} from 'app/db-bulk';
import { DrivingThresholdAdminFields } from './DrivingThresholdAdminFields';
import { DrivingSheetLinkFields } from './DrivingSheetLinkFields';
import { parseDrivingThresholdsFromFormData } from 'app/dashboards/drivingThresholds';
const DASHBOARD_TEMPLATES = ['Summary', 'Detail', 'Simple', 'Driving', 'OverSpeed', 'DynamicTrip', 'BIGTHUnitStatus'] as const;
const COMPLETE_SET_TEMPLATES = ['Summary', 'Simple', 'Detail', 'Driving', 'OverSpeed'] as const;
const PAGE_SIZE = 25;

function bulkSheetTargetKey(organizationId: number | undefined, template: string) {
  return `${organizationId ?? 'company'}::${template}`;
}

type BulkSheetTargetRow = {
  key: string;
  organizationId: number | undefined;
  scopeLabel: string;
  template: string;
};

function buildBulkSheetTargets(
  orgIds: number[],
  templates: string[],
  organizationMap: Map<number, string>,
): BulkSheetTargetRow[] {
  const scopes: { organizationId: number | undefined; scopeLabel: string }[] =
    orgIds.length > 0
      ? orgIds.map((id) => ({
          organizationId: id,
          scopeLabel: organizationMap.get(id) ?? `Fleet #${id}`,
        }))
      : [{ organizationId: undefined, scopeLabel: 'Company (no fleet)' }];

  const rows: BulkSheetTargetRow[] = [];
  for (const s of scopes) {
    for (const template of templates) {
      rows.push({
        key: bulkSheetTargetKey(s.organizationId, template),
        organizationId: s.organizationId,
        scopeLabel: s.scopeLabel,
        template,
      });
    }
  }
  return rows;
}

function parseSheetLink(sheetUrl: string) {
  const trimmed = sheetUrl.trim();
  const idMatch = trimmed.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const gidMatch = trimmed.match(/gid=([0-9]+)/);
  return {
    sheetId: idMatch?.[1] ?? null,
    sheetGid: gidMatch?.[1] ?? '0',
  };
}

function AlertTypesAndRemarksSelector({
  sheetId: sheetIdProp,
  sheetGid: sheetGidProp,
  sheetUrl,
  initialAlertTypes,
  initialRemarks,
}: {
  sheetId?: string | null;
  sheetGid?: string | null;
  sheetUrl?: string;
  initialAlertTypes: string[];
  initialRemarks: string[];
}) {
  const parsed = sheetUrl ? parseSheetLink(sheetUrl) : { sheetId: null, sheetGid: '0' };
  const sheetId = sheetIdProp ?? parsed.sheetId;
  const sheetGid = sheetGidProp ?? parsed.sheetGid;
  const [alertTypes, setAlertTypes] = useState<string[]>([]);
  const [remarks, setRemarks] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);

  const loadFromSheet = async () => {
    if (!sheetId || !sheetGid) return;
    setLoading(true);
    setError(null);
    setUsedFallback(false);
    try {
      const res = await fetch(`/api/sheets/${encodeURIComponent(sheetId)}/${encodeURIComponent(sheetGid)}/fields`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to load alert types and remarks');
      }
      setAlertTypes(data.alertTypes ?? []);
      setRemarks(data.remarks ?? []);
      setUsedFallback(data.fallback === true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const showAllAlertTypes = initialAlertTypes.length === 0;
  const showAllRemarks = initialRemarks.length === 0;
  const hasLoaded = alertTypes.length > 0 || remarks.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className={`${ADMIN_LABEL} mb-0`}>Alert types & remarks</p>
        <button
          type="button"
          onClick={loadFromSheet}
          disabled={loading || !sheetId || !sheetGid}
          className={`${btnSecondary} ${btnSmall}`}
        >
          {loading ? 'Loading…' : 'Load from sheet'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {usedFallback && !error && (
        <p className={`text-xs ${ADMIN_TEXT_MUTED}`}>
          Sheet was too large or unavailable; showing default alert types and remarks. You can still narrow
          selections or leave all unchecked to show everything on the dashboard.
        </p>
      )}
      {!hasLoaded && !loading && (
        <p className={`text-xs ${ADMIN_TEXT_MUTED}`}>
          Click &quot;Load from sheet&quot; to fetch alert types and remarks from the Google Sheet. Leave all unchecked to show all.
        </p>
      )}
      {alertTypes.length > 0 && (
        <div>
          <p className={`${ADMIN_LABEL} mb-1.5 text-xs`}>Alert types to display</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 rounded border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
            {alertTypes.map((type) => (
              <label key={type} className="flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  name="alertTypes"
                  value={type}
                  defaultChecked={showAllAlertTypes || initialAlertTypes.includes(type)}
                  className="h-4 w-4 rounded border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
                />
                {type}
              </label>
            ))}
          </div>
        </div>
      )}
      {remarks.length > 0 && (
        <div>
          <p className={`${ADMIN_LABEL} mb-1.5 text-xs`}>Remarks to display</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 rounded border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
            {remarks.map((remark) => (
              <label key={remark} className="flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  name="remarks"
                  value={remark}
                  defaultChecked={showAllRemarks || initialRemarks.includes(remark)}
                  className="h-4 w-4 rounded border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
                />
                {remark}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


type FormAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>;
type BulkCreateFn = typeof bulkCreateDashboards;
type BulkReassignFn = typeof bulkReassignDashboards;
type BulkDeleteFn = typeof bulkDeleteDashboards;
type BulkUpdateFieldsFn = typeof bulkUpdateDashboardFields;
type BulkApplyRulesFn = typeof bulkApplyDashboardAlertRules;
type BulkEditRuleFn = typeof bulkEditDashboardAlertRule;
type BulkRemoveRuleFn = typeof bulkRemoveDashboardAlertRule;

type DashboardsClientProps = {
  dashboards: Dashboard[];
  companies: Company[];
  organizations: Organization[];
  lineChannels: Array<{ id: number; name: string; organizationId: number }>;
  addDashboardAction: FormAction;
  manageDashboardAction: FormAction;
  bulkCreateAction: BulkCreateFn;
  bulkReassignAction: BulkReassignFn;
  bulkDeleteAction: BulkDeleteFn;
  bulkUpdateFieldsAction: BulkUpdateFieldsFn;
  bulkApplyRulesAction: BulkApplyRulesFn;
  bulkEditRuleAction: BulkEditRuleFn;
  bulkRemoveRuleAction: BulkRemoveRuleFn;
};

function DashboardRow({
  dashboard,
  companies,
  organizations,
  lineChannels,
  action,
  companyName,
  organizationName,
  checked,
  onCheck,
}: {
  dashboard: Dashboard;
  companies: Company[];
  organizations: Organization[];
  lineChannels: Array<{ id: number; name: string; organizationId: number }>;
  action: FormAction;
  companyName: string;
  organizationName: string;
  checked: boolean;
  onCheck: (id: number, checked: boolean) => void;
}) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);
  const [isOpen, setIsOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState(dashboard.template ?? 'Summary');
  const [editCompanyId, setEditCompanyId] = useState(String(dashboard.companyId ?? ''));
  const [editOrganizationId, setEditOrganizationId] = useState(String(dashboard.organizationId ?? ''));
  const [duplicateOrgIds, setDuplicateOrgIds] = useState<Set<number>>(new Set());
  useRefreshOnSuccess(state);
  useDeferredCloseOnSuccess(state.status === 'success', () => setIsOpen(false));

  useEffect(() => {
    if (!isOpen) return;
    setEditTemplate(dashboard.template ?? 'Summary');
    setEditCompanyId(String(dashboard.companyId ?? ''));
    setEditOrganizationId(String(dashboard.organizationId ?? ''));
    setDuplicateOrgIds(new Set());
  }, [isOpen, dashboard.companyId, dashboard.organizationId, dashboard.template]);

  const editFilteredOrgs = useMemo(() => {
    const cId = parseInt(editCompanyId, 10);
    if (!cId) return [];
    return organizations.filter((o) => o.companyId === cId || o.companyId === null);
  }, [organizations, editCompanyId]);

  function toggleDuplicateOrg(id: number) {
    setDuplicateOrgIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <tr className={tableRow}>
        <td className="w-0 whitespace-nowrap pl-4 pr-3 py-3">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onCheck(dashboard.id, e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
          />
        </td>
        <td className={`${tableCell} pl-3`}>
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
          </div>
          {editTemplate === 'Driving' ? (
            <DrivingSheetLinkFields
              shiftSheetUrl={dashboard.sheetUrl}
              cntDrvSheetUrl={dashboard.sheetUrlCntDrv}
            />
          ) : (
            <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
              Sheet link
              <input
                name="sheetUrl"
                defaultValue={dashboard.sheetUrl ?? ''}
                className={ADMIN_INPUT}
              />
            </label>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
              Company
              <select
                name="companyId"
                value={editCompanyId}
                onChange={(e) => {
                  setEditCompanyId(e.target.value);
                  setEditOrganizationId('');
                  setDuplicateOrgIds(new Set());
                }}
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
                value={editOrganizationId}
                onChange={(e) => setEditOrganizationId(e.target.value)}
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
          {editFilteredOrgs.length > 0 && (
            <div>
              <p className={`mb-2 ${ADMIN_LABEL}`}>
                Also create copies for other fleets (optional)
              </p>
              <p className={`mb-2 text-xs ${ADMIN_TEXT_SUBTLE}`}>
                Saves this dashboard as-is, then creates identical dashboards for each checked fleet.
              </p>
              <div className="flex flex-wrap gap-3">
                {editFilteredOrgs
                  .filter((o) => String(o.id) !== editOrganizationId)
                  .map((o) => (
                    <label key={o.id} className="flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        name="duplicateOrganizationIds"
                        value={o.id}
                        checked={duplicateOrgIds.has(o.id)}
                        onChange={() => toggleDuplicateOrg(o.id)}
                        className="h-4 w-4 rounded border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
                      />
                      {o.name}
                    </label>
                  ))}
              </div>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
              Template
              <select
                name="template"
                value={editTemplate}
                onChange={(e) => setEditTemplate(e.target.value)}
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
          <AlertTypesAndRemarksSelector
            sheetId={dashboard.sheetId ?? undefined}
            sheetGid={dashboard.sheetGid ?? undefined}
            sheetUrl={dashboard.sheetUrl ?? undefined}
            initialAlertTypes={dashboard.alertTypes ?? []}
            initialRemarks={dashboard.remarks ?? []}
          />
          {editTemplate === 'Driving' ? (
            <DrivingThresholdAdminFields initial={dashboard.drivingThresholds} />
          ) : null}
          <label className={`flex flex-col gap-1 ${ADMIN_LABEL}`}>
            Default LINE channel
            <select
              name="lineChannelId"
              defaultValue={dashboard.lineChannelId ?? ''}
              className={ADMIN_SELECT}
            >
              <option value="">— None —</option>
              {lineChannels
                .filter((c) =>
                  editOrganizationId
                    ? c.organizationId === Number(editOrganizationId)
                    : false,
                )
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <AlertRulesEditor initial={dashboard.alertRules} />
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
  lineChannels,
  addDashboardAction,
  manageDashboardAction,
  bulkCreateAction,
  bulkReassignAction,
  bulkDeleteAction,
  bulkUpdateFieldsAction,
  bulkApplyRulesAction,
  bulkEditRuleAction,
  bulkRemoveRuleAction,
}: DashboardsClientProps) {
  const router = useRouter();

  // Client-side search, filter, pagination
  const [search, setSearch] = useState('');
  const [filterCompanyIds, setFilterCompanyIds] = useState<string[]>([]);
  const [filterOrganizationIds, setFilterOrganizationIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const companyMap = useMemo(
    () => new Map(companies.map((company) => [company.id, company.name ?? 'Unassigned'])),
    [companies],
  );
  const organizationMap = useMemo(
    () => new Map(organizations.map((organization) => [organization.id, organization.name ?? 'No fleet'])),
    [organizations],
  );

  const filteredDashboards = useMemo(() => {
    let list = dashboards;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((d) => {
        const nameMatch = (d.name ?? '').toLowerCase().includes(q);
        const companyName = d.companyId ? companyMap.get(d.companyId) ?? '' : '';
        const orgName = d.organizationId ? organizationMap.get(d.organizationId) ?? '' : '';
        return nameMatch || companyName.toLowerCase().includes(q) || orgName.toLowerCase().includes(q);
      });
    }
    if (filterCompanyIds.length > 0) {
      const cIds = new Set(filterCompanyIds.map((v) => parseInt(v, 10)).filter(Number.isFinite));
      list = list.filter((d) => d.companyId != null && cIds.has(d.companyId));
    }
    if (filterOrganizationIds.length > 0) {
      const oIds = new Set(filterOrganizationIds.map((v) => parseInt(v, 10)).filter(Number.isFinite));
      list = list.filter((d) => d.organizationId != null && oIds.has(d.organizationId));
    }
    return list;
  }, [dashboards, search, filterCompanyIds, filterOrganizationIds, companyMap, organizationMap]);

  const totalPages = Math.max(1, Math.ceil(filteredDashboards.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedDashboards = useMemo(
    () => filteredDashboards.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredDashboards, currentPage],
  );

  const totalDashboards = dashboards.length;

  const [dashboardCreateState, dashboardCreateAction] = useActionState(
    addDashboardAction,
    INITIAL_STATE,
  );
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createSheetUrl, setCreateSheetUrl] = useState('');
  const [createTemplate, setCreateTemplate] = useState<string>(DASHBOARD_TEMPLATES[0]);
  const [createCompanyId, setCreateCompanyId] = useState('');
  const [createOrgIds, setCreateOrgIds] = useState<Set<number>>(new Set());
  useRefreshOnSuccess(dashboardCreateState);
  const closeCreateDashboardModal = useCallback(() => {
    setIsCreateOpen(false);
    setCreateSheetUrl('');
    setCreateTemplate(DASHBOARD_TEMPLATES[0]);
    setCreateCompanyId('');
    setCreateOrgIds(new Set());
  }, []);
  useDeferredCloseOnSuccess(dashboardCreateState.status === 'success', closeCreateDashboardModal);

  // Bulk state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkCreateOpen, setIsBulkCreateOpen] = useState(false);
  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const [isBulkRulesOpen, setIsBulkRulesOpen] = useState(false);
  const [bulkRulesMode, setBulkRulesMode] = useState<'append' | 'replace'>('append');
  const [isBulkClearConfirmOpen, setIsBulkClearConfirmOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');
  const [isPending, startTransition] = useTransition();

  // Bulk create form state
  const [bulkCreateCompleteSet, setBulkCreateCompleteSet] = useState(true);
  const [bulkTemplate, setBulkTemplate] = useState<string>(DASHBOARD_TEMPLATES[0]);
  const [bulkSheetUrl, setBulkSheetUrl] = useState('');
  const [bulkCompanyId, setBulkCompanyId] = useState('');
  const [bulkOrgIds, setBulkOrgIds] = useState<Set<number>>(new Set());
  const [bulkDashboardName, setBulkDashboardName] = useState('');
  const [bulkNotes, setBulkNotes] = useState('');
  const [bulkPerTargetSheets, setBulkPerTargetSheets] = useState(false);
  const [bulkSheetByTarget, setBulkSheetByTarget] = useState<Record<string, string>>({});

  // Reassign state
  const [reassignOrgId, setReassignOrgId] = useState('');

  // Bulk update fields state
  const [isBulkFieldsOpen, setIsBulkFieldsOpen] = useState(false);
  const [bulkFieldsSheetUrl, setBulkFieldsSheetUrl] = useState('');
  const [bulkFieldsAlertTypes, setBulkFieldsAlertTypes] = useState<string[]>([]);
  const [bulkFieldsRemarks, setBulkFieldsRemarks] = useState<string[]>([]);
  const [bulkFieldsLoaded, setBulkFieldsLoaded] = useState(false);
  const [bulkFieldsLoading, setBulkFieldsLoading] = useState(false);
  const [bulkFieldsError, setBulkFieldsError] = useState<string | null>(null);
  const [bulkFieldsSelectedAlertTypes, setBulkFieldsSelectedAlertTypes] = useState<Set<string>>(new Set());
  const [bulkFieldsSelectedRemarks, setBulkFieldsSelectedRemarks] = useState<Set<string>>(new Set());
  const [bulkFieldsApplyThresholds, setBulkFieldsApplyThresholds] = useState(false);
  const [bulkFieldsApplyLineChannel, setBulkFieldsApplyLineChannel] = useState(false);

  const bulkSelectedDashboards = useMemo(
    () => dashboards.filter((d) => selectedIds.has(d.id)),
    [dashboards, selectedIds],
  );
  const bulkAllAreDriving =
    bulkSelectedDashboards.length > 0 &&
    bulkSelectedDashboards.every((d) => d.template === 'Driving');
  const bulkSharedOrgId =
    bulkSelectedDashboards.length > 0 &&
    bulkSelectedDashboards.every((d) => d.organizationId === bulkSelectedDashboards[0].organizationId)
      ? bulkSelectedDashboards[0].organizationId
      : null;
  const bulkSharedOrgChannels = useMemo(
    () =>
      bulkSharedOrgId != null
        ? lineChannels.filter((c) => c.organizationId === bulkSharedOrgId)
        : [],
    [lineChannels, bulkSharedOrgId],
  );

  function handleCheck(id: number, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function handleSelectAll(checked: boolean) {
    const pageIds = new Set(paginatedDashboards.map((d) => d.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        pageIds.forEach((id) => next.add(id));
      } else {
        pageIds.forEach((id) => next.delete(id));
      }
      return next;
    });
  }

  function toggleBulkOrg(id: number) {
    setBulkOrgIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCreateOrg(id: number) {
    setCreateOrgIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBulkCreate() {
    const compId = parseInt(bulkCompanyId, 10);
    if (!bulkDashboardName.trim() || !compId) return;

    const baseName = bulkDashboardName.trim();
    const defaultSheetUrl = bulkSheetUrl.trim();
    const notes = bulkNotes.trim() || undefined;

    const templates = bulkCreateCompleteSet
      ? [...COMPLETE_SET_TEMPLATES]
      : [bulkTemplate];

    const orgIds = Array.from(bulkOrgIds);

    const items: {
      name: string;
      template: string;
      sheetId: string;
      sheetGid: string;
      sheetUrl: string;
      companyId: number;
      organizationId?: number;
      notes?: string;
    }[] = [];

    if (!bulkPerTargetSheets) {
      if (!defaultSheetUrl) return;
      const { sheetId, sheetGid } = parseSheetLink(defaultSheetUrl);
      if (!sheetId) {
        setBulkStatus('Enter a valid Google Sheet link.');
        return;
      }

      const scopes = orgIds.length > 0
        ? orgIds.map((orgId) => ({ companyId: compId, organizationId: orgId }))
        : [{ companyId: compId, organizationId: undefined as number | undefined }];

      for (const scope of scopes) {
        for (const template of templates) {
          items.push({
            name: baseName,
            template,
            sheetId,
            sheetGid: sheetGid ?? '0',
            sheetUrl: defaultSheetUrl,
            companyId: compId,
            organizationId: scope.organizationId,
            notes,
          });
        }
      }
    } else {
      const targetRows = buildBulkSheetTargets(orgIds, templates, organizationMap);

      for (const row of targetRows) {
        const rowUrl = (bulkSheetByTarget[row.key] ?? '').trim() || defaultSheetUrl;
        if (!rowUrl) {
          setBulkStatus(
            `Missing sheet link for ${row.scopeLabel} — ${row.template}. Enter a link in that row or set the default sheet link below.`,
          );
          return;
        }
        const { sheetId, sheetGid } = parseSheetLink(rowUrl);
        if (!sheetId) {
          setBulkStatus(
            `Invalid Google Sheet link for ${row.scopeLabel} — ${row.template}.`,
          );
          return;
        }
        items.push({
          name: baseName,
          template: row.template,
          sheetId,
          sheetGid: sheetGid ?? '0',
          sheetUrl: rowUrl,
          companyId: compId,
          organizationId: row.organizationId,
          notes,
        });
      }
    }

    startTransition(async () => {
      const result = await bulkCreateAction(items);
      setBulkStatus(`Created ${result.created} dashboard(s).`);
      setBulkDashboardName('');
      setBulkSheetUrl('');
      setBulkOrgIds(new Set());
      setBulkNotes('');
      setBulkSheetByTarget({});
      setBulkPerTargetSheets(false);
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

  function handleBulkApplyRules(formData: FormData) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const raw = (formData.get('alertRulesJson') as string) ?? '[]';
    let rules: import('app/dashboards/dashboardDataUtils').AlertRule[] = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) rules = parsed;
    } catch {
      setBulkStatus('Invalid rule data.');
      return;
    }
    startTransition(async () => {
      const result = await bulkApplyRulesAction(ids, rules, bulkRulesMode);
      setBulkStatus(`Applied ${rules.length} rule(s) to ${result.updated} dashboard(s) (${bulkRulesMode}).`);
      setSelectedIds(new Set());
      setIsBulkRulesOpen(false);
      router.refresh();
    });
  }

  function handleBulkClearRules() {
    if (selectedIds.size === 0) return;
    setIsBulkClearConfirmOpen(true);
  }

  function runBulkClearRules() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    startTransition(async () => {
      const result = await bulkApplyRulesAction(ids, [], 'replace');
      setBulkStatus(`Cleared alert rules on ${result.updated} dashboard(s).`);
      setSelectedIds(new Set());
      setIsBulkRulesOpen(false);
      router.refresh();
    });
  }

  function loadBulkFieldsFromSheet() {
    const { sheetId, sheetGid } = parseSheetLink(bulkFieldsSheetUrl);
    if (!sheetId || !sheetGid) {
      setBulkFieldsError('Enter a valid Google Sheet link.');
      return;
    }
    setBulkFieldsLoading(true);
    setBulkFieldsError(null);
    fetch(`/api/sheets/${encodeURIComponent(sheetId)}/${encodeURIComponent(sheetGid)}/fields`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then((data) => {
        const at = data.alertTypes ?? [];
        const rm = data.remarks ?? [];
        setBulkFieldsAlertTypes(at);
        setBulkFieldsRemarks(rm);
        setBulkFieldsSelectedAlertTypes(new Set(at));
        setBulkFieldsSelectedRemarks(new Set(rm));
        setBulkFieldsLoaded(true);
      })
      .catch(() => setBulkFieldsError('Failed to load alert types and remarks.'))
      .finally(() => setBulkFieldsLoading(false));
  }

  function toggleBulkFieldsAlertType(type: string) {
    setBulkFieldsSelectedAlertTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function toggleBulkFieldsRemark(remark: string) {
    setBulkFieldsSelectedRemarks((prev) => {
      const next = new Set(prev);
      if (next.has(remark)) next.delete(remark);
      else next.add(remark);
      return next;
    });
  }

  function handleBulkFieldsApply(formData: FormData) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const alertTypes = bulkFieldsSelectedAlertTypes.size > 0 ? Array.from(bulkFieldsSelectedAlertTypes) : null;
    const remarks = bulkFieldsSelectedRemarks.size > 0 ? Array.from(bulkFieldsSelectedRemarks) : null;

    const payload: Parameters<typeof bulkUpdateFieldsAction>[1] = { alertTypes, remarks };
    const labels: string[] = ['alert types & remarks'];

    if (bulkAllAreDriving && bulkFieldsApplyThresholds) {
      payload.drivingThresholds = parseDrivingThresholdsFromFormData(formData);
      labels.push('driving thresholds');
    }
    if (bulkAllAreDriving && bulkSharedOrgId != null && bulkFieldsApplyLineChannel) {
      const raw = formData.get('lineChannelId');
      const rawStr = typeof raw === 'string' ? raw : '';
      payload.lineChannelId = rawStr.length > 0 ? Number(rawStr) : null;
      labels.push('LINE channel');
    }

    startTransition(async () => {
      await bulkUpdateFieldsAction(ids, payload);
      setSelectedIds(new Set());
      setIsBulkFieldsOpen(false);
      setBulkFieldsLoaded(false);
      setBulkFieldsAlertTypes([]);
      setBulkFieldsRemarks([]);
      setBulkFieldsSelectedAlertTypes(new Set());
      setBulkFieldsSelectedRemarks(new Set());
      setBulkFieldsSheetUrl('');
      setBulkFieldsApplyThresholds(false);
      setBulkFieldsApplyLineChannel(false);
      setBulkStatus(`Updated ${labels.join(', ')} for ${ids.length} dashboard(s).`);
      router.refresh();
    });
  }

  function openBulkFieldsModal() {
    const selected = dashboards.filter((d) => selectedIds.has(d.id));
    const firstSheetUrl = selected[0]?.sheetUrl ?? '';
    setBulkFieldsSheetUrl(firstSheetUrl);
    setBulkFieldsLoaded(false);
    setBulkFieldsAlertTypes([]);
    setBulkFieldsRemarks([]);
    setBulkFieldsSelectedAlertTypes(new Set());
    setBulkFieldsSelectedRemarks(new Set());
    setBulkFieldsError(null);
    setBulkFieldsApplyThresholds(false);
    setBulkFieldsApplyLineChannel(false);
    setIsBulkFieldsOpen(true);
  }

  // Filter orgs for the selected bulk company
  const filteredOrgs = useMemo(() => {
    const cId = parseInt(bulkCompanyId, 10);
    if (!cId) return organizations;
    return organizations.filter((o) => o.companyId === cId || o.companyId === null);
  }, [organizations, bulkCompanyId]);

  const createFilteredOrgs = useMemo(() => {
    const cId = parseInt(createCompanyId, 10);
    if (!cId) return [];
    return organizations.filter((o) => o.companyId === cId || o.companyId === null);
  }, [organizations, createCompanyId]);

  const createSingleOrgId = createOrgIds.size === 1 ? Array.from(createOrgIds)[0] : null;

  const bulkSheetTargetRows = useMemo(() => {
    const cId = parseInt(bulkCompanyId, 10);
    if (!cId) return [];
    const templates = bulkCreateCompleteSet ? [...COMPLETE_SET_TEMPLATES] : [bulkTemplate];
    return buildBulkSheetTargets(Array.from(bulkOrgIds), templates, organizationMap);
  }, [bulkCompanyId, bulkCreateCompleteSet, bulkTemplate, bulkOrgIds, organizationMap]);

  const allChecked = paginatedDashboards.length > 0 && paginatedDashboards.every((d) => selectedIds.has(d.id));
  const offScreenSelectedCount = Array.from(selectedIds).filter((id) => !filteredDashboards.some((d) => d.id === id)).length;

  const bulkCreateButtonDisabled =
    isPending ||
    !bulkDashboardName.trim() ||
    !bulkCompanyId ||
    (!bulkPerTargetSheets && !bulkSheetUrl.trim()) ||
    (bulkPerTargetSheets && bulkSheetTargetRows.length === 0);

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

      <ConfirmActionDialog
        isOpen={isBulkClearConfirmOpen}
        title="Clear all alert rules"
        description={`Clear every alert rule from ${selectedIds.size} selected dashboard${selectedIds.size === 1 ? '' : 's'}? This cannot be undone.`}
        confirmLabel="Clear rules"
        destructive
        onClose={() => setIsBulkClearConfirmOpen(false)}
        onConfirm={runBulkClearRules}
      />

      {/* Bulk apply alert rules modal */}
      <AdminModal
        isOpen={isBulkRulesOpen}
        onClose={() => setIsBulkRulesOpen(false)}
        title="Alert rules — bulk manage"
        description={`Review, edit, remove, or add rules across ${selectedIds.size} selected dashboard(s).`}
      >
        <div className="grid gap-5">
          <section className="grid gap-2">
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Existing rules across selection</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Every unique rule already applied on the selected dashboards. Edit or remove propagates to every dashboard that has it.</p>
            <ExistingRulesTable
              owners={dashboards.filter((d) => selectedIds.has(d.id))}
              ownerLabel="dashboard"
              editAction={bulkEditRuleAction}
              removeAction={bulkRemoveRuleAction}
              onChanged={() => router.refresh()}
            />
          </section>

          <section className="grid gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Add new rules</h3>
        <form
          action={(fd) => handleBulkApplyRules(fd)}
          className="grid gap-4"
        >
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className={ADMIN_LABEL}>Mode</span>
            <label className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
              <input type="radio" name="mode" checked={bulkRulesMode === 'append'} onChange={() => setBulkRulesMode('append')} />
              Append (keep existing rules)
            </label>
            <label className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
              <input type="radio" name="mode" checked={bulkRulesMode === 'replace'} onChange={() => setBulkRulesMode('replace')} />
              Replace (overwrite existing)
            </label>
          </div>
          <AlertRulesEditor />
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={handleBulkClearRules}
              disabled={isPending}
              className={`${btnDanger} ${btnSmall}`}
              title="Wipe every alert rule from selected dashboards"
            >
              Clear all rules on selected
            </button>
            <button type="button" onClick={() => setIsBulkRulesOpen(false)} className={ADMIN_SAVE_BUTTON}>
              Cancel
            </button>
            <button type="submit" disabled={isPending} className={ADMIN_PRIMARY_BUTTON}>
              {isPending ? 'Applying…' : `Apply to ${selectedIds.size} dashboard(s)`}
            </button>
          </div>
        </form>
          </section>
        </div>
      </AdminModal>

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

      {/* Bulk Set Alert Types & Remarks Modal */}
      <AdminModal
        isOpen={isBulkFieldsOpen}
        onClose={() => setIsBulkFieldsOpen(false)}
        title="Set alert types & remarks"
        description={`Apply alert types and remarks to ${selectedIds.size} selected dashboard(s).`}
      >
        <form action={(fd) => handleBulkFieldsApply(fd)} className="grid gap-4">
          <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
            Sheet link (to load options)
            <input
              value={bulkFieldsSheetUrl}
              onChange={(e) => setBulkFieldsSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className={ADMIN_INPUT}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadBulkFieldsFromSheet}
              disabled={bulkFieldsLoading || !bulkFieldsSheetUrl.trim()}
              className={`${btnSecondary} ${btnSmall}`}
            >
              {bulkFieldsLoading ? 'Loading…' : 'Load from sheet'}
            </button>
          </div>
          {bulkFieldsError && <p className="text-xs text-red-600 dark:text-red-400">{bulkFieldsError}</p>}
          {bulkFieldsLoaded && (
            <>
              {bulkFieldsAlertTypes.length > 0 && (
                <div>
                  <p className={`${ADMIN_LABEL} mb-1.5 text-xs`}>Alert types</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 rounded border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
                    {bulkFieldsAlertTypes.map((type) => (
                      <label key={type} className="flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={bulkFieldsSelectedAlertTypes.has(type)}
                          onChange={() => toggleBulkFieldsAlertType(type)}
                          className="h-4 w-4 rounded border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
                        />
                        {type}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {bulkFieldsRemarks.length > 0 && (
                <div>
                  <p className={`${ADMIN_LABEL} mb-1.5 text-xs`}>Remarks</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 rounded border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
                    {bulkFieldsRemarks.map((remark) => (
                      <label key={remark} className="flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={bulkFieldsSelectedRemarks.has(remark)}
                          onChange={() => toggleBulkFieldsRemark(remark)}
                          className="h-4 w-4 rounded border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
                        />
                        {remark}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <p className={`text-xs ${ADMIN_TEXT_MUTED}`}>
                Leave all unchecked to clear and show all. Checked items will be applied to all selected dashboards.
              </p>
            </>
          )}

          {bulkAllAreDriving && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={bulkFieldsApplyThresholds}
                  onChange={(e) => setBulkFieldsApplyThresholds(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
                />
                Apply driving thresholds to selected
              </label>
              {bulkFieldsApplyThresholds ? (
                <DrivingThresholdAdminFields initial={undefined} />
              ) : (
                <p className={`text-xs ${ADMIN_TEXT_MUTED}`}>
                  When checked, the thresholds below replace each dashboard&apos;s drivingThresholds column.
                </p>
              )}
            </div>
          )}

          {bulkAllAreDriving && bulkSharedOrgId != null && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={bulkFieldsApplyLineChannel}
                  onChange={(e) => setBulkFieldsApplyLineChannel(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
                />
                Apply default LINE channel to selected
              </label>
              {bulkFieldsApplyLineChannel ? (
                <label className={`flex flex-col gap-1 ${ADMIN_LABEL}`}>
                  Default LINE channel
                  <select name="lineChannelId" defaultValue="" className={ADMIN_SELECT}>
                    <option value="">— None —</option>
                    {bulkSharedOrgChannels.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {bulkSharedOrgChannels.length === 0 && (
                    <span className={`text-xs ${ADMIN_TEXT_MUTED}`}>
                      No LINE channels exist for this fleet — applying will clear the channel on selected dashboards.
                    </span>
                  )}
                </label>
              ) : (
                <p className={`text-xs ${ADMIN_TEXT_MUTED}`}>
                  When checked, the selected channel replaces each dashboard&apos;s lineChannelId column.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsBulkFieldsOpen(false)} className={ADMIN_SAVE_BUTTON}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className={ADMIN_PRIMARY_BUTTON}
            >
              {isPending ? 'Applying…' : `Apply to ${selectedIds.size} dashboard(s)`}
            </button>
          </div>
        </form>
      </AdminModal>

      <div className="grid gap-6">
        {/* Manage Panel — table and bulk actions first */}
        <AdminPanel>
            <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className={heading3}>Manage dashboards</h3>
              <p className={`mt-1 ${textSecondary}`}>
                Select dashboards below to use bulk actions (reassign, set alert types &amp; remarks, delete).
              </p>
              {bulkStatus && (
                <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">{bulkStatus}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by name…"
                className={`min-w-[12rem] ${ADMIN_INPUT}`}
                aria-label="Search dashboards"
              />
              <MultiSelect
                label="Companies"
                options={companies.map((c) => c.name ?? '').filter(Boolean)}
                selected={filterCompanyIds
                  .map((id) => companies.find((c) => String(c.id) === id)?.name ?? '')
                  .filter(Boolean)}
                onChange={(names) => {
                  const ids = companies.filter((c) => c.name && names.includes(c.name)).map((c) => String(c.id));
                  setFilterCompanyIds(ids);
                  setPage(1);
                }}
              />
              <MultiSelect
                label="Fleets"
                options={organizations.map((o) => o.name ?? '').filter(Boolean)}
                selected={filterOrganizationIds
                  .map((id) => organizations.find((o) => String(o.id) === id)?.name ?? '')
                  .filter(Boolean)}
                onChange={(names) => {
                  const ids = organizations.filter((o) => o.name && names.includes(o.name)).map((o) => String(o.id));
                  setFilterOrganizationIds(ids);
                  setPage(1);
                }}
              />
              <button
                type="button"
                onClick={() => setIsReassignOpen(true)}
                disabled={isPending || selectedIds.size === 0}
                className={`${btnSecondary} ${btnSmall}`}
                title={selectedIds.size === 0 ? 'Select dashboards below first' : undefined}
              >
                Reassign to fleet{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
              </button>
              <button
                type="button"
                onClick={openBulkFieldsModal}
                disabled={isPending || selectedIds.size === 0}
                className={`${btnSecondary} ${btnSmall}`}
                title={selectedIds.size === 0 ? 'Select dashboards below first' : undefined}
              >
                Set alert types & remarks{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
              </button>
              <button
                type="button"
                onClick={() => setIsBulkRulesOpen(true)}
                disabled={isPending || selectedIds.size === 0}
                className={`${btnSecondary} ${btnSmall}`}
                title={selectedIds.size === 0 ? 'Select dashboards below first' : undefined}
              >
                Apply alert rules{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={isPending || selectedIds.size === 0}
                className={`${btnDanger} ${btnSmall}`}
                title={selectedIds.size === 0 ? 'Select dashboards below first' : undefined}
              >
                {isPending ? 'Deleting…' : `Delete selected${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}
              </button>
              <button type="button" onClick={() => setIsCreateOpen(true)} className={ADMIN_PRIMARY_BUTTON}>
                Create dashboard
              </button>
            </div>
          </div>
          {selectedIds.size > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
              <span>
                <strong>{selectedIds.size}</strong> selected
                {offScreenSelectedCount > 0 ? ` (${offScreenSelectedCount} on other filters/pages)` : ''}
              </span>
              {filteredDashboards.length > paginatedDashboards.length && !filteredDashboards.every((d) => selectedIds.has(d.id)) && (
                <button
                  type="button"
                  onClick={() => setSelectedIds((prev) => {
                    const next = new Set(prev);
                    filteredDashboards.forEach((d) => next.add(d.id));
                    return next;
                  })}
                  className="font-semibold underline hover:no-underline"
                >
                  Add all {filteredDashboards.length} filtered to selection
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="ml-auto text-xs underline hover:no-underline"
              >
                Clear selection
              </button>
            </div>
          )}
          {totalPages > 1 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Showing {paginatedDashboards.length} of {filteredDashboards.length} dashboard{filteredDashboards.length !== 1 ? 's' : ''}
                {selectedIds.size === filteredDashboards.length && filteredDashboards.length > 0 ? (
                  <span className="ml-2 text-amber-700 dark:text-amber-400">• all {filteredDashboards.length} selected</span>
                ) : null}
              </p>
              <nav aria-label="Pagination" className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  ← Prev
                </button>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  Next →
                </button>
              </nav>
            </div>
          )}
          <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="max-h-[32rem] overflow-auto">
              <table className="min-w-full border-collapse text-left">
                <thead className={`sticky top-0 z-10 ${tableHead} bg-zinc-50 dark:bg-zinc-800/50`}>
                  <tr>
                    <th className="w-0 whitespace-nowrap pl-4 pr-3 py-3">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="h-4 w-4 rounded border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
                      />
                    </th>
                    <th className={`${tableHeadCell} pl-3`}>Dashboard</th>
                    <th className={tableHeadCell}>Company</th>
                    <th className={tableHeadCell}>Fleet</th>
                    <th className={tableHeadCell}>Template</th>
                    <th className={tableHeadCell}>Sheet link</th>
                    <th className={tableHeadCell}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDashboards.map((dashboard) => (
                    <DashboardRow
                      key={dashboard.id}
                      dashboard={dashboard}
                      companies={companies}
                      organizations={organizations}
                      lineChannels={lineChannels}
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
            {paginatedDashboards.length === 0 ? (
              <p className={`px-4 py-6 text-sm ${ADMIN_TEXT_SUBTLE}`}>
                {dashboards.length === 0
                  ? 'No dashboards yet. Create one to make it available to users.'
                  : 'No dashboards match your search or filters.'}
              </p>
            ) : null}
          </div>
        </AdminPanel>

        {/* Bulk Create Panel */}
        <AdminPanel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className={heading3}>Bulk create from template</h3>
              <p className={`mt-1 ${textSecondary}`}>
                Create dashboards in one go. Use one sheet link for every fleet and template, or turn on per-row links when Driving and other templates use different spreadsheets.
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
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={bulkCreateCompleteSet}
                  onChange={(e) => setBulkCreateCompleteSet(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
                />
                Create complete set (Summary, Simple, Detail, Driving)
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={bulkPerTargetSheets}
                  onChange={(e) => setBulkPerTargetSheets(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
                />
                Different sheet link per fleet and template
              </label>
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
                  {bulkPerTargetSheets ? (
                    <>
                      Default Google Sheet link
                      <span className={`text-xs font-normal ${ADMIN_TEXT_SUBTLE}`}>
                        Used for any row you leave blank below (optional if every row has its own link).
                      </span>
                    </>
                  ) : (
                    'Google Sheet link *'
                  )}
                  <input
                    value={bulkSheetUrl}
                    onChange={(e) => setBulkSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className={ADMIN_INPUT}
                  />
                </label>
                {!bulkCreateCompleteSet && (
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
                )}
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
                    Fleets (optional — one dashboard per checked fleet per template)
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
              {bulkPerTargetSheets && (
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <p className={`border-b border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 ${ADMIN_LABEL}`}>
                    Sheet link per scope and template
                  </p>
                  {bulkSheetTargetRows.length === 0 ? (
                    <p className={`px-3 py-4 text-sm ${ADMIN_TEXT_SUBTLE}`}>
                      Select a company to see rows. With no fleets checked, you get one row group for the company; with fleets checked, each fleet gets a row per template.
                    </p>
                  ) : (
                    <div className="max-h-72 overflow-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="sticky top-0 bg-zinc-50 text-xs font-medium text-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-400">
                          <tr>
                            <th className="whitespace-nowrap px-3 py-2">Scope</th>
                            <th className="whitespace-nowrap px-3 py-2">Template</th>
                            <th className="min-w-[12rem] px-3 py-2">Google Sheet link</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bulkSheetTargetRows.map((row) => (
                            <tr
                              key={row.key}
                              className="border-t border-zinc-100 dark:border-zinc-800"
                            >
                              <td className="whitespace-nowrap px-3 py-2 text-zinc-800 dark:text-zinc-200">
                                {row.scopeLabel}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-zinc-700 dark:text-zinc-300">
                                {row.template}
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="url"
                                  value={bulkSheetByTarget[row.key] ?? ''}
                                  onChange={(e) =>
                                    setBulkSheetByTarget((prev) => ({
                                      ...prev,
                                      [row.key]: e.target.value,
                                    }))
                                  }
                                  placeholder={bulkSheetUrl.trim() ? 'Uses default link' : 'https://docs.google.com/...'}
                                  className={`${ADMIN_INPUT} w-full min-w-[14rem] font-mono text-xs`}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
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
                  disabled={bulkCreateButtonDisabled}
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
      </div>

      <AdminModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create dashboard"
        description="Add one or more dashboards with the same settings. Check fleets to create one per fleet, or leave all unchecked for a company-wide dashboard."
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
            <div className="flex flex-col gap-2 sm:col-span-2">
              {createTemplate === 'Driving' ? (
                <DrivingSheetLinkFields
                  shiftSheetUrl={createSheetUrl}
                  onShiftSheetUrlChange={setCreateSheetUrl}
                />
              ) : (
                <>
                  <label className={ADMIN_LABEL}>Google Sheet link *</label>
                  <input
                    name="sheetUrl"
                    value={createSheetUrl}
                    onChange={(e) => setCreateSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className={ADMIN_INPUT}
                  />
                </>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label className={ADMIN_LABEL}>Company *</label>
              <select
                name="companyId"
                value={createCompanyId}
                onChange={(e) => {
                  setCreateCompanyId(e.target.value);
                  setCreateOrgIds(new Set());
                }}
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
            {createFilteredOrgs.length > 0 ? (
              <div className="sm:col-span-2">
                <p className={`mb-2 ${ADMIN_LABEL}`}>
                  Fleets (optional — one dashboard per checked fleet)
                </p>
                <p className={`mb-2 text-xs ${ADMIN_TEXT_SUBTLE}`}>
                  Leave all unchecked for a company-wide dashboard with no fleet.
                </p>
                <div className="flex flex-wrap gap-3">
                  {createFilteredOrgs.map((o) => (
                    <label key={o.id} className="flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        name="organizationIds"
                        value={o.id}
                        checked={createOrgIds.has(o.id)}
                        onChange={() => toggleCreateOrg(o.id)}
                        className="h-4 w-4 rounded border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
                      />
                      {o.name}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="flex flex-col gap-2">
              <label className={ADMIN_LABEL}>Template *</label>
              <select
                name="template"
                value={createTemplate}
                onChange={(e) => setCreateTemplate(e.target.value)}
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
            <div className="sm:col-span-2">
              <AlertTypesAndRemarksSelector
                sheetUrl={createSheetUrl}
                initialAlertTypes={[]}
                initialRemarks={[]}
              />
            </div>
            {createTemplate === 'Driving' ? (
              <div className="sm:col-span-2">
                <DrivingThresholdAdminFields />
              </div>
            ) : null}
            <div className="flex flex-col gap-2 sm:col-span-2">
              <label className={`flex flex-col gap-1 ${ADMIN_LABEL}`}>
                Default LINE channel
                {createOrgIds.size !== 1 && (
                  <span className={`text-xs font-normal ${ADMIN_TEXT_SUBTLE}`}>
                    Select exactly one fleet to assign a LINE channel.
                  </span>
                )}
                <select
                  name="lineChannelId"
                  defaultValue=""
                  disabled={createOrgIds.size !== 1}
                  className={ADMIN_SELECT}
                >
                  <option value="">— None —</option>
                  {lineChannels
                    .filter((c) =>
                      createSingleOrgId != null
                        ? c.organizationId === createSingleOrgId
                        : false,
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={`text-xs ${ADMIN_TEXT_SUBTLE}`}>
              Links are validated and parsed automatically.
            </p>
            <button type="submit" className={ADMIN_PRIMARY_BUTTON}>
              {createOrgIds.size > 1 ? `Create ${createOrgIds.size} dashboards` : 'Create dashboard'}
            </button>
          </div>
          <StatusMessage state={dashboardCreateState} />
        </form>
      </AdminModal>
    </AdminSection>
  );
}

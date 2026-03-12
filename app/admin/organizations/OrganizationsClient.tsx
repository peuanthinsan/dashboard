'use client';

import { useEffect, useState, useTransition } from 'react';
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
  btnDanger,
  btnSmall,
  btnSecondary,
} from 'app/ui/design-tokens';
import type { ActionState, Company, Organization } from '../types';
import type {
  bulkCreateOrganizations,
  bulkReassignOrganizations,
  bulkDeleteOrganizations,
} from 'app/db-bulk';

type FormAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>;
type BulkCreateFn = typeof bulkCreateOrganizations;
type BulkReassignFn = typeof bulkReassignOrganizations;
type BulkDeleteFn = typeof bulkDeleteOrganizations;

type OrganizationsClientProps = {
  organizations: Organization[];
  companies: Company[];
  addOrganizationAction: FormAction;
  manageOrganizationAction: FormAction;
  bulkCreateAction: BulkCreateFn;
  bulkReassignAction: BulkReassignFn;
  bulkDeleteAction: BulkDeleteFn;
};

function OrganizationRow({
  organization,
  companies,
  action,
  checked,
  onCheck,
}: {
  organization: Organization;
  companies: Company[];
  action: FormAction;
  checked: boolean;
  onCheck: (id: number, checked: boolean) => void;
}) {
  const [state, formAction] = useFormState(action, INITIAL_STATE);
  const [isOpen, setIsOpen] = useState(false);
  const company = companies.find((entry) => entry.id === organization.companyId);
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
            onChange={(e) => onCheck(organization.id, e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
          />
        </td>
        <td className={tableCell}>
          <div className="font-semibold text-zinc-900 dark:text-white">
            {organization.name ?? 'Unnamed fleet'}
          </div>
          <div className="mt-0.5 text-xs text-zinc-400">ID {organization.id}</div>
        </td>
        <td className={tableCell}>
          <div className="text-sm text-zinc-700 dark:text-zinc-300">
            {company?.name ?? 'No company assigned'}
          </div>
        </td>
        <td className={`${tableCell} text-right`}>
          <button type="button" onClick={() => setIsOpen(true)} className={ADMIN_SAVE_BUTTON}>
            Edit
          </button>
        </td>
      </tr>

      <AdminModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Edit fleet"
        description="Update fleet names or remove unused fleets."
      >
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="organizationId" value={organization.id} />
          <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
            Fleet name
            <input
              name="organizationName"
              defaultValue={organization.name ?? ''}
              className={ADMIN_INPUT}
            />
          </label>
          <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
            Company
            <select
              name="companyId"
              defaultValue={organization.companyId ?? ''}
              className={ADMIN_SELECT}
            >
              <option value="">No company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <StatusMessage state={state} />
            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" name="intent" value="save" className={ADMIN_SAVE_BUTTON}>
                Save changes
              </button>
              <ConfirmDeleteDialog
                title="Delete fleet"
                description="This will permanently delete the fleet record."
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

export default function OrganizationsClient({
  organizations,
  companies,
  addOrganizationAction,
  manageOrganizationAction,
  bulkCreateAction,
  bulkReassignAction,
  bulkDeleteAction,
}: OrganizationsClientProps) {
  const router = useRouter();
  const totalOrganizations = organizations.length;

  const [organizationCreateState, organizationCreateAction] = useFormState(
    addOrganizationAction,
    INITIAL_STATE,
  );
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  useRefreshOnSuccess(organizationCreateState);

  useEffect(() => {
    if (organizationCreateState.status === 'success') {
      setIsCreateOpen(false);
    }
  }, [organizationCreateState.status]);

  // Bulk state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkNames, setBulkNames] = useState('');
  const [bulkCompanyId, setBulkCompanyId] = useState('');
  const [reassignCompanyId, setReassignCompanyId] = useState('');
  const [isBulkCreateOpen, setIsBulkCreateOpen] = useState(false);
  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');
  const [isPending, startTransition] = useTransition();

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
      setSelectedIds(new Set(organizations.map((o) => o.id)));
    } else {
      setSelectedIds(new Set());
    }
  }

  function handleBulkCreate() {
    const names = bulkNames.split('\n').map((n) => n.trim()).filter(Boolean);
    const cId = parseInt(bulkCompanyId, 10);
    if (names.length === 0 || !cId) return;
    startTransition(async () => {
      const result = await bulkCreateAction(names, cId);
      setBulkStatus(`Created ${result.created}, skipped ${result.skipped} duplicates.`);
      setBulkNames('');
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
    const cId = parseInt(reassignCompanyId, 10);
    if (ids.length === 0 || !cId) return;
    startTransition(async () => {
      await bulkReassignAction(ids, cId);
      setSelectedIds(new Set());
      setIsReassignOpen(false);
      router.refresh();
    });
  }

  const allChecked =
    organizations.length > 0 && selectedIds.size === organizations.length;

  return (
    <AdminSection>
      <AdminSectionHeader
        eyebrow="Fleet setup"
        title="Fleets"
        description="Group teams and departments to filter dashboard access."
        count={totalOrganizations}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="Total fleets"
          value={totalOrganizations}
          description="Group access by department or region."
        />
        <AdminStatCard label="Best practices" variant="gradient">
          <ul className={`space-y-2 text-xs ${ADMIN_TEXT_MUTED}`}>
            <li>Use team names that match internal reporting.</li>
            <li>Optional fleets keep access flexible.</li>
          </ul>
        </AdminStatCard>
        <AdminStatCard
          label="Access flow"
          className="sm:col-span-2"
          description="Pair fleets with dashboards to scope what teams can see."
          descriptionTone="muted"
        />
      </div>

      <div className="grid gap-6">
        {/* Bulk Create Panel */}
        <AdminPanel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className={heading3}>Bulk create fleets</h3>
              <p className={`mt-1 ${textSecondary}`}>
                Enter one fleet name per line and assign them to a company.
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
            <div className="mt-4 grid gap-3">
              <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                Fleet names (one per line)
                <textarea
                  value={bulkNames}
                  onChange={(e) => setBulkNames(e.target.value)}
                  rows={5}
                  placeholder={'Operations Team\nLogistics Team\nSales Fleet'}
                  className={`${ADMIN_TEXTAREA} resize-y`}
                />
              </label>
              <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                Assign to company *
                <select
                  value={bulkCompanyId}
                  onChange={(e) => setBulkCompanyId(e.target.value)}
                  className={ADMIN_SELECT}
                >
                  <option value="">Select company</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleBulkCreate}
                  disabled={isPending || !bulkNames.trim() || !bulkCompanyId}
                  className={ADMIN_PRIMARY_BUTTON}
                >
                  {isPending ? 'Creating…' : 'Create all'}
                </button>
                {bulkStatus && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">{bulkStatus}</p>
                )}
              </div>
            </div>
          )}
        </AdminPanel>

        {/* Reassign Modal */}
        <AdminModal
          isOpen={isReassignOpen}
          onClose={() => setIsReassignOpen(false)}
          title="Reassign fleets"
          description={`Reassign ${selectedIds.size} selected fleet(s) to a different company.`}
        >
          <div className="grid gap-4">
            <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
              New company
              <select
                value={reassignCompanyId}
                onChange={(e) => setReassignCompanyId(e.target.value)}
                className={ADMIN_SELECT}
              >
                <option value="">Select company</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsReassignOpen(false)}
                className={ADMIN_SAVE_BUTTON}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkReassign}
                disabled={isPending || !reassignCompanyId}
                className={ADMIN_PRIMARY_BUTTON}
              >
                {isPending ? 'Reassigning…' : 'Reassign'}
              </button>
            </div>
          </div>
        </AdminModal>

        {/* Manage Panel */}
        <AdminPanel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className={heading3}>Manage fleets</h3>
              <p className={`mt-1 ${textSecondary}`}>
                Update fleet names and maintain access rules.
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
                    Reassign selected ({selectedIds.size})
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
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className={ADMIN_PRIMARY_BUTTON}
              >
                Create fleet
              </button>
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="max-h-[32rem] overflow-auto">
              <table className="min-w-full border-collapse text-left">
                <thead
                  className={`sticky top-0 z-10 ${tableHead} bg-zinc-50 dark:bg-zinc-800/50`}
                >
                  <tr>
                    <th className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="h-4 w-4 rounded border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
                      />
                    </th>
                    <th className={tableHeadCell}>Fleet</th>
                    <th className={tableHeadCell}>Company</th>
                    <th className={`${tableHeadCell} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {organizations.map((organization) => (
                    <OrganizationRow
                      key={organization.id}
                      organization={organization}
                      companies={companies}
                      action={manageOrganizationAction}
                      checked={selectedIds.has(organization.id)}
                      onCheck={handleCheck}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {organizations.length === 0 ? (
              <p className={`px-4 py-6 text-sm ${ADMIN_TEXT_SUBTLE}`}>
                No fleets yet. Create one to scope dashboard access.
              </p>
            ) : null}
          </div>
        </AdminPanel>
      </div>

      <AdminModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create fleet"
        description="Add a fleet to scope dashboards to teams or regions."
      >
        <form action={organizationCreateAction} className="grid gap-4">
          <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
            Fleet name *
            <input
              name="organizationName"
              placeholder="Operations Team"
              className={ADMIN_INPUT}
            />
          </label>
          <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
            Company (optional)
            <select name="companyId" className={ADMIN_SELECT}>
              <option value="">No company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={`text-xs ${ADMIN_TEXT_SUBTLE}`}>
              Fleets can be optional on dashboards.
            </p>
            <button type="submit" className={ADMIN_PRIMARY_BUTTON}>
              Create fleet
            </button>
          </div>
          <StatusMessage state={organizationCreateState} />
        </form>
      </AdminModal>
    </AdminSection>
  );
}

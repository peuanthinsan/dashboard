'use client';

import { useActionState, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import AdminModal from '../AdminModal';
import { INITIAL_STATE, StatusMessage, useRefreshOnSuccess } from '../admin-client-utils';
import ConfirmDeleteDialog from '../ConfirmDeleteDialog';
import { AdminPanel, AdminSection, AdminSectionHeader, AdminStatCard } from '../admin-components';
import {
  ADMIN_DELETE_BUTTON,
  ADMIN_HINT_TEXT,
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
  badgeInfo,
  badgeDefault,
  btnDanger,
  btnSmall,
  btnSecondary,
} from 'app/ui/design-tokens';
import type { ActionState, Company, Organization, User } from '../types';
import type {
  bulkCreateUsers,
  bulkAssignUsersToCompany,
  bulkAssignUsersToOrganization,
  bulkSetAdmin,
  bulkDeleteUsers,
} from 'app/db-bulk';

type FormAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>;
type BulkCreateFn = typeof bulkCreateUsers;
type BulkAssignCompanyFn = typeof bulkAssignUsersToCompany;
type BulkAssignOrgFn = typeof bulkAssignUsersToOrganization;
type BulkSetAdminFn = typeof bulkSetAdmin;
type BulkDeleteFn = typeof bulkDeleteUsers;

const USERS_PAGE_SIZE = 25;

type UsersClientProps = {
  users: User[];
  companies: Company[];
  organizations: Organization[];
  adminCopy?: { showBothCompanyAndFleet: string; showBothCompanyAndFleetHint: string };
  addUserAction: FormAction;
  manageUserAction: FormAction;
  bulkCreateAction: BulkCreateFn;
  bulkAssignCompanyAction: BulkAssignCompanyFn;
  bulkAssignOrgAction: BulkAssignOrgFn;
  bulkSetAdminAction: BulkSetAdminFn;
  bulkDeleteAction: BulkDeleteFn;
};

function formatList(names: string[]) {
  if (names.length === 0) {
    return { label: '—', title: 'None assigned' };
  }
  if (names.length <= 2) {
    return { label: names.join(', '), title: names.join(', ') };
  }
  return {
    label: `${names.slice(0, 2).join(', ')} +${names.length - 2} more`,
    title: names.join(', '),
  };
}

function UserRow({
  user,
  companyNames,
  organizationNames,
  companies,
  organizations,
  action,
  checked,
  onCheck,
  showBothCopy,
}: {
  user: User;
  companyNames: string[];
  organizationNames: string[];
  companies: Company[];
  organizations: Organization[];
  action: FormAction;
  checked: boolean;
  onCheck: (id: number, checked: boolean) => void;
  showBothCopy?: { showBothCompanyAndFleet: string; showBothCompanyAndFleetHint: string };
}) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);
  const [isOpen, setIsOpen] = useState(false);
  useRefreshOnSuccess(state);

  useEffect(() => {
    if (state.status === 'success') {
      setIsOpen(false);
    }
  }, [state.status]);

  const companyDisplay = formatList(companyNames);
  const organizationDisplay = formatList(organizationNames);

  return (
    <>
      <tr className={tableRow}>
        <td className="w-0 whitespace-nowrap pl-4 pr-3 py-3">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onCheck(user.id, e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
          />
        </td>
        <td className={`${tableCell} pl-3`}>
          <div className="font-semibold text-zinc-900 dark:text-white">
            {user.email ?? 'Unknown email'}
          </div>
          <div className="mt-0.5 text-xs text-zinc-400">ID {user.id}</div>
        </td>
        <td className={tableCell}>
          <span className={user.isAdmin ? badgeInfo : badgeDefault}>
            {user.isAdmin ? 'Admin' : 'Standard'}
          </span>
        </td>
        <td className={tableCell}>
          <span className="block text-sm" title={companyDisplay.title}>
            {companyDisplay.label}
          </span>
        </td>
        <td className={tableCell}>
          <span className="block text-sm" title={organizationDisplay.title}>
            {organizationDisplay.label}
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
        title="Edit user"
        description="Update profile details, reset passwords, and manage access."
      >
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="userId" value={user.id} />
          <div className="grid gap-4 md:grid-cols-2">
            <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
              Email
              <input
                name="userEmail"
                defaultValue={user.email ?? ''}
                className={ADMIN_INPUT}
              />
            </label>
            <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
              Reset password
              <input
                type="password"
                name="userPassword"
                placeholder="Leave blank to keep"
                className={ADMIN_INPUT}
              />
            </label>
          </div>
          <label className={`flex items-center gap-2 ${ADMIN_LABEL}`}>
            <input
              type="checkbox"
              name="isAdmin"
              defaultChecked={!!user.isAdmin}
              className="h-4 w-4 rounded border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
            />
            Admin access
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
              Companies
              <select
                name="companyIds"
                multiple
                defaultValue={(user.companyIds ?? []).map(String)}
                className={`min-h-[10rem] ${ADMIN_SELECT}`}
              >
                {companies.length === 0 ? (
                  <option disabled>No companies available</option>
                ) : null}
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
              <span className={ADMIN_HINT_TEXT}>
                Hold Ctrl (Windows) or Command (Mac) to select multiple.
              </span>
            </label>
            <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
              Fleets
              <select
                name="organizationIds"
                multiple
                defaultValue={(user.organizationIds ?? []).map(String)}
                className={`min-h-[10rem] ${ADMIN_SELECT}`}
              >
                {organizations.length === 0 ? (
                  <option disabled>No fleets available</option>
                ) : null}
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
              <span className={ADMIN_HINT_TEXT}>
                Leave empty to allow only company-level dashboards.
              </span>
            </label>
          </div>
          <label className={`flex items-start gap-3 ${ADMIN_LABEL}`}>
            <input
              type="checkbox"
              name="showBothCompanyAndFleet"
              defaultChecked={!!user.showBothCompanyAndFleet}
              className="mt-1 h-4 w-4 rounded border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
            />
            <div>
              <span className="font-medium">
                {showBothCopy?.showBothCompanyAndFleet ?? 'Include company-wide dashboards with fleet dashboards'}
              </span>
              <p className={`mt-0.5 text-sm ${ADMIN_HINT_TEXT}`}>
                {showBothCopy?.showBothCompanyAndFleetHint ??
                  'When checked, user sees both company-wide and fleet-specific dashboards. When unchecked, user sees only fleet dashboards (if fleets assigned) or only company-wide (if no fleets).'}
              </p>
            </div>
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <StatusMessage state={state} />
            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" name="intent" value="save" className={ADMIN_SAVE_BUTTON}>
                Save changes
              </button>
              <ConfirmDeleteDialog
                title="Delete user"
                description="This will permanently delete the user account."
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

export default function UsersClient({
  users,
  companies,
  organizations,
  adminCopy,
  addUserAction,
  manageUserAction,
  bulkCreateAction,
  bulkAssignCompanyAction,
  bulkAssignOrgAction,
  bulkSetAdminAction,
  bulkDeleteAction,
}: UsersClientProps) {
  const router = useRouter();

  // Client-side search and pagination
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const companyMap = useMemo(
    () => new Map(companies.map((company) => [company.id, company.name ?? 'Unnamed company'])),
    [companies],
  );
  const organizationMap = useMemo(
    () =>
      new Map(
        organizations.map((organization) => [
          organization.id,
          organization.name ?? 'Unnamed fleet',
        ]),
      ),
    [organizations],
  );

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => (u.email ?? '').toLowerCase().includes(q));
  }, [users, search]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedUsers = useMemo(
    () => filteredUsers.slice((currentPage - 1) * USERS_PAGE_SIZE, currentPage * USERS_PAGE_SIZE),
    [filteredUsers, currentPage],
  );

  useEffect(() => {
    setPage(1);
  }, [search]);

  const adminCount = users.filter((user) => user.isAdmin).length;
  const [userCreateState, userCreateAction] = useActionState(addUserAction, INITIAL_STATE);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  useRefreshOnSuccess(userCreateState);

  useEffect(() => {
    if (userCreateState.status === 'success') {
      setIsCreateOpen(false);
    }
  }, [userCreateState.status]);

  // Bulk state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkEmails, setBulkEmails] = useState('');
  const [bulkPassword, setBulkPassword] = useState('');
  const [isBulkCreateOpen, setIsBulkCreateOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');
  const [isAssignCompanyOpen, setIsAssignCompanyOpen] = useState(false);
  const [isAssignOrgOpen, setIsAssignOrgOpen] = useState(false);
  const [assignCompanyId, setAssignCompanyId] = useState('');
  const [assignOrgId, setAssignOrgId] = useState('');
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
      setSelectedIds(new Set(paginatedUsers.map((u) => u.id)));
    } else {
      setSelectedIds(new Set());
    }
  }

  function handleBulkCreate() {
    const emails = bulkEmails.split('\n').map((e) => e.trim()).filter(Boolean);
    if (emails.length === 0 || !bulkPassword) return;
    startTransition(async () => {
      const result = await bulkCreateAction(emails, bulkPassword);
      setBulkStatus(`Created ${result.created}, skipped ${result.skipped} duplicates.`);
      setBulkEmails('');
      setBulkPassword('');
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

  function handleBulkSetAdmin(isAdmin: boolean) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    startTransition(async () => {
      await bulkSetAdminAction(ids, isAdmin);
      router.refresh();
    });
  }

  function handleAssignCompany() {
    const ids = Array.from(selectedIds);
    const cId = parseInt(assignCompanyId, 10);
    if (ids.length === 0 || !cId) return;
    startTransition(async () => {
      await bulkAssignCompanyAction(ids, cId);
      setIsAssignCompanyOpen(false);
      router.refresh();
    });
  }

  function handleAssignOrg() {
    const ids = Array.from(selectedIds);
    const oId = parseInt(assignOrgId, 10);
    if (ids.length === 0 || !oId) return;
    startTransition(async () => {
      await bulkAssignOrgAction(ids, oId);
      setIsAssignOrgOpen(false);
      router.refresh();
    });
  }

  const allChecked = paginatedUsers.length > 0 && selectedIds.size === paginatedUsers.length;

  return (
    <AdminSection>
      <AdminSectionHeader
        eyebrow="User access"
        title="Users"
        description="Invite users, assign access, and keep permissions up to date."
        count={users.length}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="Total users"
          value={users.length}
          description="Active accounts with access."
        />
        <AdminStatCard label="Admins" value={adminCount} description="Accounts with admin privileges." />
        <AdminStatCard label="Onboarding tips" variant="gradient" className="sm:col-span-2">
          <ul className={`space-y-2 text-xs ${ADMIN_TEXT_MUTED}`}>
            <li>Create a temporary password and share it securely.</li>
            <li>Assign companies and fleets to limit scope.</li>
          </ul>
        </AdminStatCard>
      </div>

      {/* Assign modals */}
      <AdminModal
        isOpen={isAssignCompanyOpen}
        onClose={() => setIsAssignCompanyOpen(false)}
        title="Assign to company"
        description={`Add ${selectedIds.size} user(s) to a company.`}
      >
        <div className="grid gap-4">
          <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
            Company
            <select
              value={assignCompanyId}
              onChange={(e) => setAssignCompanyId(e.target.value)}
              className={ADMIN_SELECT}
            >
              <option value="">Select company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsAssignCompanyOpen(false)} className={ADMIN_SAVE_BUTTON}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAssignCompany}
              disabled={isPending || !assignCompanyId}
              className={ADMIN_PRIMARY_BUTTON}
            >
              {isPending ? 'Assigning…' : 'Assign'}
            </button>
          </div>
        </div>
      </AdminModal>

      <AdminModal
        isOpen={isAssignOrgOpen}
        onClose={() => setIsAssignOrgOpen(false)}
        title="Assign to fleet"
        description={`Add ${selectedIds.size} user(s) to a fleet.`}
      >
        <div className="grid gap-4">
          <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
            Fleet
            <select
              value={assignOrgId}
              onChange={(e) => setAssignOrgId(e.target.value)}
              className={ADMIN_SELECT}
            >
              <option value="">Select fleet</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsAssignOrgOpen(false)} className={ADMIN_SAVE_BUTTON}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAssignOrg}
              disabled={isPending || !assignOrgId}
              className={ADMIN_PRIMARY_BUTTON}
            >
              {isPending ? 'Assigning…' : 'Assign'}
            </button>
          </div>
        </div>
      </AdminModal>

      <div className="grid gap-6">
        {/* Bulk Create Panel */}
        <AdminPanel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className={heading3}>Bulk create users</h3>
              <p className={`mt-1 ${textSecondary}`}>
                Enter one email per line — all will share the same temporary password.
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
                Emails (one per line)
                <textarea
                  value={bulkEmails}
                  onChange={(e) => setBulkEmails(e.target.value)}
                  rows={5}
                  placeholder={'alice@acme.com\nbob@acme.com\ncharlie@acme.com'}
                  className={`${ADMIN_TEXTAREA} resize-y`}
                />
              </label>
              <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                Shared temporary password *
                <input
                  type="password"
                  value={bulkPassword}
                  onChange={(e) => setBulkPassword(e.target.value)}
                  placeholder="Temp password for all new accounts"
                  className={ADMIN_INPUT}
                />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleBulkCreate}
                  disabled={isPending || !bulkEmails.trim() || !bulkPassword}
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

        {/* Manage Panel */}
        <AdminPanel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className={heading3}>Manage users</h3>
              <p className={`mt-1 ${textSecondary}`}>
                View and update large user lists with quick edits.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by email…"
                className={`min-w-[12rem] ${ADMIN_INPUT}`}
                aria-label="Search users"
              />
              {selectedIds.size > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsAssignCompanyOpen(true)}
                    disabled={isPending}
                    className={`${btnSecondary} ${btnSmall}`}
                  >
                    Assign to company
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAssignOrgOpen(true)}
                    disabled={isPending}
                    className={`${btnSecondary} ${btnSmall}`}
                  >
                    Assign to fleet
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkSetAdmin(true)}
                    disabled={isPending}
                    className={`${btnSecondary} ${btnSmall}`}
                  >
                    Make admin
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkSetAdmin(false)}
                    disabled={isPending}
                    className={`${btnSecondary} ${btnSmall}`}
                  >
                    Remove admin
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
                Create user
              </button>
            </div>
          </div>
          {totalPages > 1 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Showing {paginatedUsers.length} of {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
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
                    <th className={`${tableHeadCell} pl-3`}>User</th>
                    <th className={tableHeadCell}>Role</th>
                    <th className={tableHeadCell}>Companies</th>
                    <th className={tableHeadCell}>Fleets</th>
                    <th className={tableHeadCell}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map((user) => {
                    const companyNames = (user.companyIds ?? [])
                      .map((id) => companyMap.get(id))
                      .filter(Boolean) as string[];
                    const organizationNames = (user.organizationIds ?? [])
                      .map((id) => organizationMap.get(id))
                      .filter(Boolean) as string[];

                    return (
                      <UserRow
                        key={user.id}
                        user={user}
                        companyNames={companyNames}
                        organizationNames={organizationNames}
                        companies={companies}
                        organizations={organizations}
                        action={manageUserAction}
                        checked={selectedIds.has(user.id)}
                        onCheck={handleCheck}
                        showBothCopy={adminCopy}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
            {paginatedUsers.length === 0 ? (
              <p className={`px-4 py-6 text-sm ${ADMIN_TEXT_SUBTLE}`}>
                {users.length === 0
                  ? 'No users yet. Create the first account to get started.'
                  : 'No users match your search.'}
              </p>
            ) : null}
          </div>
        </AdminPanel>
      </div>

      <AdminModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create user"
        description="Set up a new account and assign an initial role."
      >
        <form
          action={userCreateAction}
          className="grid gap-4"
        >
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                Email *
                <input
                  name="userEmail"
                  placeholder="user@acme.com"
                  className={ADMIN_INPUT}
                />
              </label>
              <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                Temporary password *
                <input
                  type="password"
                  name="userPassword"
                  placeholder="Create a password"
                  className={ADMIN_INPUT}
                />
              </label>
            </div>
            <label className={`flex items-center gap-2 ${ADMIN_LABEL}`}>
              <input
                type="checkbox"
                name="isAdmin"
                className="h-4 w-4 rounded border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
              />
              Admin access
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={`text-xs ${ADMIN_TEXT_SUBTLE}`}>
              Provide a temporary password for first login.
            </p>
            <button type="submit" className={ADMIN_PRIMARY_BUTTON}>
              Create user
            </button>
          </div>
          <StatusMessage state={userCreateState} />
        </form>
      </AdminModal>
    </AdminSection>
  );
}

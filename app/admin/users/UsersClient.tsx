'use client';

import { useMemo, useState } from 'react';
import { useFormState } from 'react-dom';
import { INITIAL_STATE, StatusMessage, useRefreshOnSuccess } from '../admin-client-utils';
import ConfirmDeleteDialog from '../ConfirmDeleteDialog';
import { AdminPanel, AdminSection, AdminSectionHeader, AdminStatCard } from '../admin-components';
import {
  ADMIN_DELETE_BUTTON,
  ADMIN_FORM_PANEL,
  ADMIN_HINT_TEXT,
  ADMIN_INPUT,
  ADMIN_LABEL,
  ADMIN_PRIMARY_BUTTON,
  ADMIN_SAVE_BUTTON,
  ADMIN_SELECT,
  ADMIN_TEXT_MUTED,
  ADMIN_TEXT_SUBTLE,
} from '../admin-ui';
import type { ActionState, Company, Organization, User } from '../types';

type FormAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>;

type UsersClientProps = {
  users: User[];
  companies: Company[];
  organizations: Organization[];
  addUserAction: FormAction;
  manageUserAction: FormAction;
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
        aria-labelledby="user-modal-title"
        className="relative w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-950"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="user-modal-title"
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

export default function UsersClient({
  users,
  companies,
  organizations,
  addUserAction,
  manageUserAction,
}: UsersClientProps) {
  const adminCount = users.filter((user) => user.isAdmin).length;
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [userCreateState, userCreateAction] = useFormState(addUserAction, INITIAL_STATE);
  useRefreshOnSuccess(userCreateState);
  const [userManageState, userManageAction] = useFormState(manageUserAction, INITIAL_STATE);
  useRefreshOnSuccess(userManageState);

  const companyNameMap = useMemo(
    () => new Map(companies.map((company) => [company.id, company.name])),
    [companies],
  );
  const organizationNameMap = useMemo(
    () => new Map(organizations.map((organization) => [organization.id, organization.name])),
    [organizations],
  );

  const filteredUsers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) {
      return users;
    }
    return users.filter((user) => {
      const emailMatch = (user.email ?? '').toLowerCase().includes(normalized);
      const companyMatch = (user.companyIds ?? []).some((id) =>
        companyNameMap.get(id)?.toLowerCase().includes(normalized),
      );
      const orgMatch = (user.organizationIds ?? []).some((id) =>
        organizationNameMap.get(id)?.toLowerCase().includes(normalized),
      );
      return emailMatch || companyMatch || orgMatch;
    });
  }, [users, search, companyNameMap, organizationNameMap]);

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
            <li>Assign companies and organizations to limit scope.</li>
            <li>Use search + edit modals to quickly update large lists.</li>
          </ul>
        </AdminStatCard>
      </div>

      <div className="grid gap-6">
        <form
          action={userCreateAction}
          className={`${ADMIN_FORM_PANEL} grid gap-4`}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Create user</h3>
            <span className={ADMIN_LABEL}>Required *</span>
          </div>
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
                className="h-4 w-4 rounded border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
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

        <AdminPanel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Manage users</h3>
              <p className={`mt-1 text-sm ${ADMIN_TEXT_SUBTLE}`}>
                Update profiles, assign companies, and manage access without scrolling.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xs ${ADMIN_TEXT_SUBTLE}`}>{filteredUsers.length} results</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by email, company, org"
                className={`${ADMIN_INPUT} h-9 w-full min-w-[220px] sm:w-64`}
              />
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/70 dark:border-slate-800/70">
            <div className="max-h-[540px] overflow-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-widest text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Companies</th>
                    <th className="px-4 py-3 font-semibold">Organizations</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                  {filteredUsers.map((user) => {
                    const companyNames = (user.companyIds ?? [])
                      .map((id) => companyNameMap.get(id))
                      .filter(Boolean);
                    const organizationNames = (user.organizationIds ?? [])
                      .map((id) => organizationNameMap.get(id))
                      .filter(Boolean);
                    return (
                      <tr key={user.id} className="bg-white/80 hover:bg-slate-50 dark:bg-slate-950/40 dark:hover:bg-slate-900/60">
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                          {user.email ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {user.isAdmin ? 'Admin' : 'User'}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {companyNames.length > 0 ? companyNames.join(', ') : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {organizationNames.length > 0 ? organizationNames.join(', ') : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedUser(user)}
                            className={ADMIN_SAVE_BUTTON}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                        No users found. Adjust your search to see results.
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
        isOpen={!!selectedUser}
        title={selectedUser ? `Edit user: ${selectedUser.email ?? 'User'}` : 'Edit user'}
        description="Update user details, reset passwords, and adjust access."
        onClose={() => setSelectedUser(null)}
      >
        {selectedUser ? (
          <form action={userManageAction} className="grid gap-4">
            <input type="hidden" name="userId" value={selectedUser.id} />
            <div className="grid gap-4 md:grid-cols-2">
              <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                Email
                <input
                  name="userEmail"
                  defaultValue={selectedUser.email ?? ''}
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
                defaultChecked={!!selectedUser.isAdmin}
                className="h-4 w-4 rounded border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
              />
              Admin access
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                Companies
                <select
                  name="companyIds"
                  multiple
                  defaultValue={(selectedUser.companyIds ?? []).map(String)}
                  className={`min-h-[7rem] ${ADMIN_SELECT}`}
                >
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
                Organizations
                <select
                  name="organizationIds"
                  multiple
                  defaultValue={(selectedUser.organizationIds ?? []).map(String)}
                  className={`min-h-[7rem] ${ADMIN_SELECT}`}
                >
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <StatusMessage state={userManageState} />
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
        ) : null}
      </Modal>
    </AdminSection>
  );
}

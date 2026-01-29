'use client';

import { useEffect, useMemo, useState } from 'react';
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
  ADMIN_PILL,
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

export default function UsersClient({
  users,
  companies,
  organizations,
  addUserAction,
  manageUserAction,
}: UsersClientProps) {
  const adminCount = users.filter((user) => user.isAdmin).length;
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const companyLookup = useMemo(
    () => new Map(companies.map((company) => [String(company.id), company.name])),
    [companies],
  );
  const organizationLookup = useMemo(
    () => new Map(organizations.map((org) => [String(org.id), org.name])),
    [organizations],
  );
  const selectedUser = users.find((user) => String(user.id) === selectedUserId) ?? null;

  const [editState, editAction] = useFormState(manageUserAction, INITIAL_STATE);
  useRefreshOnSuccess(editState);
  useEffect(() => {
    if (editState.status === 'success') {
      setSelectedUserId(null);
    }
  }, [editState.status]);

  const [userCreateState, userCreateAction] = useFormState(addUserAction, INITIAL_STATE);
  useRefreshOnSuccess(userCreateState);

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
                Update profiles, assign companies, and manage access.
              </p>
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/95 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/60">
            <div className="overflow-x-auto">
              <table className="min-w-[720px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Admin</th>
                    <th className="px-4 py-3 font-semibold">Companies</th>
                    <th className="px-4 py-3 font-semibold">Organizations</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const companyNames = (user.companyIds ?? [])
                      .map((id) => companyLookup.get(String(id)))
                      .filter((name): name is string => Boolean(name));
                    const organizationNames = (user.organizationIds ?? [])
                      .map((id) => organizationLookup.get(String(id)))
                      .filter((name): name is string => Boolean(name));

                    return (
                      <tr
                        key={user.id}
                        className="border-t border-slate-200/70 text-slate-700 hover:bg-slate-50/80 dark:border-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-900/40"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900 dark:text-white">
                            {user.email ?? 'Unknown'}
                          </div>
                          <div className={`text-xs ${ADMIN_TEXT_SUBTLE}`}>ID: {user.id}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`${ADMIN_PILL} ${user.isAdmin ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>
                            {user.isAdmin ? 'Admin' : 'Member'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm">
                            {formatEntityList(companyNames)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm">
                            {formatEntityList(organizationNames)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedUserId(String(user.id))}
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
            {users.length === 0 ? (
              <p className={`px-4 py-6 text-sm ${ADMIN_TEXT_SUBTLE}`}>
                No users yet. Create one to grant access.
              </p>
            ) : null}
          </div>
        </AdminPanel>
      </div>
      {selectedUser ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4 py-6">
          <button
            type="button"
            aria-hidden="true"
            className="absolute inset-0 bg-slate-900/20 dark:bg-slate-950/80"
            onClick={() => setSelectedUserId(null)}
          />
          <div className="relative w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Edit user</h3>
                <p className={`text-sm ${ADMIN_TEXT_SUBTLE}`}>
                  Update user profile details, admin access, and assignments.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserId(null)}
                className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-600 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-300"
              >
                Close
              </button>
            </div>
            <form
              key={selectedUser.id}
              action={editAction}
              className="mt-4 grid gap-4"
            >
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
                    className={`min-h-[8rem] ${ADMIN_SELECT}`}
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
                    className={`min-h-[8rem] ${ADMIN_SELECT}`}
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
                <StatusMessage state={editState} />
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
          </div>
        </div>
      ) : null}
    </AdminSection>
  );
}

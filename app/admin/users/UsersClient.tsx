'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFormState } from 'react-dom';
import { INITIAL_STATE, StatusMessage, useRefreshOnSuccess } from '../admin-client-utils';
import AdminModal from '../AdminModal';
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

const SUMMARY_LIMIT = 2;

function summarizeList(items: string[], emptyLabel = 'None') {
  if (items.length === 0) {
    return emptyLabel;
  }

  const visible = items.slice(0, SUMMARY_LIMIT);
  const remaining = items.length - visible.length;
  return remaining > 0 ? `${visible.join(', ')} +${remaining}` : visible.join(', ');
}

function UserRow({
  user,
  companies,
  organizations,
  companyNameById,
  organizationNameById,
  action,
}: {
  user: User;
  companies: Company[];
  organizations: Organization[];
  companyNameById: Map<number, string>;
  organizationNameById: Map<number, string>;
  action: FormAction;
}) {
  const [state, formAction] = useFormState(action, INITIAL_STATE);
  const [isOpen, setIsOpen] = useState(false);
  useRefreshOnSuccess(state);
  useEffect(() => {
    if (state.status === 'success') {
      setIsOpen(false);
    }
  }, [state.status]);

  const companySummary = summarizeList(
    (user.companyIds ?? [])
      .map((companyId) => companyNameById.get(companyId))
      .filter((name): name is string => !!name),
    'No companies',
  );
  const organizationSummary = summarizeList(
    (user.organizationIds ?? [])
      .map((organizationId) => organizationNameById.get(organizationId))
      .filter((name): name is string => !!name),
    'No organizations',
  );

  return (
    <>
      <tr className="border-b border-slate-200/70 text-sm text-slate-600 dark:border-slate-800/70 dark:text-slate-200">
        <td className="py-3 pr-4">
          <div className="font-semibold text-slate-900 dark:text-white">{user.email ?? 'Unknown'}</div>
          <div className="text-xs text-slate-400">ID: {user.id}</div>
        </td>
        <td className="py-3 pr-4">
          {user.isAdmin ? <span className={ADMIN_PILL}>Admin</span> : 'Standard'}
        </td>
        <td className="py-3 pr-4">
          <span className="text-slate-600 dark:text-slate-300" title={companySummary}>
            {companySummary}
          </span>
        </td>
        <td className="py-3 pr-4">
          <span className="text-slate-600 dark:text-slate-300" title={organizationSummary}>
            {organizationSummary}
          </span>
        </td>
        <td className="py-3 text-right">
          <button type="button" className={ADMIN_SAVE_BUTTON} onClick={() => setIsOpen(true)}>
            Edit
          </button>
        </td>
      </tr>
      <AdminModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Edit user access"
        description="Update user details, reset passwords, and assign access."
        size="lg"
      >
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="userId" value={user.id} />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2 text-sm">
              <label className={ADMIN_LABEL}>Email</label>
              <input
                name="userEmail"
                defaultValue={user.email ?? ''}
                className={ADMIN_INPUT}
              />
              <label className={ADMIN_LABEL}>Reset password</label>
              <input
                type="password"
                name="userPassword"
                placeholder="Leave blank to keep"
                className={ADMIN_INPUT}
              />
              <label className={`flex items-center gap-2 ${ADMIN_LABEL}`}>
                <input
                  type="checkbox"
                  name="isAdmin"
                  defaultChecked={!!user.isAdmin}
                  className="h-4 w-4 rounded border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
                />
                Admin access
              </label>
            </div>
            <div className="grid gap-4">
              <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                Companies
                <select
                  name="companyIds"
                  multiple
                  defaultValue={(user.companyIds ?? []).map(String)}
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
                  defaultValue={(user.organizationIds ?? []).map(String)}
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
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
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
            <button type="button" className={ADMIN_SAVE_BUTTON} onClick={() => setIsOpen(false)}>
              Cancel
            </button>
          </div>
          <StatusMessage state={state} />
        </form>
      </AdminModal>
    </>
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
  const companyNameById = useMemo(
    () => new Map(companies.map((company) => [company.id, company.name])),
    [companies],
  );
  const organizationNameById = useMemo(
    () => new Map(organizations.map((organization) => [organization.id, organization.name])),
    [organizations],
  );

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
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="py-2 pr-4 font-semibold">User</th>
                  <th className="py-2 pr-4 font-semibold">Role</th>
                  <th className="py-2 pr-4 font-semibold">Companies</th>
                  <th className="py-2 pr-4 font-semibold">Organizations</th>
                  <th className="py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td className="py-4 text-sm text-slate-500" colSpan={5}>
                      No users yet. Create one to grant access.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      companies={companies}
                      organizations={organizations}
                      companyNameById={companyNameById}
                      organizationNameById={organizationNameById}
                      action={manageUserAction}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </AdminPanel>
      </div>
    </AdminSection>
  );
}

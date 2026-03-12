'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFormState } from 'react-dom';
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
} from 'app/ui/design-tokens';
import type { ActionState, Company, Organization, User } from '../types';

type FormAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>;

type UsersClientProps = {
  users: User[];
  companies: Company[];
  organizations: Organization[];
  addUserAction: FormAction;
  manageUserAction: FormAction;
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
}: {
  user: User;
  companyNames: string[];
  organizationNames: string[];
  companies: Company[];
  organizations: Organization[];
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

  const companyDisplay = formatList(companyNames);
  const organizationDisplay = formatList(organizationNames);

  return (
    <>
      <tr className={tableRow}>
        <td className={tableCell}>
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
  addUserAction,
  manageUserAction,
}: UsersClientProps) {
  const adminCount = users.filter((user) => user.isAdmin).length;
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

  const [userCreateState, userCreateAction] = useFormState(addUserAction, INITIAL_STATE);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  useRefreshOnSuccess(userCreateState);

  useEffect(() => {
    if (userCreateState.status === 'success') {
      setIsCreateOpen(false);
    }
  }, [userCreateState.status]);

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

      <div className="grid gap-6">
        <AdminPanel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className={heading3}>Manage users</h3>
              <p className={`mt-1 ${textSecondary}`}>
                View and update large user lists with quick edits.
              </p>
            </div>
            <button type="button" onClick={() => setIsCreateOpen(true)} className={ADMIN_PRIMARY_BUTTON}>
              Create user
            </button>
          </div>
          <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="max-h-[32rem] overflow-auto">
              <table className="min-w-full border-collapse text-left">
                <thead className={`sticky top-0 z-10 ${tableHead} bg-zinc-50 dark:bg-zinc-800/50`}>
                  <tr>
                    <th className={tableHeadCell}>User</th>
                    <th className={tableHeadCell}>Role</th>
                    <th className={tableHeadCell}>Companies</th>
                    <th className={tableHeadCell}>Fleets</th>
                    <th className={tableHeadCell}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
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
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
            {users.length === 0 ? (
              <p className={`px-4 py-6 text-sm ${ADMIN_TEXT_SUBTLE}`}>
                No users yet. Create the first account to get started.
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

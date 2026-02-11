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
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>((user.companyIds ?? []).map(String));
  const filteredOrganizations = useMemo(() => {
    if (selectedCompanyIds.length === 0) return [];
    const companyIdSet = new Set(selectedCompanyIds.map(Number));
    return organizations.filter((organization) =>
      !!organization.companyId && companyIdSet.has(organization.companyId),
    );
  }, [organizations, selectedCompanyIds]);
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
      <tr className="border-b border-slate-200/70 text-sm text-slate-700 last:border-b-0 dark:border-slate-800/70 dark:text-slate-200">
        <td className="px-4 py-3">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">
            {user.email ?? 'Unknown email'}
          </div>
          <div className="mt-1 text-xs text-slate-500">ID {user.id}</div>
        </td>
        <td className="px-4 py-3">
          <span className={`${ADMIN_PILL} ${user.isAdmin ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
            {user.isAdmin ? 'Admin' : 'Standard'}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className="block text-sm" title={companyDisplay.title}>
            {companyDisplay.label}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className="block text-sm" title={organizationDisplay.title}>
            {organizationDisplay.label}
          </span>
        </td>
        <td className="px-4 py-3">
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
                value={selectedCompanyIds}
                onChange={(event) => setSelectedCompanyIds(Array.from(event.currentTarget.selectedOptions).map((option) => option.value))}
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
                {filteredOrganizations.map((organization) => (
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
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Manage users</h3>
              <p className={`mt-1 text-sm ${ADMIN_TEXT_SUBTLE}`}>
                View and update large user lists with quick edits.
              </p>
            </div>
            <button type="button" onClick={() => setIsCreateOpen(true)} className={ADMIN_PRIMARY_BUTTON}>
              Create user
            </button>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/60">
            <div className="max-h-[32rem] overflow-auto">
              <table className="min-w-full border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Companies</th>
                    <th className="px-4 py-3 font-semibold">Fleets</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
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
      </AdminModal>
    </AdminSection>
  );
}

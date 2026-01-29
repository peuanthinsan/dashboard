'use client';

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

function UserRow({
  user,
  companies,
  organizations,
  action,
}: {
  user: User;
  companies: Company[];
  organizations: Organization[];
  action: FormAction;
}) {
  const [state, formAction] = useFormState(action, INITIAL_STATE);
  useRefreshOnSuccess(state);
  const formId = `user-${user.id}`;

  return (
    <>
      <tr className="align-top">
        <td className="px-4 py-3">
          <form id={formId} action={formAction} />
          <input type="hidden" name="userId" value={user.id} form={formId} />
          <div className="grid gap-2">
            <input
              name="userEmail"
              aria-label="Email"
              defaultValue={user.email ?? ''}
              form={formId}
              className={ADMIN_INPUT}
            />
            <input
              type="password"
              name="userPassword"
              aria-label="Reset password"
              placeholder="Leave blank to keep"
              form={formId}
              className={ADMIN_INPUT}
            />
          </div>
        </td>
        <td className="px-4 py-3">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              name="isAdmin"
              defaultChecked={!!user.isAdmin}
              form={formId}
              className="h-4 w-4 rounded border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
            />
            Admin access
          </label>
        </td>
        <td className="px-4 py-3">
          <select
            name="companyIds"
            multiple
            aria-label="Companies"
            defaultValue={(user.companyIds ?? []).map(String)}
            form={formId}
            className={`min-h-[6rem] ${ADMIN_SELECT}`}
          >
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
          <p className={`mt-2 text-xs ${ADMIN_TEXT_MUTED}`}>
            Hold Ctrl (Windows) or Command (Mac) to select multiple.
          </p>
        </td>
        <td className="px-4 py-3">
          <select
            name="organizationIds"
            multiple
            aria-label="Organizations"
            defaultValue={(user.organizationIds ?? []).map(String)}
            form={formId}
            className={`min-h-[6rem] ${ADMIN_SELECT}`}
          >
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
          <p className={`mt-2 text-xs ${ADMIN_TEXT_MUTED}`}>
            Leave empty to allow only company-level dashboards.
          </p>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              name="intent"
              value="save"
              form={formId}
              className={ADMIN_SAVE_BUTTON}
            >
              Save
            </button>
            <ConfirmDeleteDialog
              title="Delete user"
              description="This will permanently delete the user account."
              triggerClassName={ADMIN_DELETE_BUTTON}
              confirmClassName={ADMIN_DELETE_BUTTON}
              formId={formId}
            />
          </div>
        </td>
      </tr>
      {state.status !== 'idle' ? (
        <tr>
          <td colSpan={5} className="px-4 pb-4">
            <StatusMessage state={state} />
          </td>
        </tr>
      ) : null}
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
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200/70 dark:border-slate-800/70">
            <div className="max-h-[520px] overflow-auto">
              <table className="min-w-[980px] w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left">
                      User
                    </th>
                    <th scope="col" className="px-4 py-3 text-left">
                      Access
                    </th>
                    <th scope="col" className="px-4 py-3 text-left">
                      Companies
                    </th>
                    <th scope="col" className="px-4 py-3 text-left">
                      Organizations
                    </th>
                    <th scope="col" className="px-4 py-3 text-left">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 bg-white dark:divide-slate-800/70 dark:bg-slate-950/40">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={`px-4 py-6 text-sm ${ADMIN_TEXT_SUBTLE}`}>
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
                        action={manageUserAction}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </AdminPanel>
      </div>
    </AdminSection>
  );
}

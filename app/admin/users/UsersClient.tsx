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
      <tr className="border-b border-slate-200/70 align-top text-sm last:border-b-0 dark:border-slate-800/70">
        <td className="p-3">
          <div className="flex flex-col gap-2">
            <label className={ADMIN_LABEL}>Email</label>
            <input
              name="userEmail"
              defaultValue={user.email ?? ''}
              className={ADMIN_INPUT}
              form={formId}
            />
            <label className={ADMIN_LABEL}>Reset password</label>
            <input
              type="password"
              name="userPassword"
              placeholder="Leave blank to keep"
              className={ADMIN_INPUT}
              form={formId}
            />
            <label className={`flex items-center gap-2 ${ADMIN_LABEL}`}>
              <input
                type="checkbox"
                name="isAdmin"
                defaultChecked={!!user.isAdmin}
                className="h-4 w-4 rounded border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
                form={formId}
              />
              Admin access
            </label>
          </div>
        </td>
        <td className="p-3">
          <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
            Companies
            <select
              name="companyIds"
              multiple
              defaultValue={(user.companyIds ?? []).map(String)}
              className={`min-h-[6rem] ${ADMIN_SELECT}`}
              form={formId}
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
        </td>
        <td className="p-3">
          <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
            Organizations
            <select
              name="organizationIds"
              multiple
              defaultValue={(user.organizationIds ?? []).map(String)}
              className={`min-h-[6rem] ${ADMIN_SELECT}`}
              form={formId}
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
        </td>
        <td className="p-3">
          <form id={formId} action={formAction} className="flex flex-col gap-2">
            <input type="hidden" name="userId" value={user.id} />
            <button type="submit" name="intent" value="save" className={ADMIN_SAVE_BUTTON}>
              Save
            </button>
            <ConfirmDeleteDialog
              title="Delete user"
              description="This will permanently delete the user account."
              triggerClassName={ADMIN_DELETE_BUTTON}
              confirmClassName={ADMIN_DELETE_BUTTON}
              formId={formId}
            />
            <StatusMessage state={state} />
          </form>
        </td>
      </tr>
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
                Inline edit users, assign companies, and manage access at scale.
              </p>
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/70 dark:border-slate-800/70">
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50/95 text-xs uppercase tracking-wide text-slate-500 backdrop-blur dark:bg-slate-950/95 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-3">User</th>
                    <th className="px-3 py-3">Companies</th>
                    <th className="px-3 py-3">Organizations</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-950">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={4} className={`px-3 py-6 text-sm ${ADMIN_TEXT_SUBTLE}`}>
                        No users yet. Create one to start assigning access.
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

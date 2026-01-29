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
        <td className="py-3 pr-4">
          <form id={formId} action={formAction} className="hidden">
            <input type="hidden" name="userId" value={user.id} />
          </form>
          <input
            form={formId}
            name="userEmail"
            defaultValue={user.email ?? ''}
            className={`${ADMIN_INPUT} w-full min-w-[200px]`}
            aria-label="Email"
          />
        </td>
        <td className="py-3 pr-4">
          <input
            form={formId}
            type="password"
            name="userPassword"
            placeholder="Leave blank"
            className={`${ADMIN_INPUT} w-full min-w-[180px]`}
            aria-label="Reset password"
          />
        </td>
        <td className="py-3 pr-4">
          <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <input
              form={formId}
              type="checkbox"
              name="isAdmin"
              defaultChecked={!!user.isAdmin}
              className="h-4 w-4 rounded border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
            />
            Admin
          </label>
        </td>
        <td className="py-3 pr-4">
          <select
            form={formId}
            name="companyIds"
            multiple
            defaultValue={(user.companyIds ?? []).map(String)}
            className={`min-h-[7rem] min-w-[220px] ${ADMIN_SELECT}`}
            aria-label="Companies"
          >
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
          <p className={`mt-2 ${ADMIN_HINT_TEXT}`}>
            Hold Ctrl (Windows) or Command (Mac) to select multiple.
          </p>
        </td>
        <td className="py-3 pr-4">
          <select
            form={formId}
            name="organizationIds"
            multiple
            defaultValue={(user.organizationIds ?? []).map(String)}
            className={`min-h-[7rem] min-w-[220px] ${ADMIN_SELECT}`}
            aria-label="Organizations"
          >
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
          <p className={`mt-2 ${ADMIN_HINT_TEXT}`}>
            Leave empty to allow only company-level dashboards.
          </p>
        </td>
        <td className="py-3">
          <div className="flex flex-col gap-2">
            <button
              form={formId}
              type="submit"
              name="intent"
              value="save"
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
          <td colSpan={6} className="pb-3">
            <StatusMessage state={state} className="mt-1" />
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
          <div className="mt-4 max-h-[70vh] overflow-auto">
            <div className="min-w-[980px]">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800/70">
                  <tr>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Email
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Reset password
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Admin
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Companies
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Organizations
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                  {users.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      companies={companies}
                      organizations={organizations}
                      action={manageUserAction}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </AdminPanel>
      </div>
    </AdminSection>
  );
}

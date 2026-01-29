'use client';

import { useFormState } from 'react-dom';
import { INITIAL_STATE, StatusMessage, useRefreshOnSuccess } from '../admin-client-utils';
import {
  AdminCard,
  AdminListCard,
  AdminSection,
  AdminSectionHeader,
  AdminStat,
  AdminStatGrid,
} from '../admin-components';
import ConfirmDeleteDialog from '../ConfirmDeleteDialog';
import {
  ADMIN_DELETE_BUTTON,
  ADMIN_HELP_TEXT,
  ADMIN_INPUT,
  ADMIN_INPUT_WITH_PLACEHOLDER,
  ADMIN_LABEL,
  ADMIN_PRIMARY_BUTTON,
  ADMIN_ROW_CARD,
  ADMIN_SAVE_BUTTON,
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

  return (
    <form
      action={formAction}
      className={`${ADMIN_ROW_CARD} grid gap-4 md:grid-cols-[1.3fr_1.1fr_1fr_1fr_auto]`}
    >
      <input type="hidden" name="userId" value={user.id} />
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
          className={ADMIN_INPUT_WITH_PLACEHOLDER}
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

      <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
        Companies
        <select
          name="companyIds"
          multiple
          defaultValue={(user.companyIds ?? []).map(String)}
          className={`min-h-[7rem] ${ADMIN_INPUT}`}
        >
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
        <span className={ADMIN_HELP_TEXT}>
          Hold Ctrl (Windows) or Command (Mac) to select multiple.
        </span>
      </label>

      <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
        Organizations
        <select
          name="organizationIds"
          multiple
          defaultValue={(user.organizationIds ?? []).map(String)}
          className={`min-h-[7rem] ${ADMIN_INPUT}`}
        >
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
        <span className={ADMIN_HELP_TEXT}>
          Leave empty to allow only company-level dashboards.
        </span>
      </label>

      <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
        <button type="submit" name="intent" value="save" className={ADMIN_SAVE_BUTTON}>
          Save
        </button>
        <ConfirmDeleteDialog
          title="Delete user"
          description="This will permanently delete the user account."
          triggerClassName={ADMIN_DELETE_BUTTON}
          confirmClassName={ADMIN_DELETE_BUTTON}
        />
      </div>
      <StatusMessage state={state} className="md:col-span-full" />
    </form>
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
        kicker="User access"
        title="Users"
        description="Invite users, assign access, and keep permissions up to date."
        badgeText={`${users.length} total`}
      />

      <AdminStatGrid>
        <AdminStat label="Total users" value={users.length} description="Active accounts with access." />
        <AdminStat label="Admins" value={adminCount} description="Accounts with admin privileges." />
        <AdminListCard
          title="Onboarding tips"
          items={[
            'Create a temporary password and share it securely.',
            'Assign companies and organizations to limit scope.',
          ]}
          variant="gradient"
          className="sm:col-span-2"
        />
      </AdminStatGrid>

      <div className="grid gap-6">
        <form
          action={userCreateAction}
          className="grid gap-4 rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm dark:border-slate-800/70 dark:from-slate-950/70 dark:to-slate-950/30"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Create user</h3>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Required *</span>
          </div>
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                Email *
                <input
                  name="userEmail"
                  placeholder="user@acme.com"
                  className={ADMIN_INPUT_WITH_PLACEHOLDER}
                />
              </label>
              <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                Temporary password *
                <input
                  type="password"
                  name="userPassword"
                  placeholder="Create a password"
                  className={ADMIN_INPUT_WITH_PLACEHOLDER}
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
            <p className={ADMIN_LABEL}>Provide a temporary password for first login.</p>
            <button type="submit" className={ADMIN_PRIMARY_BUTTON}>
              Create user
            </button>
          </div>
          <StatusMessage state={userCreateState} />
        </form>

        <AdminCard className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Manage users</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Update profiles, assign companies, and manage access.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-4">
            {users.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                companies={companies}
                organizations={organizations}
                action={manageUserAction}
              />
            ))}
          </div>
        </AdminCard>
      </div>
    </AdminSection>
  );
}

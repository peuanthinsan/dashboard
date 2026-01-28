'use client';

import { useFormState } from 'react-dom';
import { INITIAL_STATE, StatusMessage, useRefreshOnSuccess } from '../admin-client-utils';
import ConfirmDeleteDialog from '../ConfirmDeleteDialog';
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
      className="grid gap-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 md:grid-cols-[1.3fr_1.1fr_1fr_1fr_auto]"
    >
      <input type="hidden" name="userId" value={user.id} />
      <div className="flex flex-col gap-2 text-sm">
        <label className="text-xs text-[var(--app-text-subtle)]">Email</label>
        <input
          name="userEmail"
          defaultValue={user.email ?? ''}
          className="rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-input-bg)] px-3 py-2 text-sm text-[var(--app-text)]"
        />
        <label className="text-xs text-[var(--app-text-subtle)]">Reset password</label>
        <input
          type="password"
          name="userPassword"
          placeholder="Leave blank to keep"
          className="rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-input-bg)] px-3 py-2 text-sm text-[var(--app-text)] placeholder:text-[var(--app-text-faint)]"
        />
        <label className="flex items-center gap-2 text-xs text-[var(--app-text-subtle)]">
          <input
            type="checkbox"
            name="isAdmin"
            defaultChecked={!!user.isAdmin}
            className="h-4 w-4 rounded border-[var(--app-border-strong)] bg-[var(--app-input-bg)]"
          />
          Admin access
        </label>
      </div>

      <label className="flex flex-col gap-2 text-xs text-[var(--app-text-subtle)]">
        Companies
        <select
          name="companyIds"
          multiple
          defaultValue={(user.companyIds ?? []).map(String)}
          className="min-h-[7rem] rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-input-bg)] px-3 py-2 text-sm text-[var(--app-text)]"
        >
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-[var(--app-text-faint)]">
          Hold Ctrl (Windows) or Command (Mac) to select multiple.
        </span>
      </label>

      <label className="flex flex-col gap-2 text-xs text-[var(--app-text-subtle)]">
        Organizations
        <select
          name="organizationIds"
          multiple
          defaultValue={(user.organizationIds ?? []).map(String)}
          className="min-h-[7rem] rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-input-bg)] px-3 py-2 text-sm text-[var(--app-text)]"
        >
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-[var(--app-text-faint)]">
          Leave empty to allow only company-level dashboards.
        </span>
      </label>

      <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
        <button
          type="submit"
          name="intent"
          value="save"
          className="w-full rounded-lg border border-[var(--app-border-strong)] px-4 py-2 text-sm font-semibold text-[var(--app-text)] hover:border-[var(--app-border-strong)] sm:w-auto"
        >
          Save
        </button>
        <ConfirmDeleteDialog
          title="Delete user"
          description="This will permanently delete the user account."
          triggerClassName="w-full rounded-lg border border-rose-500/50 px-3 py-2 text-sm font-semibold text-rose-200 hover:border-rose-400 sm:w-auto"
          confirmClassName="w-full rounded-lg border border-rose-500/50 px-3 py-2 text-sm font-semibold text-rose-200 hover:border-rose-400 sm:w-auto"
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
  const [userCreateState, userCreateAction] = useFormState(addUserAction, INITIAL_STATE);
  useRefreshOnSuccess(userCreateState);

  return (
    <section className="grid gap-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4 shadow-lg sm:p-6">
      <form
        action={userCreateAction}
        className="grid gap-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 md:grid-cols-[1.2fr_1fr_auto]"
      >
        <div className="flex flex-col gap-2">
          <label className="text-xs text-[var(--app-text-subtle)]">Email</label>
          <input
            name="userEmail"
            placeholder="user@acme.com"
            className="rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-input-bg)] px-3 py-2 text-sm text-[var(--app-text)] placeholder:text-[var(--app-text-faint)]"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs text-[var(--app-text-subtle)]">Temporary password</label>
          <input
            type="password"
            name="userPassword"
            placeholder="Create a password"
            className="rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-input-bg)] px-3 py-2 text-sm text-[var(--app-text)] placeholder:text-[var(--app-text-faint)]"
          />
          <label className="flex items-center gap-2 text-xs text-[var(--app-text-subtle)]">
            <input
              type="checkbox"
              name="isAdmin"
              className="h-4 w-4 rounded border-[var(--app-border-strong)] bg-[var(--app-input-bg)]"
            />
            Admin access
          </label>
        </div>
        <div className="flex items-center">
          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 sm:w-auto"
          >
            Create user
          </button>
        </div>
        <StatusMessage state={userCreateState} />
      </form>

      <div className="grid gap-4">
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
    </section>
  );
}

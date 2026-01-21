'use client';

import { useFormState } from 'react-dom';
import { confirmDelete, INITIAL_STATE, StatusMessage, useRefreshOnSuccess } from '../admin-client-utils';
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
      className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 md:grid-cols-[1.3fr_1.1fr_1fr_1fr_auto]"
    >
      <input type="hidden" name="userId" value={user.id} />
      <div className="flex flex-col gap-2 text-sm">
        <label className="text-xs text-slate-400">Email</label>
        <input
          name="userEmail"
          defaultValue={user.email ?? ''}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
        />
        <label className="text-xs text-slate-400">Reset password</label>
        <input
          type="password"
          name="userPassword"
          placeholder="Leave blank to keep"
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
        />
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            name="isAdmin"
            defaultChecked={!!user.isAdmin}
            className="h-4 w-4 rounded border-slate-600 bg-slate-900"
          />
          Admin access
        </label>
      </div>

      <label className="flex flex-col gap-2 text-xs text-slate-400">
        Companies
        <select
          name="companyIds"
          multiple
          defaultValue={(user.companyIds ?? []).map(String)}
          className="min-h-[7rem] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
        >
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-slate-500">
          Hold Ctrl (Windows) or Command (Mac) to select multiple.
        </span>
      </label>

      <label className="flex flex-col gap-2 text-xs text-slate-400">
        Organizations
        <select
          name="organizationIds"
          multiple
          defaultValue={(user.organizationIds ?? []).map(String)}
          className="min-h-[7rem] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
        >
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-slate-500">
          Leave empty to allow only company-level dashboards.
        </span>
      </label>

      <div className="flex items-end gap-2">
        <button
          type="submit"
          name="intent"
          value="save"
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-white hover:border-slate-500"
        >
          Save
        </button>
        <button
          type="submit"
          name="intent"
          value="delete"
          onClick={confirmDelete}
          className="rounded-lg border border-rose-500/50 px-3 py-2 text-sm font-semibold text-rose-200 hover:border-rose-400"
        >
          Delete
        </button>
      </div>
      <StatusMessage state={state} />
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
    <section className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
      <form
        action={userCreateAction}
        className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 md:grid-cols-[1.2fr_1fr_auto]"
      >
        <div className="flex flex-col gap-2">
          <label className="text-xs text-slate-400">Email</label>
          <input
            name="userEmail"
            placeholder="user@acme.com"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs text-slate-400">Temporary password</label>
          <input
            type="password"
            name="userPassword"
            placeholder="Create a password"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
          />
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              name="isAdmin"
              className="h-4 w-4 rounded border-slate-600 bg-slate-900"
            />
            Admin access
          </label>
        </div>
        <div className="flex items-center">
          <button
            type="submit"
            className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
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

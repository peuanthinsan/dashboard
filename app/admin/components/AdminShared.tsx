'use client';

import { useEffect } from 'react';
import type { MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useFormState } from 'react-dom';

export const DASHBOARD_TEMPLATES = ['Summary', 'Detail', 'Simple', 'Video Samples'] as const;

export type ActionState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

export type Company = {
  id: number;
  name: string | null;
};

export type Organization = {
  id: number;
  name: string | null;
};

export type User = {
  id: number;
  email: string | null;
  isAdmin: boolean | null;
  companyIds?: number[];
  organizationIds?: number[];
};

export type Dashboard = {
  id: number;
  name: string | null;
  sheetUrl: string | null;
  template: string | null;
  companyId: number | null;
  organizationId: number | null;
};

export type FormAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>;

export const INITIAL_STATE: ActionState = { status: 'idle', message: '' };

export function StatusMessage({ state }: { state: ActionState }) {
  if (state.status === 'idle') {
    return null;
  }

  const colorClass = state.status === 'success' ? 'text-emerald-300' : 'text-rose-300';
  return <p className={`text-xs ${colorClass}`}>{state.message}</p>;
}

export function useRefreshOnSuccess(state: ActionState) {
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'success') {
      router.refresh();
    }
  }, [router, state.status]);
}

export function confirmDelete(event: MouseEvent<HTMLButtonElement>) {
  if (!window.confirm('Are you sure you want to delete this item?')) {
    event.preventDefault();
  }
}

export function CompanyRow({ company, action }: { company: Company; action: FormAction }) {
  const [state, formAction] = useFormState(action, INITIAL_STATE);
  useRefreshOnSuccess(state);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="companyId" value={company.id} />
      <div className="flex flex-1 flex-col gap-2">
        <label className="text-xs text-slate-400">Company name</label>
        <input
          name="companyName"
          defaultValue={company.name ?? ''}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
        />
      </div>
      <div className="flex items-end gap-2">
        <button
          type="submit"
          name="intent"
          value="save"
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-white hover:border-slate-500"
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

export function OrganizationRow({
  organization,
  action,
}: {
  organization: Organization;
  action: FormAction;
}) {
  const [state, formAction] = useFormState(action, INITIAL_STATE);
  useRefreshOnSuccess(state);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="organizationId" value={organization.id} />
      <div className="flex flex-1 flex-col gap-2">
        <label className="text-xs text-slate-400">Organization name</label>
        <input
          name="organizationName"
          defaultValue={organization.name ?? ''}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
        />
      </div>
      <div className="flex items-end gap-2">
        <button
          type="submit"
          name="intent"
          value="save"
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-white hover:border-slate-500"
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

export function UserRow({
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

export function DashboardRow({
  dashboard,
  companies,
  organizations,
  action,
}: {
  dashboard: Dashboard;
  companies: Company[];
  organizations: Organization[];
  action: FormAction;
}) {
  const [state, formAction] = useFormState(action, INITIAL_STATE);
  useRefreshOnSuccess(state);

  return (
    <div className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 md:grid-cols-[1.2fr_1.4fr_1fr_1fr_0.8fr_auto]">
      <form action={formAction} className="contents">
        <input type="hidden" name="dashboardId" value={dashboard.id} />
        <div className="flex flex-col gap-2">
          <label className="text-xs text-slate-400">Dashboard name</label>
          <input
            name="dashboardName"
            defaultValue={dashboard.name ?? ''}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs text-slate-400">Sheet link</label>
          <input
            name="sheetUrl"
            defaultValue={dashboard.sheetUrl ?? ''}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs text-slate-400">Company</label>
          <select
            name="companyId"
            defaultValue={dashboard.companyId ?? ''}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          >
            <option value="">Select company</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs text-slate-400">Organization</label>
          <select
            name="organizationId"
            defaultValue={dashboard.organizationId ?? ''}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          >
            <option value="">No organization</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs text-slate-400">Template</label>
          <select
            name="template"
            defaultValue={dashboard.template ?? 'Summary'}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          >
            {DASHBOARD_TEMPLATES.map((template) => (
              <option key={template} value={template}>
                {template}
              </option>
            ))}
          </select>
        </div>
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
    </div>
  );
}

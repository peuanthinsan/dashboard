'use client';

import { useEffect } from 'react';
import type { MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFormState } from 'react-dom';

const DASHBOARD_TEMPLATES = ['Summary', 'Detail', 'Simple', 'Video Samples'] as const;

type ActionState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

type Company = {
  id: number;
  name: string | null;
};

type Organization = {
  id: number;
  name: string | null;
};

type User = {
  id: number;
  email: string | null;
  isAdmin: boolean | null;
  companyIds?: number[];
  organizationIds?: number[];
};

type Dashboard = {
  id: number;
  name: string | null;
  sheetUrl: string | null;
  template: string | null;
  companyId: number | null;
  organizationId: number | null;
};

type FormAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>;

type AdminPageClientProps = {
  users: User[];
  companies: Company[];
  organizations: Organization[];
  dashboards: Dashboard[];
  addCompanyAction: FormAction;
  manageCompanyAction: FormAction;
  addOrganizationAction: FormAction;
  manageOrganizationAction: FormAction;
  addUserAction: FormAction;
  manageUserAction: FormAction;
  addDashboardAction: FormAction;
  manageDashboardAction: FormAction;
};

const INITIAL_STATE: ActionState = { status: 'idle', message: '' };

function StatusMessage({ state }: { state: ActionState }) {
  if (state.status === 'idle') {
    return null;
  }

  const colorClass = state.status === 'success' ? 'text-emerald-300' : 'text-rose-300';
  return <p className={`text-xs ${colorClass}`}>{state.message}</p>;
}

function useRefreshOnSuccess(state: ActionState) {
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'success') {
      router.refresh();
    }
  }, [router, state.status]);
}

function confirmDelete(event: MouseEvent<HTMLButtonElement>) {
  if (!window.confirm('Are you sure you want to delete this item?')) {
    event.preventDefault();
  }
}

function CompanyRow({ company, action }: { company: Company; action: FormAction }) {
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

function OrganizationRow({
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

function DashboardRow({
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

export default function AdminPageClient({
  users,
  companies,
  organizations,
  dashboards,
  addCompanyAction,
  manageCompanyAction,
  addOrganizationAction,
  manageOrganizationAction,
  addUserAction,
  manageUserAction,
  addDashboardAction,
  manageDashboardAction,
}: AdminPageClientProps) {
  const [companyCreateState, companyCreateAction] = useFormState(
    addCompanyAction,
    INITIAL_STATE,
  );
  const [organizationCreateState, organizationCreateAction] = useFormState(
    addOrganizationAction,
    INITIAL_STATE,
  );
  const [userCreateState, userCreateAction] = useFormState(addUserAction, INITIAL_STATE);
  const [dashboardCreateState, dashboardCreateAction] = useFormState(
    addDashboardAction,
    INITIAL_STATE,
  );

  useRefreshOnSuccess(companyCreateState);
  useRefreshOnSuccess(organizationCreateState);
  useRefreshOnSuccess(userCreateState);
  useRefreshOnSuccess(dashboardCreateState);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-[1124px] flex-col gap-8">
        <header className="flex flex-col gap-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"
          >
            <span aria-hidden="true">←</span>
            Back to dashboards
          </Link>
          <h1 className="text-3xl font-semibold">Administration</h1>
          <p className="text-sm text-slate-300">
            Assign users to one or more companies and organizations, and manage admin access.
          </p>
        </header>

        <section className="grid gap-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
          <div className="grid gap-4 md:grid-cols-2">
            <form
              action={companyCreateAction}
              className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4"
            >
              <h2 className="text-lg font-medium">Create company</h2>
              <input
                name="companyName"
                placeholder="Acme Corp"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
              <button
                type="submit"
                className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
              >
                Add company
              </button>
              <StatusMessage state={companyCreateState} />
            </form>

            <form
              action={organizationCreateAction}
              className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4"
            >
              <h2 className="text-lg font-medium">Create organization</h2>
              <input
                name="organizationName"
                placeholder="Operations Team"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
              <button
                type="submit"
                className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
              >
                Add organization
              </button>
              <StatusMessage state={organizationCreateState} />
            </form>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <h3 className="text-base font-medium">Manage companies</h3>
              {companies.length === 0 ? (
                <p className="text-sm text-slate-400">No companies yet.</p>
              ) : (
                companies.map((company) => (
                  <CompanyRow key={company.id} company={company} action={manageCompanyAction} />
                ))
              )}
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <h3 className="text-base font-medium">Manage organizations</h3>
              {organizations.length === 0 ? (
                <p className="text-sm text-slate-400">No organizations yet.</p>
              ) : (
                organizations.map((organization) => (
                  <OrganizationRow
                    key={organization.id}
                    organization={organization}
                    action={manageOrganizationAction}
                  />
                ))
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
          <h2 className="text-lg font-medium">Users</h2>
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
            <div className="flex items-end">
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

        <section className="grid gap-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
          <header className="flex flex-col gap-2">
            <h2 className="text-lg font-medium">Dashboards</h2>
            <p className="text-sm text-slate-300">
              Create dashboards for a company, optionally filter by organization, and set the
              template + sheet link.
            </p>
          </header>

          <form
            action={dashboardCreateAction}
            className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 md:grid-cols-2"
          >
            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-400">Dashboard name</label>
              <input
                name="dashboardName"
                placeholder="Operations overview"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-400">Google Sheet link</label>
              <input
                name="sheetUrl"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-400">Company</label>
              <select
                name="companyId"
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
              <label className="text-xs text-slate-400">Organization (optional)</label>
              <select
                name="organizationId"
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
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              >
                {DASHBOARD_TEMPLATES.map((template) => (
                  <option key={template} value={template}>
                    {template}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
              >
                Create dashboard
              </button>
            </div>
            <StatusMessage state={dashboardCreateState} />
          </form>

          <div className="grid gap-4">
            {dashboards.length === 0 ? (
              <p className="text-sm text-slate-400">
                No dashboards yet. Create one to make it available to users.
              </p>
            ) : (
              dashboards.map((dashboard) => (
                <DashboardRow
                  key={dashboard.id}
                  dashboard={dashboard}
                  companies={companies}
                  organizations={organizations}
                  action={manageDashboardAction}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

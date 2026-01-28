'use client';

import { useFormState } from 'react-dom';
import { INITIAL_STATE, StatusMessage, useRefreshOnSuccess } from '../admin-client-utils';
import ConfirmDeleteDialog from '../ConfirmDeleteDialog';
import { ADMIN_DELETE_BUTTON, ADMIN_PRIMARY_BUTTON, ADMIN_SAVE_BUTTON } from '../admin-ui';
import type { ActionState, Organization } from '../types';

type FormAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>;

type OrganizationsClientProps = {
  organizations: Organization[];
  addOrganizationAction: FormAction;
  manageOrganizationAction: FormAction;
};

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
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-slate-200/70 bg-white/95 p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-800/70 dark:bg-slate-950/60 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <input type="hidden" name="organizationId" value={organization.id} />
      <div className="flex w-full flex-col gap-2 sm:flex-1">
        <label className="text-xs text-slate-500 dark:text-slate-400">Organization name</label>
        <input
          name="organizationName"
          defaultValue={organization.name ?? ''}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <button type="submit" name="intent" value="save" className={ADMIN_SAVE_BUTTON}>
          Save
        </button>
        <ConfirmDeleteDialog
          title="Delete organization"
          description="This will permanently delete the organization record."
          triggerClassName={ADMIN_DELETE_BUTTON}
          confirmClassName={ADMIN_DELETE_BUTTON}
        />
      </div>
      <StatusMessage state={state} className="sm:basis-full" />
    </form>
  );
}

export default function OrganizationsClient({
  organizations,
  addOrganizationAction,
  manageOrganizationAction,
}: OrganizationsClientProps) {
  const totalOrganizations = organizations.length;

  const [organizationCreateState, organizationCreateAction] = useFormState(
    addOrganizationAction,
    INITIAL_STATE,
  );
  useRefreshOnSuccess(organizationCreateState);

  return (
    <section className="grid gap-6 rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/70">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            Organization setup
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">Organizations</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Group teams and departments to filter dashboard access.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
          {totalOrganizations} total
        </span>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/60">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Total organizations
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            {totalOrganizations}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Group access by department or region.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm dark:border-slate-800/70 dark:from-slate-950/60 dark:to-slate-950/30">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Best practices
          </p>
          <ul className="mt-2 space-y-2 text-xs text-slate-600 dark:text-slate-300">
            <li>Use team names that match internal reporting.</li>
            <li>Optional organizations keep access flexible.</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/60 sm:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Access flow
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Pair organizations with dashboards to scope what teams can see.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.6fr]">
        <form
          action={organizationCreateAction}
          className="flex flex-col gap-4 rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm dark:border-slate-800/70 dark:from-slate-950/70 dark:to-slate-950/30"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Create organization</h3>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Required *</span>
          </div>
          <label className="text-xs text-slate-500 dark:text-slate-400">
            Organization name *
            <input
              name="organizationName"
              placeholder="Operations Team"
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Organizations can be optional on dashboards.
            </p>
            <button type="submit" className={ADMIN_PRIMARY_BUTTON}>
              Add organization
            </button>
          </div>
          <StatusMessage state={organizationCreateState} />
        </form>

        <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/60">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Manage organizations</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Update organization names and maintain access rules.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-4">
            {organizations.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No organizations yet.</p>
            ) : (
              <div className="grid gap-4">
                {organizations.map((organization) => (
                  <OrganizationRow
                    key={organization.id}
                    organization={organization}
                    action={manageOrganizationAction}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

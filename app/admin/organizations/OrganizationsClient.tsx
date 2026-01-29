'use client';

import { useId } from 'react';
import { useFormState } from 'react-dom';
import AdminField from '../AdminField';
import { INITIAL_STATE, StatusMessage, useRefreshOnSuccess } from '../admin-client-utils';
import ConfirmDeleteDialog from '../ConfirmDeleteDialog';
import {
  ADMIN_DELETE_BUTTON,
  ADMIN_FIELD_INPUT,
  ADMIN_FORM_CARD,
  ADMIN_GRADIENT_CARD,
  ADMIN_HELP_TEXT,
  ADMIN_MANAGE_CARD,
  ADMIN_PANEL,
  ADMIN_PRIMARY_BUTTON,
  ADMIN_SAVE_BUTTON,
  ADMIN_SECTION_BADGE,
  ADMIN_STAT_CARD,
} from '../admin-ui';
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
  const rowId = useId();
  const nameId = `${rowId}-organization-name`;

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-slate-200/70 bg-white/95 p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-800/70 dark:bg-slate-950/60 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <input type="hidden" name="organizationId" value={organization.id} />
      <AdminField
        id={nameId}
        label="Organization name"
        className="flex w-full flex-col gap-2 sm:flex-1"
      >
        <input
          name="organizationName"
          defaultValue={organization.name ?? ''}
          className={ADMIN_FIELD_INPUT}
        />
      </AdminField>
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
  const formId = useId();
  const createNameId = `${formId}-create-organization-name`;

  return (
    <section className={ADMIN_PANEL}>
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
        <span className={ADMIN_SECTION_BADGE}>{totalOrganizations} total</span>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className={ADMIN_STAT_CARD}>
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
        <div className={ADMIN_GRADIENT_CARD}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Best practices
          </p>
          <ul className="mt-2 space-y-2 text-xs text-slate-600 dark:text-slate-300">
            <li>Use team names that match internal reporting.</li>
            <li>Optional organizations keep access flexible.</li>
          </ul>
        </div>
        <div className={`${ADMIN_STAT_CARD} sm:col-span-2`}>
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
          className={`flex flex-col gap-4 ${ADMIN_FORM_CARD}`}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Create organization</h3>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Required *</span>
          </div>
          <AdminField
            id={createNameId}
            label="Organization name"
            required
            className="flex flex-col gap-2"
            helperText="Use a name that mirrors internal team or region labels."
          >
            <input
              name="organizationName"
              placeholder="Operations Team"
              className={`w-full ${ADMIN_FIELD_INPUT}`}
            />
          </AdminField>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={ADMIN_HELP_TEXT}>
              Organizations can be optional on dashboards.
            </p>
            <button type="submit" className={ADMIN_PRIMARY_BUTTON}>
              Add organization
            </button>
          </div>
          <StatusMessage state={organizationCreateState} />
        </form>

        <div className={ADMIN_MANAGE_CARD}>
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

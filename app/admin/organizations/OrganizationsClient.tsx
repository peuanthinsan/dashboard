'use client';

import { useFormState } from 'react-dom';
import { INITIAL_STATE, StatusMessage, useRefreshOnSuccess } from '../admin-client-utils';
import ConfirmDeleteDialog from '../ConfirmDeleteDialog';
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
      className="flex flex-col gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <input type="hidden" name="organizationId" value={organization.id} />
      <div className="flex w-full flex-col gap-2 sm:flex-1">
        <label className="text-xs text-[var(--app-text-subtle)]">Organization name</label>
        <input
          name="organizationName"
          defaultValue={organization.name ?? ''}
          className="rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-input-bg)] px-3 py-2 text-sm text-[var(--app-text)]"
        />
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <button
          type="submit"
          name="intent"
          value="save"
          className="w-full rounded-lg border border-[var(--app-border-strong)] px-3 py-2 text-sm font-semibold text-[var(--app-text)] hover:border-[var(--app-border-strong)] sm:w-auto"
        >
          Save
        </button>
        <ConfirmDeleteDialog
          title="Delete organization"
          description="This will permanently delete the organization record."
          triggerClassName="w-full rounded-lg border border-rose-500/50 px-3 py-2 text-sm font-semibold text-rose-200 hover:border-rose-400 sm:w-auto"
          confirmClassName="w-full rounded-lg border border-rose-500/50 px-3 py-2 text-sm font-semibold text-rose-200 hover:border-rose-400 sm:w-auto"
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
  const [organizationCreateState, organizationCreateAction] = useFormState(
    addOrganizationAction,
    INITIAL_STATE,
  );
  useRefreshOnSuccess(organizationCreateState);

  return (
    <section className="grid gap-6 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4 shadow-lg sm:p-6">
      <form
        action={organizationCreateAction}
        className="flex flex-col gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <h2 className="w-full text-lg font-medium">Create organization</h2>
        <div className="flex w-full flex-col gap-3 sm:flex-1 sm:flex-row sm:items-end">
          <input
            name="organizationName"
            placeholder="Operations Team"
            className="w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-input-bg)] px-3 py-2 text-sm text-[var(--app-text)] placeholder:text-[var(--app-text-faint)]"
          />
          <button
            type="submit"
            className="w-full shrink-0 whitespace-nowrap rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400 sm:w-auto"
          >
            Add organization
          </button>
        </div>
        <StatusMessage state={organizationCreateState} />
      </form>

      <div className="flex flex-col gap-3">
        <h3 className="text-base font-medium">Manage organizations</h3>
        {organizations.length === 0 ? (
          <p className="text-sm text-[var(--app-text-subtle)]">No organizations yet.</p>
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
    </section>
  );
}

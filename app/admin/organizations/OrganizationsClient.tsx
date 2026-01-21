'use client';

import { useFormState } from 'react-dom';
import { confirmDelete, INITIAL_STATE, StatusMessage, useRefreshOnSuccess } from '../admin-client-utils';
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
    <section className="grid gap-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
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
    </section>
  );
}

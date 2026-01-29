'use client';

import { useFormState } from 'react-dom';
import { INITIAL_STATE, StatusMessage, useRefreshOnSuccess } from '../admin-client-utils';
import ConfirmDeleteDialog from '../ConfirmDeleteDialog';
import { AdminPanel, AdminSection, AdminSectionHeader, AdminStatCard } from '../admin-components';
import {
  ADMIN_DELETE_BUTTON,
  ADMIN_FORM_PANEL,
  ADMIN_INPUT,
  ADMIN_LABEL,
  ADMIN_PRIMARY_BUTTON,
  ADMIN_ROW_FORM,
  ADMIN_SAVE_BUTTON,
  ADMIN_TEXT_MUTED,
  ADMIN_TEXT_SUBTLE,
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

  return (
    <form
      action={formAction}
      className={ADMIN_ROW_FORM}
    >
      <input type="hidden" name="organizationId" value={organization.id} />
      <div className="flex w-full flex-col gap-2 sm:flex-1">
        <label className={ADMIN_LABEL}>Fleet name</label>
        <input
          name="organizationName"
          defaultValue={organization.name ?? ''}
          className={ADMIN_INPUT}
        />
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <button type="submit" name="intent" value="save" className={ADMIN_SAVE_BUTTON}>
          Save
        </button>
        <ConfirmDeleteDialog
          title="Delete fleet"
          description="This will permanently delete the fleet record."
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
    <AdminSection>
      <AdminSectionHeader
        eyebrow="Fleet setup"
        title="Fleets"
        description="Group teams and departments to filter dashboard access."
        count={totalOrganizations}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="Total fleets"
          value={totalOrganizations}
          description="Group access by department or region."
        />
        <AdminStatCard label="Best practices" variant="gradient">
          <ul className={`space-y-2 text-xs ${ADMIN_TEXT_MUTED}`}>
            <li>Use team names that match internal reporting.</li>
            <li>Optional fleets keep access flexible.</li>
          </ul>
        </AdminStatCard>
        <AdminStatCard
          label="Access flow"
          className="sm:col-span-2"
          description="Pair fleets with dashboards to scope what teams can see."
          descriptionTone="muted"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.6fr]">
        <form
          action={organizationCreateAction}
          className={`${ADMIN_FORM_PANEL} flex flex-col gap-4`}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Create fleet</h3>
            <span className={ADMIN_LABEL}>Required *</span>
          </div>
          <label className={ADMIN_LABEL}>
            Fleet name *
            <input
              name="organizationName"
              placeholder="Operations Team"
              className={`mt-2 w-full ${ADMIN_INPUT}`}
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={`text-xs ${ADMIN_TEXT_SUBTLE}`}>
              Fleets can be optional on dashboards.
            </p>
            <button type="submit" className={ADMIN_PRIMARY_BUTTON}>
              Add fleet
            </button>
          </div>
          <StatusMessage state={organizationCreateState} />
        </form>

        <AdminPanel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Manage fleets</h3>
              <p className={`mt-1 text-sm ${ADMIN_TEXT_SUBTLE}`}>
                Update fleet names and maintain access rules.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-4">
            {organizations.length === 0 ? (
              <p className={`text-sm ${ADMIN_TEXT_SUBTLE}`}>No fleets yet.</p>
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
        </AdminPanel>
      </div>
    </AdminSection>
  );
}

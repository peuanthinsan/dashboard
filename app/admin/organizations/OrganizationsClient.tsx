'use client';

import { useFormState } from 'react-dom';
import { INITIAL_STATE, StatusMessage, useRefreshOnSuccess } from '../admin-client-utils';
import {
  AdminCard,
  AdminListCard,
  AdminNoteCard,
  AdminSection,
  AdminSectionHeader,
  AdminStat,
  AdminStatGrid,
} from '../admin-components';
import ConfirmDeleteDialog from '../ConfirmDeleteDialog';
import {
  ADMIN_DELETE_BUTTON,
  ADMIN_INPUT,
  ADMIN_INPUT_WITH_PLACEHOLDER,
  ADMIN_LABEL,
  ADMIN_PRIMARY_BUTTON,
  ADMIN_ROW_CARD,
  ADMIN_SAVE_BUTTON,
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
      className={`${ADMIN_ROW_CARD} flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end`}
    >
      <input type="hidden" name="organizationId" value={organization.id} />
      <div className="flex w-full flex-col gap-2 sm:flex-1">
        <label className={ADMIN_LABEL}>Organization name</label>
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
    <AdminSection>
      <AdminSectionHeader
        kicker="Organization setup"
        title="Organizations"
        description="Group teams and departments to filter dashboard access."
        badgeText={`${totalOrganizations} total`}
      />

      <AdminStatGrid>
        <AdminStat
          label="Total organizations"
          value={totalOrganizations}
          description="Group access by department or region."
        />
        <AdminListCard
          title="Best practices"
          items={['Use team names that match internal reporting.', 'Optional organizations keep access flexible.']}
          variant="gradient"
        />
        <AdminNoteCard title="Access flow" className="sm:col-span-2">
          Pair organizations with dashboards to scope what teams can see.
        </AdminNoteCard>
      </AdminStatGrid>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.6fr]">
        <form
          action={organizationCreateAction}
          className="flex flex-col gap-4 rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm dark:border-slate-800/70 dark:from-slate-950/70 dark:to-slate-950/30"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Create organization</h3>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Required *</span>
          </div>
          <label className={ADMIN_LABEL}>
            Organization name *
            <input
              name="organizationName"
              placeholder="Operations Team"
              className={`mt-2 w-full ${ADMIN_INPUT_WITH_PLACEHOLDER}`}
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={ADMIN_LABEL}>Organizations can be optional on dashboards.</p>
            <button type="submit" className={ADMIN_PRIMARY_BUTTON}>
              Add organization
            </button>
          </div>
          <StatusMessage state={organizationCreateState} />
        </form>

        <AdminCard className="p-5">
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
        </AdminCard>
      </div>
    </AdminSection>
  );
}

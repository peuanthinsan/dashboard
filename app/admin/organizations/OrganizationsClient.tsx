'use client';

import { useEffect, useState } from 'react';
import { useFormState } from 'react-dom';
import AdminModal from '../AdminModal';
import { INITIAL_STATE, StatusMessage, useRefreshOnSuccess } from '../admin-client-utils';
import ConfirmDeleteDialog from '../ConfirmDeleteDialog';
import { AdminPanel, AdminSection, AdminSectionHeader, AdminStatCard } from '../admin-components';
import {
  ADMIN_DELETE_BUTTON,
  ADMIN_INPUT,
  ADMIN_LABEL,
  ADMIN_PRIMARY_BUTTON,
  ADMIN_SAVE_BUTTON,
  ADMIN_SELECT,
  ADMIN_TEXT_MUTED,
  ADMIN_TEXT_SUBTLE,
} from '../admin-ui';
import type { ActionState, Company, Organization } from '../types';

type FormAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>;

type OrganizationsClientProps = {
  organizations: Organization[];
  companies: Company[];
  addOrganizationAction: FormAction;
  manageOrganizationAction: FormAction;
};

function OrganizationRow({
  organization,
  companies,
  action,
}: {
  organization: Organization;
  companies: Company[];
  action: FormAction;
}) {
  const [state, formAction] = useFormState(action, INITIAL_STATE);
  const [isOpen, setIsOpen] = useState(false);
  const company = companies.find((entry) => entry.id === organization.companyId);
  useRefreshOnSuccess(state);

  useEffect(() => {
    if (state.status === 'success') {
      setIsOpen(false);
    }
  }, [state.status]);

  return (
    <>
      <tr className="border-b border-slate-200/70 text-sm text-slate-700 last:border-b-0 dark:border-slate-800/70 dark:text-slate-200">
        <td className="px-4 py-3">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">
            {organization.name ?? 'Unnamed fleet'}
          </div>
          <div className="mt-1 text-xs text-slate-500">ID {organization.id}</div>
        </td>
        <td className="px-4 py-3">
          <div className="text-sm text-slate-900 dark:text-white">
            {company?.name ?? 'No company assigned'}
          </div>
          <div className="mt-1 text-xs text-slate-500">Company ID {organization.companyId ?? '—'}</div>
        </td>
        <td className="px-4 py-3 text-right">
          <button type="button" onClick={() => setIsOpen(true)} className={ADMIN_SAVE_BUTTON}>
            Edit
          </button>
        </td>
      </tr>

      <AdminModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Edit fleet"
        description="Update fleet names or remove unused fleets."
      >
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="organizationId" value={organization.id} />
          <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
            Fleet name
            <input
              name="organizationName"
              defaultValue={organization.name ?? ''}
              className={ADMIN_INPUT}
            />
          </label>
          <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
            Company
            <span className="text-xs text-slate-500">
              Current company ID: {organization.companyId ?? '—'}
            </span>
            <select
              name="companyId"
              defaultValue={organization.companyId ?? ''}
              className={ADMIN_SELECT}
            >
              <option value="">No company</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <StatusMessage state={state} />
            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" name="intent" value="save" className={ADMIN_SAVE_BUTTON}>
                Save changes
              </button>
              <ConfirmDeleteDialog
                title="Delete fleet"
                description="This will permanently delete the fleet record."
                triggerClassName={ADMIN_DELETE_BUTTON}
                confirmClassName={ADMIN_DELETE_BUTTON}
              />
            </div>
          </div>
        </form>
      </AdminModal>
    </>
  );
}

export default function OrganizationsClient({
  organizations,
  companies,
  addOrganizationAction,
  manageOrganizationAction,
}: OrganizationsClientProps) {
  const totalOrganizations = organizations.length;

  const [organizationCreateState, organizationCreateAction] = useFormState(
    addOrganizationAction,
    INITIAL_STATE,
  );
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  useRefreshOnSuccess(organizationCreateState);

  useEffect(() => {
    if (organizationCreateState.status === 'success') {
      setIsCreateOpen(false);
    }
  }, [organizationCreateState.status]);

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

      <div className="grid gap-6">
        <AdminPanel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Manage fleets</h3>
              <p className={`mt-1 text-sm ${ADMIN_TEXT_SUBTLE}`}>
                Update fleet names and maintain access rules.
              </p>
            </div>
            <button type="button" onClick={() => setIsCreateOpen(true)} className={ADMIN_PRIMARY_BUTTON}>
              Create fleet
            </button>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/60">
            <div className="max-h-[32rem] overflow-auto">
              <table className="min-w-full border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Fleet</th>
                    <th className="px-4 py-3 font-semibold">Company</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {organizations.map((organization) => (
                    <OrganizationRow
                      key={organization.id}
                      organization={organization}
                      companies={companies}
                      action={manageOrganizationAction}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {organizations.length === 0 ? (
              <p className={`px-4 py-6 text-sm ${ADMIN_TEXT_SUBTLE}`}>
                No fleets yet. Create one to scope dashboard access.
              </p>
            ) : null}
          </div>
        </AdminPanel>
      </div>

      <AdminModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create fleet"
        description="Add a fleet to scope dashboards to teams or regions."
      >
        <form action={organizationCreateAction} className="grid gap-4">
          <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
            Fleet name *
            <input
              name="organizationName"
              placeholder="Operations Team"
              className={ADMIN_INPUT}
            />
          </label>
          <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
            Company (optional)
            <select name="companyId" className={ADMIN_SELECT}>
              <option value="">No company</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={`text-xs ${ADMIN_TEXT_SUBTLE}`}>
              Fleets can be optional on dashboards.
            </p>
            <button type="submit" className={ADMIN_PRIMARY_BUTTON}>
              Create fleet
            </button>
          </div>
          <StatusMessage state={organizationCreateState} />
        </form>
      </AdminModal>
    </AdminSection>
  );
}

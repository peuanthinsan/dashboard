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
} from '../admin-ui';
import type { ActionState, Company } from '../types';

type FormAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>;

type CompaniesClientProps = {
  companies: Company[];
  addCompanyAction: FormAction;
  manageCompanyAction: FormAction;
};

function CompanyRow({ company, action }: { company: Company; action: FormAction }) {
  const [state, formAction] = useFormState(action, INITIAL_STATE);
  useRefreshOnSuccess(state);

  return (
    <form
      action={formAction}
      className={ADMIN_ROW_FORM}
    >
      <input type="hidden" name="companyId" value={company.id} />
      <div className="flex w-full flex-col gap-2 sm:flex-1">
        <label className={ADMIN_LABEL}>Company name</label>
        <input
          name="companyName"
          defaultValue={company.name ?? ''}
          className={ADMIN_INPUT}
        />
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <button type="submit" name="intent" value="save" className={ADMIN_SAVE_BUTTON}>
          Save
        </button>
        <ConfirmDeleteDialog
          title="Delete company"
          description="This will permanently delete the company record."
          triggerClassName={ADMIN_DELETE_BUTTON}
          confirmClassName={ADMIN_DELETE_BUTTON}
        />
      </div>
      <StatusMessage state={state} className="sm:basis-full" />
    </form>
  );
}

export default function CompaniesClient({
  companies,
  addCompanyAction,
  manageCompanyAction,
}: CompaniesClientProps) {
  const totalCompanies = companies.length;

  const [companyCreateState, companyCreateAction] = useFormState(
    addCompanyAction,
    INITIAL_STATE,
  );
  useRefreshOnSuccess(companyCreateState);

  return (
    <AdminSection>
      <AdminSectionHeader
        eyebrow="Company setup"
        title="Companies"
        description="Create and manage company profiles that map to dashboard access."
        count={totalCompanies}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="Total companies"
          value={totalCompanies}
          description="Active company profiles in the system."
        />
        <AdminStatCard label="Quick tips" variant="gradient">
          <ul className={`space-y-2 text-xs ${ADMIN_TEXT_MUTED}`}>
            <li>Use short, human-friendly names for reporting.</li>
            <li>Assign dashboards after creating a company.</li>
          </ul>
        </AdminStatCard>
        <AdminStatCard
          label="Workflow"
          className="sm:col-span-2"
          description="Create a company, then add dashboards and assign users to grant access."
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.6fr]">
        <form
          action={companyCreateAction}
          className={`${ADMIN_FORM_PANEL} flex flex-col gap-4`}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Create company</h3>
            <span className={ADMIN_LABEL}>Required *</span>
          </div>
          <label className={ADMIN_LABEL}>
            Company name *
            <input
              name="companyName"
              placeholder="Acme Corp"
              className={`mt-2 w-full ${ADMIN_INPUT}`}
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={`text-xs ${ADMIN_TEXT_MUTED}`}>Companies determine dashboard availability.</p>
            <button type="submit" className={ADMIN_PRIMARY_BUTTON}>
              Add company
            </button>
          </div>
          <StatusMessage state={companyCreateState} />
        </form>

        <AdminPanel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Manage companies</h3>
              <p className={`mt-1 text-sm ${ADMIN_TEXT_MUTED}`}>
                Update names and remove unused companies.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-4">
            {companies.length === 0 ? (
              <p className={`text-sm ${ADMIN_TEXT_MUTED}`}>No companies yet.</p>
            ) : (
              <div className="grid gap-4">
                {companies.map((company) => (
                  <CompanyRow key={company.id} company={company} action={manageCompanyAction} />
                ))}
              </div>
            )}
          </div>
        </AdminPanel>
      </div>
    </AdminSection>
  );
}

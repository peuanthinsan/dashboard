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
      className={`${ADMIN_ROW_CARD} flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end`}
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
        kicker="Company setup"
        title="Companies"
        description="Create and manage company profiles that map to dashboard access."
        badgeText={`${totalCompanies} total`}
      />

      <AdminStatGrid>
        <AdminStat
          label="Total companies"
          value={totalCompanies}
          description="Active company profiles in the system."
        />
        <AdminListCard
          title="Quick tips"
          items={['Use short, human-friendly names for reporting.', 'Assign dashboards after creating a company.']}
          variant="gradient"
        />
        <AdminNoteCard title="Workflow" className="sm:col-span-2">
          Create a company, then add dashboards and assign users to grant access.
        </AdminNoteCard>
      </AdminStatGrid>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.6fr]">
        <form
          action={companyCreateAction}
          className="flex flex-col gap-4 rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm dark:border-slate-800/70 dark:from-slate-950/70 dark:to-slate-950/30"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Create company</h3>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Required *</span>
          </div>
          <label className={ADMIN_LABEL}>
            Company name *
            <input
              name="companyName"
              placeholder="Acme Corp"
              className={`mt-2 w-full ${ADMIN_INPUT_WITH_PLACEHOLDER}`}
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={ADMIN_LABEL}>Companies determine dashboard availability.</p>
            <button type="submit" className={ADMIN_PRIMARY_BUTTON}>
              Add company
            </button>
          </div>
          <StatusMessage state={companyCreateState} />
        </form>

        <AdminCard className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Manage companies</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Update names and remove unused companies.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-4">
            {companies.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No companies yet.</p>
            ) : (
              <div className="grid gap-4">
                {companies.map((company) => (
                  <CompanyRow key={company.id} company={company} action={manageCompanyAction} />
                ))}
              </div>
            )}
          </div>
        </AdminCard>
      </div>
    </AdminSection>
  );
}

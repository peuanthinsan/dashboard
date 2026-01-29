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
  ADMIN_TEXT_MUTED,
  ADMIN_TEXT_SUBTLE,
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
  const [isOpen, setIsOpen] = useState(false);
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
            {company.name ?? 'Unnamed company'}
          </div>
          <div className="mt-1 text-xs text-slate-500">ID {company.id}</div>
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
        title="Edit company"
        description="Update the company name or remove unused entries."
      >
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="companyId" value={company.id} />
          <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
            Company name
            <input name="companyName" defaultValue={company.name ?? ''} className={ADMIN_INPUT} />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <StatusMessage state={state} />
            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" name="intent" value="save" className={ADMIN_SAVE_BUTTON}>
                Save changes
              </button>
              <ConfirmDeleteDialog
                title="Delete company"
                description="This will permanently delete the company record."
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
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  useRefreshOnSuccess(companyCreateState);

  useEffect(() => {
    if (companyCreateState.status === 'success') {
      setIsCreateOpen(false);
    }
  }, [companyCreateState.status]);

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
          descriptionTone="muted"
        />
      </div>

      <div className="grid gap-6">
        <AdminPanel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Manage companies</h3>
              <p className={`mt-1 text-sm ${ADMIN_TEXT_SUBTLE}`}>
                Update names and remove unused companies.
              </p>
            </div>
            <button type="button" onClick={() => setIsCreateOpen(true)} className={ADMIN_PRIMARY_BUTTON}>
              Create company
            </button>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/60">
            <div className="max-h-[32rem] overflow-auto">
              <table className="min-w-full border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Company</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => (
                    <CompanyRow key={company.id} company={company} action={manageCompanyAction} />
                  ))}
                </tbody>
              </table>
            </div>
            {companies.length === 0 ? (
              <p className={`px-4 py-6 text-sm ${ADMIN_TEXT_SUBTLE}`}>
                No companies yet. Create one to begin assigning dashboards.
              </p>
            ) : null}
          </div>
        </AdminPanel>
      </div>

      <AdminModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create company"
        description="Add a new company profile for dashboards and access rules."
      >
        <form action={companyCreateAction} className="grid gap-4">
          <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
            Company name *
            <input name="companyName" placeholder="Acme Corp" className={ADMIN_INPUT} />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={`text-xs ${ADMIN_TEXT_SUBTLE}`}>Companies determine dashboard availability.</p>
            <button type="submit" className={ADMIN_PRIMARY_BUTTON}>
              Create company
            </button>
          </div>
          <StatusMessage state={companyCreateState} />
        </form>
      </AdminModal>
    </AdminSection>
  );
}

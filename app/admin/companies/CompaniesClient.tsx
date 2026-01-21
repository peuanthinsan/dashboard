'use client';

import { useFormState } from 'react-dom';
import { INITIAL_STATE, StatusMessage, useRefreshOnSuccess } from '../admin-client-utils';
import ConfirmDeleteDialog from '../ConfirmDeleteDialog';
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
      className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <input type="hidden" name="companyId" value={company.id} />
      <div className="flex w-full flex-col gap-2 sm:flex-1">
        <label className="text-xs text-slate-400">Company name</label>
        <input
          name="companyName"
          defaultValue={company.name ?? ''}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
        />
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <button
          type="submit"
          name="intent"
          value="save"
          className="w-full rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-white hover:border-slate-500 sm:w-auto"
        >
          Save
        </button>
        <ConfirmDeleteDialog
          title="Delete company"
          description="This will permanently delete the company record."
          triggerClassName="w-full rounded-lg border border-rose-500/50 px-3 py-2 text-sm font-semibold text-rose-200 hover:border-rose-400 sm:w-auto"
          confirmClassName="w-full rounded-lg border border-rose-500/50 px-3 py-2 text-sm font-semibold text-rose-200 hover:border-rose-400 sm:w-auto"
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
  const [companyCreateState, companyCreateAction] = useFormState(
    addCompanyAction,
    INITIAL_STATE,
  );
  useRefreshOnSuccess(companyCreateState);

  return (
    <section className="grid gap-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg sm:p-6">
      <form
        action={companyCreateAction}
        className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <h2 className="text-lg font-medium">Create company</h2>
        <div className="flex w-full flex-col gap-3 sm:flex-1 sm:flex-row sm:items-end">
          <input
            name="companyName"
            placeholder="Acme Corp"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400 sm:w-auto"
          >
            Add company
          </button>
        </div>
        <StatusMessage state={companyCreateState} />
      </form>

      <div className="flex flex-col gap-3">
        <h3 className="text-base font-medium">Manage companies</h3>
        {companies.length === 0 ? (
          <p className="text-sm text-slate-400">No companies yet.</p>
        ) : (
          <div className="grid gap-4">
            {companies.map((company) => (
              <CompanyRow key={company.id} company={company} action={manageCompanyAction} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

'use client';

import { useFormState } from 'react-dom';
import { confirmDelete, INITIAL_STATE, StatusMessage, useRefreshOnSuccess } from '../admin-client-utils';
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
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="companyId" value={company.id} />
      <div className="flex flex-1 flex-col gap-2">
        <label className="text-xs text-slate-400">Company name</label>
        <input
          name="companyName"
          defaultValue={company.name ?? ''}
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
        className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4"
      >
        <h2 className="text-lg font-medium">Create company</h2>
        <input
          name="companyName"
          placeholder="Acme Corp"
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
        />
        <button
          type="submit"
          className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
        >
          Add company
        </button>
        <StatusMessage state={companyCreateState} />
      </form>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <h3 className="text-base font-medium">Manage companies</h3>
        {companies.length === 0 ? (
          <p className="text-sm text-slate-400">No companies yet.</p>
        ) : (
          companies.map((company) => (
            <CompanyRow key={company.id} company={company} action={manageCompanyAction} />
          ))
        )}
      </div>
    </section>
  );
}

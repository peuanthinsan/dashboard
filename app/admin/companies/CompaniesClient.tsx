'use client';

import { useFormState } from 'react-dom';
import { INITIAL_STATE, StatusMessage, useRefreshOnSuccess } from '../admin-client-utils';
import ConfirmDeleteDialog from '../ConfirmDeleteDialog';
import { ADMIN_DELETE_BUTTON, ADMIN_PRIMARY_BUTTON, ADMIN_SAVE_BUTTON } from '../admin-ui';
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
      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/60 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <input type="hidden" name="companyId" value={company.id} />
      <div className="flex w-full flex-col gap-2 sm:flex-1">
        <label className="text-xs text-slate-500 dark:text-slate-400">Company name</label>
        <input
          name="companyName"
          defaultValue={company.name ?? ''}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
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
  const [companyCreateState, companyCreateAction] = useFormState(
    addCompanyAction,
    INITIAL_STATE,
  );
  useRefreshOnSuccess(companyCreateState);

  return (
    <section className="grid gap-6 rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/70">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            Company setup
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">Companies</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Create and manage company profiles that map to dashboard access.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
          {companies.length} total
        </span>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.6fr]">
        <form
          action={companyCreateAction}
          className="flex flex-col gap-4 rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/60"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Create company</h3>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Required *</span>
          </div>
          <label className="text-xs text-slate-500 dark:text-slate-400">
            Company name *
            <input
              name="companyName"
              placeholder="Acme Corp"
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Companies determine dashboard availability.
            </p>
            <button type="submit" className={ADMIN_PRIMARY_BUTTON}>
              Add company
            </button>
          </div>
          <StatusMessage state={companyCreateState} />
        </form>

        <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/60">
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
              companies.map((company) => (
                <CompanyRow key={company.id} company={company} action={manageCompanyAction} />
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import {
  CompanyRow,
  INITIAL_STATE,
  OrganizationRow,
  StatusMessage,
  useRefreshOnSuccess,
  type ActionState,
  type Company,
  type FormAction,
  type Organization,
} from '../components/AdminShared';

type AdminCompaniesClientProps = {
  companies: Company[];
  organizations: Organization[];
  addCompanyAction: FormAction;
  manageCompanyAction: FormAction;
  addOrganizationAction: FormAction;
  manageOrganizationAction: FormAction;
};

export default function AdminCompaniesClient({
  companies,
  organizations,
  addCompanyAction,
  manageCompanyAction,
  addOrganizationAction,
  manageOrganizationAction,
}: AdminCompaniesClientProps) {
  const [companyCreateState, companyCreateAction] = useFormState(
    addCompanyAction,
    INITIAL_STATE,
  );
  const [organizationCreateState, organizationCreateAction] = useFormState(
    addOrganizationAction,
    INITIAL_STATE,
  );

  useRefreshOnSuccess(companyCreateState);
  useRefreshOnSuccess(organizationCreateState);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <Link
            href="/admin"
            className="inline-flex w-fit items-center gap-2 text-sm text-slate-300 transition hover:text-white"
          >
            <span aria-hidden="true">←</span>
            Back to admin home
          </Link>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold">Companies & organizations</h1>
            <p className="text-sm text-slate-300">
              Create and update the top-level entities available across dashboards.
            </p>
          </div>
          <nav className="flex flex-wrap gap-3 text-sm text-slate-300">
            <Link href="/admin/companies" className="text-white">
              Companies
            </Link>
            <span aria-hidden="true">•</span>
            <Link href="/admin/users" className="hover:text-white">
              Users
            </Link>
            <span aria-hidden="true">•</span>
            <Link href="/admin/dashboards" className="hover:text-white">
              Dashboards
            </Link>
          </nav>
        </header>

        <section className="grid gap-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
          <div className="grid gap-4 md:grid-cols-2">
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
              <StatusMessage state={companyCreateState as ActionState} />
            </form>

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
              <StatusMessage state={organizationCreateState as ActionState} />
            </form>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
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
          </div>
        </section>
      </div>
    </div>
  );
}

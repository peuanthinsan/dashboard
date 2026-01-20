import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from 'app/auth';
import { getDashboards, getDashboardsForUser, getOrganizations, getCompanies, getUser } from 'app/db';
import { buildSheetUrl } from 'app/utils/googleSheet';

export default async function DashboardIndexPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/login');
  }

  const currentUser = await getUser(session.user.email);
  if (currentUser.length === 0) {
    redirect('/login');
  }

  const user = currentUser[0];
  const [companies, organizations] = await Promise.all([getCompanies(), getOrganizations()]);
  const dashboards = user.isAdmin
    ? await getDashboards()
    : await getDashboardsForUser(user.companyId ?? null, user.organizationId ?? null);

  const companyName = companies.find((company) => company.id === user.companyId)?.name ?? 'Unassigned company';
  const organizationName =
    organizations.find((organization) => organization.id === user.organizationId)?.name ?? 'Unassigned organization';
  const companyLookup = new Map(companies.map((company) => [company.id, company.name]));
  const organizationLookup = new Map(organizations.map((organization) => [organization.id, organization.name]));

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Dashboards</p>
          <h1 className="text-3xl font-semibold">Safety dashboards</h1>
          <p className="text-sm text-slate-300">
            {user.isAdmin
              ? 'Showing all dashboards. Admins can see every dashboard configured in the system.'
              : `Dashboards assigned to ${companyName} · ${organizationName}.`}
          </p>
        </header>

        {dashboards.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <p className="text-sm text-slate-300">
              No dashboards are available yet. Ask an admin to assign one to your company and organization.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {dashboards.map((dashboard) => {
              const companyLabel =
                dashboard.companyId != null
                  ? companyLookup.get(dashboard.companyId) ?? `Company #${dashboard.companyId}`
                  : 'Unassigned company';
              const organizationLabel =
                dashboard.organizationId != null
                  ? organizationLookup.get(dashboard.organizationId) ?? `Organization #${dashboard.organizationId}`
                  : 'Unassigned organization';
              const sheetReference =
                dashboard.sheetId && dashboard.sheetGid
                  ? buildSheetUrl(dashboard.sheetId, dashboard.sheetGid)
                  : 'No sheet linked';
              return (
              <Link
                key={dashboard.id}
                href={`/dashboard/${dashboard.id}`}
                className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition hover:border-indigo-400/60"
              >
                <div className="flex flex-col gap-2">
                  <h2 className="text-lg font-semibold text-white group-hover:text-indigo-200">
                    {dashboard.name}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {companyLabel} · {organizationLabel}
                  </p>
                  <p className="text-xs text-slate-400">Linked sheet</p>
                  <p className="text-sm text-slate-200">
                    {sheetReference}
                  </p>
                </div>
              </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

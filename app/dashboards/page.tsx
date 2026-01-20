import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from 'app/auth';
import { getCompanies, getDashboardsForUser, getOrganizations, getUser } from 'app/db';

export default async function DashboardsPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/login');
  }

  const userRows = await getUser(session.user.email);
  if (userRows.length === 0) {
    redirect('/login');
  }
  const user = userRows[0];

  const [dashboards, companies, organizations] = await Promise.all([
    getDashboardsForUser(user),
    getCompanies(),
    getOrganizations(),
  ]);

  const companyMap = new Map(companies.map((company) => [company.id, company.name]));
  const organizationMap = new Map(organizations.map((organization) => [organization.id, organization.name]));

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold">Dashboards</h1>
          <p className="text-sm text-slate-300">
            Select a dashboard assigned to your company and organization.
          </p>
        </header>

        {dashboards.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
            No dashboards are available yet. Reach out to an administrator to add one.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {dashboards.map((dashboard) => (
              <Link
                key={dashboard.id}
                href={`/dashboards/${dashboard.id}`}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition hover:border-slate-600"
              >
                <div className="flex flex-col gap-2">
                  <span className="text-lg font-semibold">{dashboard.name}</span>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                    <span className="rounded-full border border-slate-700 px-2 py-1">
                      {companyMap.get(dashboard.companyId) ?? 'Company'}
                    </span>
                    {dashboard.organizationId ? (
                      <span className="rounded-full border border-slate-700 px-2 py-1">
                        {organizationMap.get(dashboard.organizationId) ?? 'Organization'}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-xs text-slate-400 truncate">{dashboard.sheetUrl}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

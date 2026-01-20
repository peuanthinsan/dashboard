import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from 'app/auth';
import { getDashboards, getUser } from 'app/db';

export default async function DashboardsPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/login');
  }

  const currentUser = await getUser(session.user.email);
  if (currentUser.length === 0) {
    redirect('/login');
  }
  const user = currentUser[0];
  const dashboards = await getDashboards();

  const visibleDashboards = user.isAdmin
    ? dashboards
    : dashboards.filter((dashboard) => {
        if (dashboard.companyId !== user.companyId) {
          return false;
        }
        if (dashboard.organizationId == null) {
          return true;
        }
        return dashboard.organizationId === user.organizationId;
      });

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold">Dashboards</h1>
          <p className="text-sm text-slate-300">
            Open dashboards that are assigned to your company and organization.
          </p>
        </header>

        {visibleDashboards.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
            No dashboards are available yet. Contact an administrator to provision a dashboard for your team.
          </div>
        ) : (
          <div className="grid gap-4">
            {visibleDashboards.map((dashboard) => (
              <Link
                key={dashboard.id}
                href={`/dashboards/${dashboard.id}`}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition hover:border-indigo-400"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-semibold">{dashboard.name}</h2>
                    <span className="rounded-full border border-indigo-400/60 px-3 py-1 text-xs uppercase tracking-wide text-indigo-200">
                      {dashboard.template}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400">
                    Company #{dashboard.companyId}
                    {dashboard.organizationId ? ` • Organization #${dashboard.organizationId}` : ' • All organizations'}
                  </p>
                  <p className="text-xs text-slate-500 break-all">Sheet: {dashboard.sheetUrl}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

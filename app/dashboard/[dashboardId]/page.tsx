import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from 'app/auth';
import { getCompanies, getDashboardById, getOrganizations, getUser } from 'app/db';
import DashboardClient from './DashboardClient';

export default async function DashboardPage({ params }: { params: { dashboardId: string } }) {
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/login');
  }

  const currentUser = await getUser(session.user.email);
  if (currentUser.length === 0) {
    redirect('/login');
  }
  const user = currentUser[0];
  const dashboardId = Number(params.dashboardId);
  if (Number.isNaN(dashboardId)) {
    redirect('/dashboard');
  }

  const dashboardRecords = await getDashboardById(dashboardId);
  if (dashboardRecords.length === 0) {
    redirect('/dashboard');
  }
  const dashboard = dashboardRecords[0];
  const [companies, organizations] = await Promise.all([getCompanies(), getOrganizations()]);
  const companyName = companies.find((company) => company.id === dashboard.companyId)?.name ?? 'Unknown company';
  const organizationName =
    dashboard.organizationId == null
      ? 'All organizations'
      : organizations.find((organization) => organization.id === dashboard.organizationId)?.name ??
        'Unknown organization';

  const isAuthorized =
    user.isAdmin ||
    (user.companyId === dashboard.companyId &&
      (dashboard.organizationId == null || user.organizationId === dashboard.organizationId));

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h1 className="text-xl font-semibold">Dashboard access required</h1>
          <p className="text-sm text-slate-300">
            You do not have access to this dashboard. Contact an administrator to update your company or organization
            assignment.
          </p>
          <Link
            href="/dashboard"
            className="w-fit rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-white hover:border-slate-500"
          >
            Back to dashboards
          </Link>
        </div>
      </div>
    );
  }

  if (!dashboard.sheetId || !dashboard.sheetGid) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h1 className="text-xl font-semibold">Dashboard setup incomplete</h1>
          <p className="text-sm text-slate-300">
            This dashboard is missing a Google Sheet reference. Ask an administrator to update the dashboard settings.
          </p>
          <Link
            href="/dashboard"
            className="w-fit rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-white hover:border-slate-500"
          >
            Back to dashboards
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <Link href="/dashboard" className="text-xs font-semibold text-slate-400 hover:text-slate-200">
            ← Back to dashboards
          </Link>
          <h1 className="text-3xl font-semibold">{dashboard.name}</h1>
          <p className="text-sm text-slate-300">
            Viewing alerts for {companyName} · {organizationName}
          </p>
        </header>

        <DashboardClient sheetId={dashboard.sheetId} gid={dashboard.sheetGid} />
      </div>
    </div>
  );
}

import { notFound, redirect } from 'next/navigation';
import { auth } from 'app/auth';
import { getCompanies, getDashboardById, getOrganizations, getUser } from 'app/db';
import DashboardClient from './dashboard-client';

type DashboardPageProps = {
  params: { dashboardId: string };
};

export default async function DashboardPage({ params }: DashboardPageProps) {
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/login');
  }

  const userRows = await getUser(session.user.email);
  if (userRows.length === 0) {
    redirect('/login');
  }
  const user = userRows[0];

  const dashboardId = Number(params.dashboardId);
  if (Number.isNaN(dashboardId)) {
    notFound();
  }

  const dashboardRows = await getDashboardById(dashboardId);
  if (dashboardRows.length === 0) {
    notFound();
  }
  const dashboard = dashboardRows[0];

  if (!user.isAdmin) {
    if (!user.companyId || dashboard.companyId !== user.companyId) {
      redirect('/dashboards');
    }
    if (dashboard.organizationId && dashboard.organizationId !== user.organizationId) {
      redirect('/dashboards');
    }
  }

  const [companies, organizations] = await Promise.all([getCompanies(), getOrganizations()]);
  const companyName = companies.find((company) => company.id === dashboard.companyId)?.name ?? null;
  const organizationName = dashboard.organizationId
    ? organizations.find((organization) => organization.id === dashboard.organizationId)?.name ?? null
    : null;

  return (
    <DashboardClient
      title={dashboard.name}
      description="Monitor alert volume by vehicle, date, fleet, alert type, and remarks for the video telemetry feed."
      sheetId={dashboard.sheetId}
      sheetGid={dashboard.sheetGid ?? '0'}
      sheetUrl={dashboard.sheetUrl}
      companyName={companyName}
      organizationName={organizationName}
    />
  );
}

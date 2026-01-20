import { notFound, redirect } from 'next/navigation';
import { auth } from 'app/auth';
import { getDashboardById, getUser } from 'app/db';
import DetailDashboard from 'app/components/dashboards/DetailDashboard';
import SimpleDashboard from 'app/components/dashboards/SimpleDashboard';
import SummaryDashboard from 'app/components/dashboards/SummaryDashboard';

type DashboardPageProps = {
  params: { dashboardId: string };
};

export default async function DashboardPage({ params }: DashboardPageProps) {
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/login');
  }

  const dashboardId = Number(params.dashboardId);
  if (!Number.isFinite(dashboardId)) {
    notFound();
  }

  const userRows = await getUser(session.user.email);
  if (userRows.length === 0) {
    redirect('/login');
  }
  const user = userRows[0];

  const dashboards = await getDashboardById(dashboardId);
  if (dashboards.length === 0) {
    notFound();
  }
  const dashboard = dashboards[0];

  if (!user.isAdmin) {
    if (dashboard.companyId !== user.companyId) {
      redirect('/dashboards');
    }
    if (dashboard.organizationId && dashboard.organizationId !== user.organizationId) {
      redirect('/dashboards');
    }
  }

  const props = { title: dashboard.name, sheetUrl: dashboard.sheetUrl };

  switch (dashboard.template) {
    case 'Summary':
      return <SummaryDashboard {...props} />;
    case 'Simple':
      return <SimpleDashboard {...props} />;
    case 'Detail':
      return <DetailDashboard {...props} />;
    default:
      notFound();
  }
}

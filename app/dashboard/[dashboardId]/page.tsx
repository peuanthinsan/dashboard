import { redirect } from 'next/navigation';
import { auth } from 'app/auth';
import { getDashboardForUserById, getUser } from 'app/db';
import DetailDashboard from '../templates/DetailDashboard';
import SimpleDashboard from '../templates/SimpleDashboard';
import SummaryDashboard from '../templates/SummaryDashboard';

type DashboardPageProps = {
  params: { dashboardId: string };
};

export default async function DashboardPage({ params }: DashboardPageProps) {
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/login');
  }

  const currentUser = await getUser(session.user.email);
  if (currentUser.length === 0) {
    redirect('/protected');
  }
  const user = currentUser[0];
  const dashboardId = Number(params.dashboardId);
  if (Number.isNaN(dashboardId)) {
    redirect('/dashboard');
  }
  const dashboards = await getDashboardForUserById(dashboardId, {
    companyId: user.companyId,
    organizationId: user.organizationId,
  });
  if (dashboards.length === 0) {
    redirect('/dashboard');
  }
  const dashboard = dashboards[0];
  const dashboardName = dashboard.name ?? 'Dashboard';
  const sheetUrl = dashboard.sheetUrl ?? '';
  if (!sheetUrl) {
    redirect('/dashboard');
  }

  if (dashboard.template === 'Detail') {
    return <DetailDashboard name={dashboardName} sheetUrl={sheetUrl} />;
  }
  if (dashboard.template === 'Simple') {
    return <SimpleDashboard name={dashboardName} sheetUrl={sheetUrl} />;
  }
  return <SummaryDashboard name={dashboardName} sheetUrl={sheetUrl} />;
}

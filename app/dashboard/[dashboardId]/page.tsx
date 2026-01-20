import { redirect } from 'next/navigation';
import { auth } from 'app/auth';
import { getDashboardById, getUser } from 'app/db';
import { dashboardTemplates } from 'app/dashboard/constants';
import DashboardView from 'app/dashboard/dashboard-view';
import { parseCsv, toCsvExportUrl } from 'app/dashboard/utils';

type DashboardPageProps = {
  params: { dashboardId: string };
};

export default async function DashboardPage({ params }: DashboardPageProps) {
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/login');
  }

  const user = await getUser(session.user.email);
  if (user.length === 0) {
    redirect('/protected');
  }

  const dashboardId = Number(params.dashboardId);
  if (Number.isNaN(dashboardId)) {
    redirect('/dashboard');
  }

  const dashboard = await getDashboardById(dashboardId);
  if (dashboard.length === 0) {
    redirect('/dashboard');
  }

  const currentDashboard = dashboard[0];
  if (!user[0].companyId || user[0].companyId !== currentDashboard.companyId) {
    redirect('/dashboard');
  }
  if (
    currentDashboard.organizationId &&
    user[0].organizationId !== currentDashboard.organizationId
  ) {
    redirect('/dashboard');
  }

  const template = dashboardTemplates.includes(currentDashboard.template as any)
    ? (currentDashboard.template as (typeof dashboardTemplates)[number])
    : 'Summary';

  let data;
  try {
    const response = await fetch(toCsvExportUrl(currentDashboard.sheetUrl), {
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error('Failed to fetch sheet');
    }
    const text = await response.text();
    data = parseCsv(text);
  } catch (error) {
    data = { headers: [], rows: [] };
  }

  return (
    <DashboardView
      template={template}
      title={currentDashboard.name}
      data={data}
      lastUpdatedLabel={new Date().toLocaleString()}
    />
  );
}

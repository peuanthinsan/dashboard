import { notFound, redirect } from 'next/navigation';
import { auth } from 'app/auth';
import { getDashboardById, getUser } from 'app/db';
import DetailDashboard from 'app/dashboards/DetailDashboard';
import SimpleDashboard from 'app/dashboards/SimpleDashboard';
import SummaryDashboard from 'app/dashboards/SummaryDashboard';

const resolveTemplate = (template: string | null) => {
  switch (template) {
    case 'Summary':
      return SummaryDashboard;
    case 'Detail':
      return DetailDashboard;
    case 'Simple':
      return SimpleDashboard;
    default:
      return SummaryDashboard;
  }
};

export default async function DashboardPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/login');
  }

  const user = await getUser(session.user.email);
  if (user.length === 0) {
    redirect('/login');
  }

  const dashboardId = Number(params.id);
  if (!dashboardId) {
    notFound();
  }

  const dashboardResult = await getDashboardById(dashboardId);
  if (dashboardResult.length === 0) {
    notFound();
  }
  const dashboard = dashboardResult[0];

  const userCompanyIds = user[0].companyIds ?? [];
  const userOrganizationIds = user[0].organizationIds ?? [];
  const matchesCompany = userCompanyIds.includes(dashboard.companyId ?? -1);
  const matchesOrganization =
    !dashboard.organizationId || userOrganizationIds.includes(dashboard.organizationId);

  if (!matchesCompany || !matchesOrganization) {
    redirect('/protected');
  }

  const Template = resolveTemplate(dashboard.template ?? null);

  return (
    <Template
      dashboardName={dashboard.name ?? 'Company dashboard'}
      sheetId={dashboard.sheetId ?? ''}
      sheetGid={dashboard.sheetGid ?? '0'}
    />
  );
}

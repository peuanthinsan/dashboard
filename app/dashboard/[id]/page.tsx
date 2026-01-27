import { notFound, redirect } from 'next/navigation';
import { auth } from 'app/auth';
import { getDashboardByPublicId, getOrganizationById, getUser } from 'app/db';
import DetailDashboard from 'app/dashboards/DetailDashboard';
import SimpleDashboard from 'app/dashboards/SimpleDashboard';
import SummaryDashboard from 'app/dashboards/SummaryDashboard';
import VideoSamplesDashboard from 'app/dashboards/VideoSamplesDashboard';

const resolveTemplate = (template: string | null) => {
  switch (template) {
    case 'Summary':
      return SummaryDashboard;
    case 'Detail':
      return DetailDashboard;
    case 'Simple':
      return SimpleDashboard;
    case 'Video Samples':
      return VideoSamplesDashboard;
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

  const dashboardResult = await getDashboardByPublicId(params.id);
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
    redirect('/dashboard');
  }

  let organizationName: string | null = null;
  if (dashboard.organizationId) {
    const organizationResult = await getOrganizationById(dashboard.organizationId);
    organizationName = organizationResult[0]?.name ?? null;
  }

  const Template = resolveTemplate(dashboard.template ?? null);

  return (
    <Template
      dashboardId={params.id}
      dashboardName={dashboard.name ?? 'Company dashboard'}
      sheetId={dashboard.sheetId ?? ''}
      sheetGid={dashboard.sheetGid ?? '0'}
      organizationName={organizationName}
      dashboardNotes={dashboard.notes ?? null}
    />
  );
}

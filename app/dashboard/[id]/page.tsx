import { notFound, redirect } from 'next/navigation';
import { auth } from 'app/auth';
import { getDashboardByPublicId, getOrganizationById, getUser } from 'app/db';
import DetailDashboard from 'app/dashboards/DetailDashboard';
import DrivingDashboard from 'app/dashboards/DrivingDashboard';
import SimpleDashboard from 'app/dashboards/SimpleDashboard';
import SummaryDashboard from 'app/dashboards/SummaryDashboard';
import { resolveTemplate as resolveTemplateName } from 'app/dashboards/dashboardDataUtils';
import { getDashboardLang } from '../i18n';

const templateComponents: Record<string, typeof SummaryDashboard> = {
  Summary: SummaryDashboard,
  Detail: DetailDashboard,
  Simple: SimpleDashboard,
  Driving: DrivingDashboard,
};

const getTemplate = (template: string | null) => {
  const resolved = resolveTemplateName(template ?? 'Summary');
  return templateComponents[resolved] ?? SummaryDashboard;
};

export default async function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const lang = await getDashboardLang();
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/login');
  }

  const user = await getUser(session.user.email);
  if (user.length === 0) {
    redirect('/login');
  }

  const { id } = await params;
  const dashboardResult = await getDashboardByPublicId(id);
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

  const Template = getTemplate(dashboard.template ?? null);
  const allowedAlertTypes = (dashboard as { alertTypes?: string[] | null }).alertTypes ?? null;
  const allowedRemarks = (dashboard as { remarks?: string[] | null }).remarks ?? null;

  return (
    <Template
      lang={lang}
      dashboardId={id}
      dashboardName={dashboard.name ?? 'Company dashboard'}
      sheetId={dashboard.sheetId ?? ''}
      sheetGid={dashboard.sheetGid ?? '0'}
      dashboardNotes={dashboard.notes ?? null}
      organizationName={organizationName}
      allowedAlertTypes={allowedAlertTypes}
      allowedRemarks={allowedRemarks}
    />
  );
}

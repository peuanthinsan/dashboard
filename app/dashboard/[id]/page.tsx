import type { Metadata } from 'next';
import type { ComponentProps } from 'react';
import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { auth } from 'app/auth';
import { getDashboardByPublicId, getOrganizationById, getUser } from 'app/db';
import DetailDashboard from 'app/dashboards/DetailDashboard';
import DrivingDashboard from 'app/dashboards/DrivingDashboard';
import OverSpeedDashboard from 'app/dashboards/OverSpeedDashboard';
import SimpleDashboard from 'app/dashboards/SimpleDashboard';
import SummaryDashboard from 'app/dashboards/SummaryDashboard';
import LoadingState from 'app/dashboards/LoadingState';
import { resolveTemplate as resolveTemplateName } from 'app/dashboards/dashboardDataUtils';
import { normalizeDrivingThresholds, type DrivingThresholds } from 'app/dashboards/drivingThresholds';
import { getDashboardLang } from '../i18n';
import { pageContent } from 'app/ui/design-tokens';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.email) {
    return { title: 'Dashboard | SongdeeGPS' };
  }
  const user = await getUser(session.user.email);
  if (user.length === 0) {
    return { title: 'Dashboard | SongdeeGPS' };
  }
  const result = await getDashboardByPublicId(id);
  if (result.length === 0) {
    return { title: 'Dashboard | SongdeeGPS' };
  }
  const dashboard = result[0];
  const userCompanyIds = user[0].companyIds ?? [];
  const userOrganizationIds = user[0].organizationIds ?? [];
  const matchesCompany = userCompanyIds.includes(dashboard.companyId ?? -1);
  const matchesOrganization =
    !dashboard.organizationId || userOrganizationIds.includes(dashboard.organizationId);
  if (!matchesCompany || !matchesOrganization) {
    return { title: 'Dashboard | SongdeeGPS' };
  }
  const name = dashboard.name ?? 'Dashboard';
  return {
    title: `${name} | SongdeeGPS`,
    openGraph: { title: `${name} | SongdeeGPS` },
  };
}

type DashboardViewProps = ComponentProps<typeof SummaryDashboard>;

type DashboardByTemplateProps = DashboardViewProps & {
  template: string | null;
  drivingThresholds?: DrivingThresholds;
};

function DashboardByTemplate({ template, drivingThresholds, ...props }: DashboardByTemplateProps) {
  const name = resolveTemplateName(template ?? 'Summary');
  switch (name) {
    case 'Detail':
      return <DetailDashboard {...props} />;
    case 'Simple':
      return <SimpleDashboard {...props} />;
    case 'Driving':
      return <DrivingDashboard {...props} drivingThresholds={drivingThresholds} />;
    case 'OverSpeed':
      return <OverSpeedDashboard {...props} />;
    case 'Summary':
    default:
      return <SummaryDashboard {...props} />;
  }
}

async function DashboardContent({
  id,
  userCompanyIds,
  userOrganizationIds,
  lang,
}: {
  id: string;
  userCompanyIds: number[];
  userOrganizationIds: number[];
  lang: string;
}) {
  const dashboardResult = await getDashboardByPublicId(id);
  if (dashboardResult.length === 0) {
    notFound();
  }
  const dashboard = dashboardResult[0];

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

  const allowedAlertTypes = (dashboard as { alertTypes?: string[] | null }).alertTypes ?? null;
  const allowedRemarks = (dashboard as { remarks?: string[] | null }).remarks ?? null;
  const drivingThresholds = normalizeDrivingThresholds(
    (dashboard as { drivingThresholds?: unknown }).drivingThresholds,
  );

  return (
    <DashboardByTemplate
      template={dashboard.template ?? null}
      lang={lang as 'en' | 'th'}
      dashboardId={id}
      dashboardName={dashboard.name ?? 'Company dashboard'}
      sheetId={dashboard.sheetId ?? ''}
      sheetGid={dashboard.sheetGid ?? '0'}
      dashboardNotes={dashboard.notes ?? null}
      organizationName={organizationName}
      allowedAlertTypes={allowedAlertTypes}
      allowedRemarks={allowedRemarks}
      drivingThresholds={drivingThresholds}
    />
  );
}

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
  const userCompanyIds = user[0].companyIds ?? [];
  const userOrganizationIds = user[0].organizationIds ?? [];

  return (
    <Suspense
      fallback={
        <div className={pageContent}>
          <LoadingState />
        </div>
      }
    >
      <DashboardContent
        id={id}
        userCompanyIds={userCompanyIds}
        userOrganizationIds={userOrganizationIds}
        lang={lang}
      />
    </Suspense>
  );
}

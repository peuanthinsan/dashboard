import type { Metadata } from 'next';
import type { ComponentProps } from 'react';
import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { auth } from 'app/auth';
import {
  getDashboardByPublicId,
  getOrganizationById,
  getUser,
  getCompanyById,
  listLineChannelsByOrganization,
  getWarningsForDashboard,
} from 'app/db';
import DetailDashboard from 'app/dashboards/DetailDashboard';
import DrivingDashboard from 'app/dashboards/DrivingDashboard';
import DynamicTripDashboard from 'app/dashboards/DynamicTripDashboard';
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
  isAdmin?: boolean;
  lineChannels?: { id: number; name: string }[];
  defaultLineChannelId?: number | null;
  warnings?: Array<{ violationKey: string; sentAt: Date; channelName: string }>;
};

function DashboardByTemplate({
  template,
  drivingThresholds,
  isAdmin,
  lineChannels,
  defaultLineChannelId,
  warnings,
  ...props
}: DashboardByTemplateProps) {
  const name = resolveTemplateName(template ?? 'Summary');
  switch (name) {
    case 'Detail':
      return <DetailDashboard {...props} isAdmin={isAdmin} />;
    case 'Simple':
      return <SimpleDashboard {...props} isAdmin={isAdmin} />;
    case 'Driving':
      return (
        <DrivingDashboard
          {...props}
          drivingThresholds={drivingThresholds}
          isAdmin={isAdmin}
          lineChannels={lineChannels}
          defaultLineChannelId={defaultLineChannelId}
          warnings={warnings}
        />
      );
    case 'OverSpeed':
      return <OverSpeedDashboard {...props} isAdmin={isAdmin} />;
    case 'DynamicTrip':
      return <DynamicTripDashboard {...props} isAdmin={isAdmin} />;
    case 'Summary':
    default:
      return <SummaryDashboard {...props} isAdmin={isAdmin} />;
  }
}

async function DashboardContent({
  id,
  userCompanyIds,
  userOrganizationIds,
  lang,
  isAdmin,
}: {
  id: string;
  userCompanyIds: number[];
  userOrganizationIds: number[];
  lang: string;
  isAdmin: boolean;
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
  const dashboardAlertRules = (dashboard as { alertRules?: unknown }).alertRules as import('app/dashboards/dashboardDataUtils').AlertRule[] | null ?? null;

  let companyAlertRules: import('app/dashboards/dashboardDataUtils').AlertRule[] | null = null;
  if (dashboard.companyId) {
    const companyResult = await getCompanyById(dashboard.companyId);
    companyAlertRules = (companyResult[0] as { alertRules?: unknown })?.alertRules as import('app/dashboards/dashboardDataUtils').AlertRule[] | null ?? null;
  }

  // Dashboard rules first (higher specificity), company rules as fallback
  const alertRules: import('app/dashboards/dashboardDataUtils').AlertRule[] | null =
    (dashboardAlertRules?.length || companyAlertRules?.length)
      ? [...(dashboardAlertRules ?? []), ...(companyAlertRules ?? [])]
      : null;
  const drivingThresholds = normalizeDrivingThresholds(
    (dashboard as { drivingThresholds?: unknown }).drivingThresholds,
  );

  const lineChannels = dashboard.organizationId
    ? await listLineChannelsByOrganization(dashboard.organizationId)
    : [];
  const warnings = await getWarningsForDashboard({
    dashboardId: dashboard.id,
    windowStart: null,
    windowEnd: null,
  });

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
      alertRules={alertRules}
      drivingThresholds={drivingThresholds}
      isAdmin={isAdmin}
      lineChannels={lineChannels.map((c) => ({ id: c.id, name: c.name }))}
      defaultLineChannelId={dashboard.lineChannelId ?? null}
      warnings={warnings.map((w) => ({
        violationKey: w.violationKey,
        sentAt: w.sentAt!,
        channelName: w.channelName ?? '—',
      }))}
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
  const isAdmin = !!user[0].isAdmin;

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
        isAdmin={isAdmin}
      />
    </Suspense>
  );
}

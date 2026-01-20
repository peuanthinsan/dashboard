import { notFound, redirect } from 'next/navigation';
import { auth } from 'app/auth';
import { getDashboardById, getUser } from 'app/db';
import DashboardRenderer from './DashboardRenderer';
import type { DashboardRecord } from '../types';

type DashboardPageProps = {
  params: { dashboardId: string };
};

const normalizeDashboard = (dashboard: Record<string, unknown>): DashboardRecord => ({
  id: dashboard.id as number,
  name: dashboard.name as string,
  template: dashboard.template as DashboardRecord['template'],
  sheetUrl: dashboard.sheetUrl as string,
  sheetId: dashboard.sheetId as string,
  gid: dashboard.gid as string,
  companyId: dashboard.companyId as number,
  organizationId: (dashboard.organizationId as number | null) ?? null,
});

export default async function DashboardPage({ params }: DashboardPageProps) {
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/login');
  }

  const user = await getUser(session.user.email);
  if (user.length === 0) {
    redirect('/login');
  }

  const dashboardId = Number(params.dashboardId);
  if (Number.isNaN(dashboardId)) {
    notFound();
  }

  const dashboardResult = await getDashboardById(dashboardId);
  if (dashboardResult.length === 0) {
    notFound();
  }

  const dashboard = normalizeDashboard(dashboardResult[0]);
  const viewer = user[0];

  const hasCompanyAccess = viewer.companyId && viewer.companyId === dashboard.companyId;
  const hasOrgAccess =
    !dashboard.organizationId || (viewer.organizationId && viewer.organizationId === dashboard.organizationId);

  if (!viewer.isAdmin && (!hasCompanyAccess || !hasOrgAccess)) {
    redirect('/protected');
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <DashboardRenderer name={dashboard.name} template={dashboard.template} sheetId={dashboard.sheetId} gid={dashboard.gid} />
    </div>
  );
}

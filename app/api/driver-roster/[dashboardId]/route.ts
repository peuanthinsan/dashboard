import { NextResponse } from 'next/server';
import { auth } from 'app/auth';
import { getDashboardByPublicId, getOrganizationById, getUser } from 'app/db';
import { fetchDriverRoster } from 'app/dashboards/driverRosterFetch';
import { filterDriverRoster, validateDriverRosterSettings } from 'app/dashboards/driverRoster';
import { resolveTemplate } from 'app/dashboards/dashboardDataUtils';

export const maxDuration = 60;

export async function GET(request: Request, { params }: { params: Promise<{ dashboardId: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [user] = await getUser(session.user.email);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { dashboardId } = await params;
  const [dashboard] = await getDashboardByPublicId(dashboardId);
  if (!dashboard) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const organizationIds = dashboard.organizationIds?.length ? dashboard.organizationIds : dashboard.organizationId != null ? [dashboard.organizationId] : [];
  if (!(user.companyIds ?? []).includes(dashboard.companyId ?? -1)
    || !organizationIds.every((id) => (user.organizationIds ?? []).includes(id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (resolveTemplate(dashboard.template) !== 'Summary') return NextResponse.json({ error: 'Not a Summary dashboard' }, { status: 400 });
  let settings;
  try { settings = validateDriverRosterSettings(dashboard.driverRosterSettings); }
  catch { return NextResponse.json({ error: 'Ask Admin to configure the driver roster for this dashboard.' }, { status: 422 }); }
  const organizations = await Promise.all(organizationIds.map((id) => getOrganizationById(id)));
  if (organizations.some((items) => !items[0]?.name)) return NextResponse.json({ error: 'Dashboard fleet scope could not be resolved.' }, { status: 503 });
  try {
    const entries = await fetchDriverRoster(settings, request.signal);
    return NextResponse.json({ entries: filterDriverRoster(entries, { fleets: organizations.map((items) => items[0]!.name!) }),
      namePolicy: settings.namePolicy, lastUpdated: Date.now() }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load the driver roster.' }, { status: 502 });
  }
}

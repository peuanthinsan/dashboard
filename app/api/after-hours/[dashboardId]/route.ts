import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { auth } from 'app/auth';
import { getDashboardByPublicId, getOrganizationById, getUser } from 'app/db';
import { isValidSheetGid, isValidSheetId } from 'app/admin/admin-utils';
import { resolveTemplate } from 'app/dashboards/dashboardDataUtils';
import { buildAfterHoursEntries, isEntryRange, validateAfterHoursSettings } from 'app/dashboards/afterHoursEntry';
import { fetchAfterHoursPage } from 'app/dashboards/afterHoursFetch';

export const maxDuration = 60;

export async function GET(request: Request, { params }: { params: Promise<{ dashboardId: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [user] = await getUser(session.user.email);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { dashboardId } = await params;
  const [dashboard] = await getDashboardByPublicId(dashboardId);
  if (!dashboard) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const organizationIds = dashboard.organizationIds?.length ? dashboard.organizationIds
    : dashboard.organizationId != null ? [dashboard.organizationId] : [];
  // Identical to the dashboard page, including administrators and every scoped fleet.
  if (!(user.companyIds ?? []).includes(dashboard.companyId ?? -1)
    || !organizationIds.every((id) => (user.organizationIds ?? []).includes(id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (resolveTemplate(dashboard.template) !== 'AfterHoursEntry') return NextResponse.json({ error: 'Not an AfterHoursEntry dashboard' }, { status: 400 });
  const url = new URL(request.url);
  const range = { from: url.searchParams.get('from') ?? '', to: url.searchParams.get('to') ?? '' };
  const rawOffset = url.searchParams.get('offset') ?? '0';
  const offset = Number(rawOffset);
  if (!isEntryRange(range) || !/^\d+$/.test(rawOffset) || !Number.isSafeInteger(offset)) {
    return NextResponse.json({ error: 'Select a valid date range and page offset.' }, { status: 400 });
  }
  if (!isValidSheetId(dashboard.sheetId) || !isValidSheetGid(dashboard.sheetGid)) {
    return NextResponse.json({ error: 'Invalid configured Google Sheet.' }, { status: 400 });
  }
  let settings;
  try { settings = validateAfterHoursSettings(dashboard.afterHoursSettings); }
  catch { return NextResponse.json({ error: 'Ask Admin to save the daily hours and customer areas for this dashboard.' }, { status: 422 }); }
  const organizations = await Promise.all(organizationIds.map((id) => getOrganizationById(id)));
  if (organizations.some((rows) => !rows[0]?.name)) {
    return NextResponse.json({ error: 'Dashboard fleet scope could not be resolved.' }, { status: 503 });
  }
  try {
    const page = await fetchAfterHoursPage(dashboard.sheetId, dashboard.sheetGid, offset, request.signal);
    const data = buildAfterHoursEntries(page.rows, settings, range, organizations.map((rows) => rows[0]!.name!));
    const configurationKey = createHash('sha256').update(JSON.stringify([dashboard.sheetId, dashboard.sheetGid, settings, organizationIds, organizations.map((rows) => rows[0]!.name)])).digest('hex');
    return NextResponse.json({ ...data, configurationKey, hasMore: page.hasMore, nextOffset: page.nextOffset, settings,
      scanned: page.rows.length, lastUpdated: Date.now() }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load after-hours entries.' }, { status: 502 });
  }
}

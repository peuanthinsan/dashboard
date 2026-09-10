import { NextResponse } from 'next/server';
import { auth } from 'app/auth';
import { getCompanyById, getDashboardByPublicId, getOrganizationById, getUser } from 'app/db';
import { isValidSheetGid, isValidSheetId } from 'app/admin/admin-utils';
import { isLegacyBigthUnitStatusTemplate, resolveTemplate, scopeFleetSet } from 'app/dashboards/dashboardDataUtils';
import { parseGoogleSheetTable } from 'app/dashboards/googleSheetParse';
import { buildUnitRows, hasUnitStatusColumns, type UnitCameraHistory } from 'app/dashboards/unitStatusData';
import { cameraHistorySourceKey, rememberUnitCameras } from 'app/unit-camera-history';

export const maxDuration = 60;

async function fetchStatusSheet(sheetId: string, selector: { gid: string } | { sheet: string }, signal: AbortSignal) {
  const params = new URLSearchParams({ tqx: 'out:json', headers: '1', ...selector });
  const response = await fetch(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?${params}`, {
    cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
  });
  if (!response.ok) throw new Error('Sheet fetch failed');
  const match = (await response.text()).match(/setResponse\(([\s\S]*)\);/);
  const envelope = match ? JSON.parse(match[1]) as Parameters<typeof parseGoogleSheetTable>[0] & { status?: string } : null;
  if (!envelope?.table || envelope.status === 'error') throw new Error('Invalid sheet response');
  return parseGoogleSheetTable(envelope);
}

/** Resolve both authorization and telemetry on the server; clients cannot seed history. */
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
  // Match the dashboard page: even administrators require assigned company/fleets.
  if (!(user.companyIds ?? []).includes(dashboard.companyId ?? -1)
    || !organizationIds.every((id) => (user.organizationIds ?? []).includes(id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (resolveTemplate(dashboard.template) !== 'UnitStatus') return NextResponse.json({ error: 'Not a UnitStatus dashboard' }, { status: 400 });
  const legacy = isLegacyBigthUnitStatusTemplate(dashboard.template);
  if (!isValidSheetId(dashboard.sheetId) || (!legacy && !isValidSheetGid(dashboard.sheetGid))) {
    return NextResponse.json({ error: 'Invalid configured sheet' }, { status: 400 });
  }
  const [companyRows, organizations] = await Promise.all([
    getCompanyById(dashboard.companyId!), Promise.all(organizationIds.map((id) => getOrganizationById(id))),
  ]);
  // An unresolved scope must never widen a sheet read to other customers/fleets.
  if (!companyRows[0]?.name || organizations.some((rows) => !rows[0]?.name)) {
    return NextResponse.json({ error: 'Dashboard scope could not be resolved' }, { status: 503 });
  }
  try {
    const [primary, channels] = await Promise.all([
      fetchStatusSheet(dashboard.sheetId, legacy ? { sheet: 'Unitstatus' } : { gid: dashboard.sheetGid }, request.signal),
      fetchStatusSheet(dashboard.sheetId, { sheet: 'CH' }, request.signal).catch(() => null),
    ]);
    if (!hasUnitStatusColumns(primary.columns)) throw new Error('Missing required status columns');
    // Missing CH can narrow the visible rows, but source Fleet/account membership
    // can still prove entitlement. buildUnitRows drops any unresolved fleet.
    const now = new Date();
    const units = buildUnitRows(primary.rows, channels?.rows ?? [], scopeFleetSet(null, organizations.map((rows) => rows[0]!.name)), now, companyRows[0].name);
    let cameraHistory: UnitCameraHistory = {};
    let historyAvailable = true;
    try {
      cameraHistory = await rememberUnitCameras(cameraHistorySourceKey(dashboard.companyId!, dashboard.sheetId,
        legacy ? 'sheet:Unitstatus' : `gid:${dashboard.sheetGid}`, organizationIds), units);
    } catch {
      historyAvailable = false;
      cameraHistory = Object.fromEntries(units.map((unit) => [unit.cameraHistoryKey, unit.cameraObservations]));
      console.error('UnitStatus camera history unavailable');
    }
    const metadataIndexes = new Set(units.flatMap((unit) => unit.metadataIndex === undefined ? [] : [unit.metadataIndex]));
    return NextResponse.json({
      columns: primary.columns, rows: units.map((unit) => primary.rows[unit.sourceIndex]),
      channelRows: channels?.rows.filter((_, index) => metadataIndexes.has(index)) ?? [],
      metadataAvailable: channels !== null, cameraHistory, historyAvailable, lastUpdated: now.toISOString(),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Unable to load unit status data. Please retry.' }, { status: 502 });
  }
}

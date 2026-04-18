import { NextResponse } from 'next/server';
import { auth } from 'app/auth';
import { probeSheetAlertFields } from 'app/dashboards/sheetFieldProbe';
import { getUser, userCanAccessSheet } from 'app/db';
import { isValidSheetGid, isValidSheetId } from 'app/admin/admin-utils';

/** GET /api/sheets/[sheetId]/[gid]/fields — alert types and remarks (bounded fetch; defaults on failure) */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sheetId: string; gid: string }> }
) {
  const { sheetId, gid } = await params;
  if (!sheetId || !gid) {
    return NextResponse.json({ error: 'Missing sheetId or gid' }, { status: 400 });
  }
  if (!isValidSheetId(sheetId) || !isValidSheetGid(gid)) {
    return NextResponse.json({ error: 'Invalid sheet identifier' }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userRows = await getUser(session.user.email);
  if (userRows.length === 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = userRows[0];
  // Admins use this route during dashboard creation BEFORE the dashboard exists,
  // so they're allowed to probe any sheet. Non-admins must own the sheet via a dashboard.
  if (!user.isAdmin) {
    const allowed = await userCanAccessSheet(
      sheetId,
      gid,
      user.companyIds ?? [],
      user.organizationIds ?? [],
    );
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const result = await probeSheetAlertFields(sheetId, gid);

  if (result.fallback) {
    return NextResponse.json({
      alertTypes: result.alertTypes,
      remarks: result.remarks,
      fallback: true as const,
      ...(result.fallbackReason ? { fallbackReason: result.fallbackReason } : {}),
    });
  }

  return NextResponse.json({
    alertTypes: result.alertTypes,
    remarks: result.remarks,
    fallback: false as const,
  });
}

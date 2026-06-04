import { NextResponse } from 'next/server';
import { auth } from 'app/auth';
import { buildGvizJsonUrl } from 'app/dashboards/googleSheetGvizUrl';
import { parseGoogleSheetGvizText } from 'app/dashboards/googleSheetParse';
import { getUser, userCanAccessSheet } from 'app/db';
import { isValidSheetGid, isValidSheetId } from 'app/admin/admin-utils';

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

  try {
    // Cap at 25 000 most-recent rows (order by SlNo/A desc) to avoid OOM on large historical sheets
    // (e.g. ALCHEM cntDrv sheet is 64 MB / 66 k rows). 25 k rows ≈ 14 months of typical driving data.
    const response = await fetch(buildGvizJsonUrl(sheetId, gid, 25_000, true), {
      headers: { 'User-Agent': 'SongdeeGPS-Dashboard/1.0' },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Unable to fetch the Google Sheet data.' }, { status: 502 });
    }

    const text = await response.text();
    const parsed = parseGoogleSheetGvizText(text);

    return NextResponse.json({
      columns: parsed.columns,
      rows: parsed.rows,
      lastUpdated: Date.now(),
    });
  } catch (err) {
    console.error('Sheet fetch error:', err);
    return NextResponse.json({ error: 'Unable to fetch the Google Sheet data.' }, { status: 502 });
  }
}

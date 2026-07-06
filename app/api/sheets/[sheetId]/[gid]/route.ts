import { NextResponse } from 'next/server';
import { auth } from 'app/auth';
import { buildGvizJsonUrl, gvizColumnLetter } from 'app/dashboards/googleSheetGvizUrl';
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
    // Cap at 25 000 most-recent rows to avoid OOM on large historical sheets (e.g. ALCHEM cntDrv
    // is 64 MB / ~69 k rows). "Most recent" must be ordered by the timestamp column, NOT column A:
    // SlNo is not globally sequential on every sheet (ALCHEM cntDrv has 68 981 rows but SlNo maxes
    // at 3 270, so `order by A desc` silently dropped ~700 June rows). Preflight one row to find the
    // first date/datetime-typed column and order by that; fall back to A if none is typed as a date.
    let orderColId = 'A';
    try {
      const meta = await fetch(buildGvizJsonUrl(sheetId, gid, 1), {
        headers: { 'User-Agent': 'SongdeeGPS-Dashboard/1.0' },
        cache: 'no-store',
      });
      if (meta.ok) {
        const metaCols = parseGoogleSheetGvizText(await meta.text()).columns;
        const dateIdx = metaCols.findIndex((c) => c.type === 'datetime' || c.type === 'date');
        if (dateIdx >= 0) orderColId = gvizColumnLetter(dateIdx);
      }
    } catch {
      // Preflight failed — keep the column-A default.
    }

    const response = await fetch(buildGvizJsonUrl(sheetId, gid, 25_000, true, orderColId), {
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

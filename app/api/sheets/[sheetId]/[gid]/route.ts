import { NextResponse } from 'next/server';
import { auth } from 'app/auth';
import {
  fetchRecentSheetRows,
  fetchSheetDateRange,
  listSheetMonths,
} from 'app/dashboards/googleSheetFetch';
import { DEFAULT_SHEET_ROW_LIMIT } from 'app/dashboards/googleSheetGvizUrl';
import { getUser, userCanAccessSheet } from 'app/db';
import { isValidSheetGid, isValidSheetId } from 'app/admin/admin-utils';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const maxDuration = 60;

async function authorize(sheetId: string, gid: string) {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const userRows = await getUser(session.user.email);
  if (userRows.length === 0) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const user = userRows[0]!;
  if (!user.isAdmin) {
    const allowed = await userCanAccessSheet(
      sheetId,
      gid,
      user.companyIds ?? [],
      user.organizationIds ?? [],
    );
    if (!allowed) {
      return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }
  }
  return { user };
}

/**
 * GET /api/sheets/[sheetId]/[gid]
 *
 * Query params:
 * - `mode=months` — list calendar months present in the sheet (non-null id rows).
 * - `from=YYYY-MM-DD&to=YYYY-MM-DD` — rows in [from, to) with non-null id (≤25k).
 * - (default) — 25k most-recent rows by timestamp, excluding null-id poison rows.
 *
 * Large alert sheets (e.g. PoonNok ~245k rows) cannot fit in one response. Clients
 * should call `mode=months`, then fetch each selected month as 2-day `from`/`to`
 * chunks (pruned columns) and merge client-side.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ sheetId: string; gid: string }> },
) {
  const { sheetId, gid } = await params;
  if (!sheetId || !gid) {
    return NextResponse.json({ error: 'Missing sheetId or gid' }, { status: 400 });
  }
  if (!isValidSheetId(sheetId) || !isValidSheetGid(gid)) {
    return NextResponse.json({ error: 'Invalid sheet identifier' }, { status: 400 });
  }

  const authResult = await authorize(sheetId, gid);
  if ('error' in authResult && authResult.error) return authResult.error;

  const url = new URL(request.url);
  const mode = url.searchParams.get('mode');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  try {
    if (mode === 'months') {
      const months = await listSheetMonths(sheetId, gid);
      return NextResponse.json({ months, lastUpdated: Date.now() });
    }

    if (from || to) {
      if (!from || !to || !ISO_DATE.test(from) || !ISO_DATE.test(to) || from >= to) {
        return NextResponse.json(
          { error: 'from/to must be YYYY-MM-DD with from < to' },
          { status: 400 },
        );
      }
      // Guard against accidental full-month pulls: dense alert sheets blow past the
      // ~4.5 MB response limit beyond a few days even with pruned columns. Clients
      // should use SHEET_CHUNK_DAYS (2) windows; allow a little headroom.
      const fromMs = Date.parse(`${from}T00:00:00Z`);
      const toMs = Date.parse(`${to}T00:00:00Z`);
      if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs - fromMs > 4 * 86_400_000) {
        return NextResponse.json(
          { error: 'from/to window must be at most 4 days' },
          { status: 400 },
        );
      }
      const parsed = await fetchSheetDateRange(sheetId, gid, from, to, DEFAULT_SHEET_ROW_LIMIT);
      return NextResponse.json({
        columns: parsed.columns,
        rows: parsed.rows,
        lastUpdated: Date.now(),
        from,
        to,
        truncated: parsed.rows.length >= DEFAULT_SHEET_ROW_LIMIT,
      });
    }

    const parsed = await fetchRecentSheetRows(sheetId, gid, DEFAULT_SHEET_ROW_LIMIT);
    return NextResponse.json({
      columns: parsed.columns,
      rows: parsed.rows,
      lastUpdated: Date.now(),
      truncated: parsed.rows.length >= DEFAULT_SHEET_ROW_LIMIT,
    });
  } catch (err) {
    console.error('Sheet fetch error:', err);
    return NextResponse.json({ error: 'Unable to fetch the Google Sheet data.' }, { status: 502 });
  }
}

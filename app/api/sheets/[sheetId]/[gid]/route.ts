import { NextResponse } from 'next/server';

const CACHE_TTL_SEC = 5 * 60; // 5 minutes
const buildSheetUrl = (sheetId: string, gid: string) =>
  `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${gid}`;

function parseGoogleSheet(payload: string) {
  const match = payload.match(/setResponse\(([\s\S]*)\);/);
  if (!match) {
    throw new Error('Unable to read the Google Sheet response.');
  }
  const json = JSON.parse(match[1]);
  const columns = (json.table?.cols ?? []).map(
    (col: { label?: string; type?: string }, index: number) => ({
      label: col?.label ? String(col.label).trim() : `Column ${index + 1}`,
      type: col?.type ?? 'string',
    })
  );
  const rows = (json.table?.rows ?? []).map(
    (row: { c?: Array<{ f?: unknown; v?: unknown } | null> }) => {
      const record: Record<string, string | number | boolean | null> = {};
      (row?.c ?? []).forEach((cell, index) => {
        const column = columns[index];
        if (!column) return;
        record[column.label] = (cell?.f ?? cell?.v ?? null) as string | number | boolean | null;
      });
      return record;
    }
  );
  const isHeaderRow = (row: Record<string, unknown>) =>
    columns.length > 0 &&
    columns.every(
      (column: { label: string }) =>
        String(row[column.label] ?? '').trim() === column.label
    );
  const trimmedRows =
    rows.length > 0 && isHeaderRow(rows[0]) ? rows.slice(1) : rows;
  return { columns, rows: trimmedRows };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sheetId: string; gid: string }> }
) {
  const { sheetId, gid } = await params;
  if (!sheetId || !gid) {
    return NextResponse.json(
      { error: 'Missing sheetId or gid' },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(buildSheetUrl(sheetId, gid), {
      headers: {
        'User-Agent': 'SongdeeGPS-Dashboard/1.0',
      },
      next: { revalidate: CACHE_TTL_SEC },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Unable to fetch the Google Sheet data.' },
        { status: 502 }
      );
    }

    const text = await response.text();
    const parsed = parseGoogleSheet(text);

    return NextResponse.json({
      columns: parsed.columns,
      rows: parsed.rows,
      lastUpdated: Date.now(),
    });
  } catch (err) {
    console.error('Sheet fetch error:', err);
    return NextResponse.json(
      { error: 'Unable to fetch the Google Sheet data.' },
      { status: 502 }
    );
  }
}

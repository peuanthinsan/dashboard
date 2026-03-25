import { NextResponse } from 'next/server';
import { parseGoogleSheetGvizText } from 'app/dashboards/googleSheetParse';

const CACHE_TTL_SEC = 5 * 60; // 5 minutes
const buildSheetUrl = (sheetId: string, gid: string) =>
  `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${gid}`;

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
    const parsed = parseGoogleSheetGvizText(text);

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

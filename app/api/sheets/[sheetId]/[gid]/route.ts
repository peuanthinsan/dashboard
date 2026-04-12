import { NextResponse } from 'next/server';
import { buildGvizJsonUrl } from 'app/dashboards/googleSheetGvizUrl';
import { parseGoogleSheetGvizText } from 'app/dashboards/googleSheetParse';

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
    // Full sheet: do not use Next.js data cache — large responses exceed the 2MB cache limit and can OOM.
    const response = await fetch(buildGvizJsonUrl(sheetId, gid), {
      headers: {
        'User-Agent': 'SongdeeGPS-Dashboard/1.0',
      },
      cache: 'no-store',
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

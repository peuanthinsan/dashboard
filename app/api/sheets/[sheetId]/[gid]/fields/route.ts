import { NextResponse } from 'next/server';
import {
  findValue,
  hasRemark,
  isExcludedAlertRemark,
  toDisplayString,
  withDerivedRemark,
} from 'app/dashboards/dashboardDataUtils';
import { parseGoogleSheetGvizText } from 'app/dashboards/googleSheetParse';

const CACHE_TTL_SEC = 5 * 60;
const buildSheetUrl = (sheetId: string, gid: string) =>
  `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${gid}`;

/** GET /api/sheets/[sheetId]/[gid]/fields — returns alert types and remarks from the sheet in one call */
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
    const { rows } = parseGoogleSheetGvizText(text);

    const alertTypes = new Set<string>();
    const remarks = new Set<string>();

    for (const row of rows) {
      const alertTypeValue = findValue(row, ['Alert Type', 'AlertType']);
      if (alertTypeValue != null && String(alertTypeValue).trim()) {
        alertTypes.add(String(alertTypeValue).trim());
      }

      const alertType = toDisplayString(findValue(row, ['Alert Type', 'AlertType']));
      const rawRemarks = toDisplayString(findValue(row, ['Remarks', 'Remark']));
      const derived = withDerivedRemark(alertType, rawRemarks);
      if (hasRemark(derived) && !isExcludedAlertRemark(derived)) {
        remarks.add(derived.trim());
      }
    }

    return NextResponse.json({
      alertTypes: Array.from(alertTypes).sort((a, b) => a.localeCompare(b)),
      remarks: Array.from(remarks).sort((a, b) => a.localeCompare(b)),
    });
  } catch (err) {
    console.error('Fields fetch error:', err);
    return NextResponse.json(
      { error: 'Unable to fetch alert types and remarks from the sheet.' },
      { status: 502 }
    );
  }
}

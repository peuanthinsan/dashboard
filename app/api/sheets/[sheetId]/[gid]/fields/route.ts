import { NextResponse } from 'next/server';
import {
  ALLOWED_ALERT_TYPES,
  ALLOWED_REMARK_TARGETS,
  findValue,
  hasRemark,
  isExcludedAlertRemark,
  toDisplayString,
  withDerivedRemark,
} from 'app/dashboards/dashboardDataUtils';
import { buildGvizJsonUrl } from 'app/dashboards/googleSheetGvizUrl';
import { parseGoogleSheetGvizText } from 'app/dashboards/googleSheetParse';

/** Enough rows to discover alert types / remarks without loading multi‑MB sheets. */
const FIELDS_PROBE_ROW_LIMIT = 15_000;

function defaultFieldsResponse(reason?: string) {
  return NextResponse.json({
    alertTypes: [...ALLOWED_ALERT_TYPES],
    remarks: [...ALLOWED_REMARK_TARGETS],
    fallback: true as const,
    ...(reason ? { fallbackReason: reason } : {}),
  });
}

function extractFieldsFromRows(rows: Record<string, unknown>[]) {
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

  return {
    alertTypes: Array.from(alertTypes).sort((a, b) => a.localeCompare(b)),
    remarks: Array.from(remarks).sort((a, b) => a.localeCompare(b)),
  };
}

/** GET /api/sheets/[sheetId]/[gid]/fields — alert types and remarks (bounded fetch; defaults on failure) */
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

  const url = buildGvizJsonUrl(sheetId, gid, FIELDS_PROBE_ROW_LIMIT);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SongdeeGPS-Dashboard/1.0',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn(
        '[sheets/fields] Google returned non-OK; using default alert types & remarks.',
        response.status
      );
      return defaultFieldsResponse('sheet_http_error');
    }

    const lenHeader = response.headers.get('content-length');
    if (lenHeader) {
      const n = Number(lenHeader);
      if (Number.isFinite(n) && n > 6 * 1024 * 1024) {
        console.warn(
          '[sheets/fields] Response too large despite row limit; using defaults.',
          n
        );
        return defaultFieldsResponse('response_too_large');
      }
    }

    const text = await response.text();
    const { rows } = parseGoogleSheetGvizText(text);
    const { alertTypes, remarks } = extractFieldsFromRows(rows);

    if (alertTypes.length === 0 && remarks.length === 0) {
      console.warn('[sheets/fields] No alert types or remarks in probe; using defaults.');
      return defaultFieldsResponse('empty_probe');
    }

    return NextResponse.json({
      alertTypes,
      remarks,
      fallback: false as const,
    });
  } catch (err) {
    console.error('[sheets/fields] Fetch/parse error; using default alert types & remarks.', err);
    return defaultFieldsResponse('fetch_or_parse_error');
  }
}

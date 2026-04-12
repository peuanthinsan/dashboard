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
export const FIELDS_PROBE_ROW_LIMIT = 15_000;

export type SheetFieldProbeResult = {
  alertTypes: string[];
  remarks: string[];
  fallback: boolean;
  fallbackReason?: string;
};

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

function defaultProbe(reason: string): SheetFieldProbeResult {
  return {
    alertTypes: [...ALLOWED_ALERT_TYPES],
    remarks: [...ALLOWED_REMARK_TARGETS],
    fallback: true,
    fallbackReason: reason,
  };
}

/**
 * Fetches a bounded slice of the sheet and extracts distinct alert types and remarks.
 * On failure or empty probe, returns built-in defaults (same as /api/sheets/.../fields).
 */
export async function probeSheetAlertFields(sheetId: string, gid: string): Promise<SheetFieldProbeResult> {
  const url = buildGvizJsonUrl(sheetId, gid, FIELDS_PROBE_ROW_LIMIT);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SongdeeGPS-Dashboard/1.0',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn('[sheetFieldProbe] Google non-OK; using defaults.', response.status);
      return defaultProbe('sheet_http_error');
    }

    const lenHeader = response.headers.get('content-length');
    if (lenHeader) {
      const n = Number(lenHeader);
      if (Number.isFinite(n) && n > 6 * 1024 * 1024) {
        console.warn('[sheetFieldProbe] Response too large; using defaults.', n);
        return defaultProbe('response_too_large');
      }
    }

    const text = await response.text();
    const { rows } = parseGoogleSheetGvizText(text);
    const { alertTypes, remarks } = extractFieldsFromRows(rows);

    if (alertTypes.length === 0 && remarks.length === 0) {
      console.warn('[sheetFieldProbe] Empty probe; using defaults.');
      return defaultProbe('empty_probe');
    }

    return { alertTypes, remarks, fallback: false };
  } catch (err) {
    console.error('[sheetFieldProbe] Fetch/parse error; using defaults.', err);
    return defaultProbe('fetch_or_parse_error');
  }
}

/** Union Songdee standard lists with probed values (deduped, sorted). */
export function mergeStandardWithProbed(probe: Pick<SheetFieldProbeResult, 'alertTypes' | 'remarks'>) {
  const alertTypes = Array.from(new Set([...ALLOWED_ALERT_TYPES, ...probe.alertTypes])).sort((a, b) =>
    a.localeCompare(b),
  );
  const remarks = Array.from(new Set([...ALLOWED_REMARK_TARGETS, ...probe.remarks])).sort((a, b) =>
    a.localeCompare(b),
  );
  return { alertTypes, remarks };
}

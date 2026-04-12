import { NextResponse } from 'next/server';
import { probeSheetAlertFields } from 'app/dashboards/sheetFieldProbe';

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

import { NextResponse } from 'next/server';
import { buildAfterHoursEntries, isEntryRange, type AfterHoursSettings } from 'app/dashboards/afterHoursEntry';

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== 'development' || process.env.ALLOW_E2E_FIXTURES !== 'true') return new Response(null, { status: 404 });
  const query = new URL(request.url).searchParams;
  const range = { from: query.get('from') ?? '', to: query.get('to') ?? '' };
  const offset = Number(query.get('offset') ?? 0);
  if (!isEntryRange(range) || !Number.isSafeInteger(offset) || offset < 0) return new Response(null, { status: 400 });
  const settings: AfterHoursSettings = { startTime: '08:00', endTime: '16:00', timeZone: 'Asia/Bangkok', geofenceNames: ['Thongfleet'] };
  const rows = Array.from({ length: 212 }, (_, i) => ({
    'Vehicle No': `DEMO-${String(i % 22 + 1).padStart(2, '0')}`, 'User Name': 'THONGTRANSPORT MASTER,THONGTRANSPORT,SONGDEEAPI',
    'Driver Name': `Demo Driver ${String(i % 22 + 1).padStart(2, '0')}`, 'Fleet': ['Thong', 'Demo East', 'Demo West'][(i % 22) % 3],
    'Geofence Name': 'Thongfleet', 'Alert Type': 'Unauthorised Entry',
    'Alert Date Time': `0${i % 5 + 1}/10/2026 ${i < 29 ? 5 + i % 3 : i < 73 ? 17 + i % 5 : 8 + i % 8}:${String(i * 7 % 60).padStart(2, '0')}:${String(i * 11 % 60).padStart(2, '0')}`,
  }));
  // Two pages exercise complete-load behavior without any real source data.
  const page = rows.slice(offset, offset + 150);
  return NextResponse.json({ ...buildAfterHoursEntries(page, settings, range, []),
    settings, hasMore: offset + 150 < rows.length, nextOffset: offset + 150, scanned: page.length, lastUpdated: Date.now() },
  { headers: { 'Cache-Control': 'private, no-store' } });
}

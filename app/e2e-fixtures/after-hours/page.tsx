import { notFound } from 'next/navigation';
import AfterHoursEntryDashboard from 'app/dashboards/AfterHoursEntryDashboard';
import { AfterHoursAdminFields } from 'app/admin/dashboards/AfterHoursAdminFields';

export const dynamic = 'force-dynamic';

/** Synthetic, local-only preview. Never exposes a Google Sheet or a production session. */
export default async function AfterHoursPreview({ searchParams }: { searchParams: Promise<{ lang?: string; mode?: string }> }) {
  if (process.env.NODE_ENV !== 'development' || process.env.ALLOW_E2E_FIXTURES !== 'true') notFound();
  const { lang, mode } = await searchParams;
  if (mode === 'admin') return <main id="main-content" className="mx-auto max-w-3xl p-6"><AfterHoursAdminFields initial={{ startTime: '08:00', endTime: '16:00', timeZone: 'Asia/Bangkok', geofenceNames: ['Thongfleet'] }} /></main>;
  return <main id="main-content"><AfterHoursEntryDashboard dashboardId="after-hours-preview" dashboardName="After-hours preview"
    dashboardNotes={lang === 'th'
      ? 'ข้อมูลสาธิต 212 รายการ จากรถ 22 คัน และ 3 Fleet ระหว่างวันที่ 1–5 ตุลาคม 2026 ลองเปลี่ยนเวลาและเลือกหลายทะเบียนรถหรือ Fleet ได้'
      : 'Demo data: 212 entries, 22 vehicles and 3 fleets, 1–5 October 2026. Try changing the allowed hours and selecting multiple vehicles or fleets.'}
    lang={lang === 'th' ? 'th' : 'en'} dataUrl="/e2e-fixtures/after-hours/data"
    initialRange={{ from: '2026-10-01', to: '2026-10-05' }} demoMode /></main>;
}

'use client';

import { useState } from 'react';
import { validateAfterHoursSettings, type AfterHoursSettings } from './afterHoursEntry';
import { btnPrimary, inputBase, labelBase } from 'app/ui/design-tokens';

export default function AfterHoursScheduleEditor({ settings, lang, demo, onSave }: {
  settings: AfterHoursSettings; lang: 'en' | 'th'; demo: boolean;
  onSave: (hours: { startTime: string; endTime: string }) => Promise<void>;
}) {
  const th = lang === 'th';
  const [startTime, setStartTime] = useState(settings.startTime);
  const [endTime, setEndTime] = useState(settings.endTime);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  let valid = true;
  try { validateAfterHoursSettings({ ...settings, startTime, endTime }); } catch { valid = false; }
  return <form className="mt-3 border-t border-blue-200 pt-3 dark:border-blue-900" aria-label={th ? 'ตั้งค่าเวลาที่อนุญาต' : 'Configure allowed hours'} onSubmit={async (event) => {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true); setError('');
    try { await onSave({ startTime, endTime }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : (th ? 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง' : 'Unable to save. Please try again.')); }
    finally { setSaving(false); }
  }}>
    <fieldset disabled={saving} className="flex flex-wrap items-end gap-3">
      <label className={labelBase}>{th ? 'เวลาเริ่มที่อนุญาต' : 'Allowed start time'}<input required type="time" className={`${inputBase} mt-1`} value={startTime} onInput={(e) => setStartTime(e.currentTarget.value)} /></label>
      <label className={labelBase}>{th ? 'เวลาสิ้นสุดที่อนุญาต' : 'Allowed end time'}<input required type="time" className={`${inputBase} mt-1`} value={endTime} onInput={(e) => setEndTime(e.currentTarget.value)} /></label>
      <button type="submit" disabled={!valid || saving} className={`${btnPrimary} disabled:opacity-50`}>{saving ? (th ? 'กำลังบันทึก…' : 'Saving…') : demo ? (th ? 'ใช้เวลาในตัวอย่าง' : 'Apply demo hours') : (th ? 'บันทึกเวลาร่วมกัน' : 'Save shared hours')}</button>
    </fieldset>
    <p className="mt-2 text-xs">{demo ? (th ? 'เปลี่ยนเวลาเพื่อทดลองคำนวณข้อมูลสาธิต รีโหลดหน้าเพื่อกลับเป็น 08:00–16:00' : 'Try different hours on the demo data. Reload to reset to 08:00–16:00.')
      : (th ? 'Admin บันทึกเวลานี้ให้ทุกคนที่ใช้แดชบอร์ด รวมถึงการคำนวณข้อมูลย้อนหลัง' : 'Admin saves one schedule for all viewers of this dashboard, including historical entries.')}</p>
    {!valid && <p role="alert" className="mt-2 text-sm text-red-600">{th ? 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มในวันเดียวกัน' : 'Choose an end time later than the start on the same day.'}</p>}
    {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
  </form>;
}

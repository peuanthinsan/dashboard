'use client';

import { useState } from 'react';
import { DEFAULT_AFTER_HOURS_SETTINGS, type AfterHoursSettings } from 'app/dashboards/afterHoursEntry';
import { ADMIN_INPUT, ADMIN_LABEL, ADMIN_TEXTAREA, ADMIN_TEXT_SUBTLE } from '../admin-ui';

/** Shared by Create, Edit, bulk create and Quick setup. Saved by admin-only server actions. */
export function AfterHoursAdminFields({ initial, onChange }: {
  initial?: AfterHoursSettings | null;
  onChange?: (settings: AfterHoursSettings) => void;
}) {
  const [start, setStart] = useState(initial?.startTime ?? DEFAULT_AFTER_HOURS_SETTINGS.startTime);
  const [end, setEnd] = useState(initial?.endTime ?? DEFAULT_AFTER_HOURS_SETTINGS.endTime);
  const [areas, setAreas] = useState(initial?.geofenceNames.join('\n') ?? '');
  function update(nextStart: string, nextEnd: string, nextAreas: string) {
    setStart(nextStart); setEnd(nextEnd); setAreas(nextAreas);
    onChange?.({ startTime: nextStart, endTime: nextEnd, timeZone: 'Asia/Bangkok',
      geofenceNames: nextAreas.split(/\r?\n/).map((name) => name.trim()).filter(Boolean) });
  }
  return <fieldset className="grid gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
    <legend className={`px-2 ${ADMIN_LABEL}`}>After-Hours Customer Entry · รถเข้าพื้นที่ลูกค้านอกเวลา</legend>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>Allowed start time
        <input required type="time" name="afterHoursStart" value={start} onInput={(e) => update(e.currentTarget.value, end, areas)} className={ADMIN_INPUT} />
      </label>
      <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>Allowed end time
        <input required type="time" name="afterHoursEnd" value={end} onInput={(e) => update(start, e.currentTarget.value, areas)} className={ADMIN_INPUT} />
      </label>
    </div>
    <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>Customer areas — Geofence Name contains
      <textarea required name="afterHoursGeofences" rows={3} value={areas} onInput={(e) => update(start, end, e.currentTarget.value)}
        placeholder="Thongfleet" className={ADMIN_TEXTAREA} />
      <span className={`text-xs font-normal ${ADMIN_TEXT_SUBTLE}`}>Copy names from the Google Sheet, one per line. A matching name anywhere in Geofence Name includes that customer area.</span>
    </label>
    <p className={`text-xs ${ADMIN_TEXT_SUBTLE}`}>Asia/Bangkok · Same hours every day. All areas on this dashboard share these hours. Changing them recalculates historical entries for every viewer. Version one supports a start and end on the same day.</p>
    <p className={`text-xs ${ADMIN_TEXT_SUBTLE}`}>Uses Unauthorised Entry rows and dd/mm/yyyy h:mm:ss from Alert Date Time. Fleet and Driver Name are read by column header, in any column order. Scoped fleet names must match the Fleet values in the sheet (for example Thong).</p>
  </fieldset>;
}

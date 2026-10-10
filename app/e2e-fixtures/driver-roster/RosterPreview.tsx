'use client';

import { useMemo, useState } from 'react';
import SummaryDriverTable from 'app/dashboards/SummaryDriverTable';
import { filterDriverRoster } from 'app/dashboards/driverRoster';
import { buildSummaryRosterData, type SummaryAlertRow } from 'app/dashboards/summaryRosterData';
import KpiCard from 'app/ui/KpiCard';

// Synthetic fixtures only. Real driver names are loaded from the configured Google Sheet.
const roster = Array.from({ length: 15 }, (_, index) => ({ vehicle: String(2001 + index), driver: `Driver ${String(index + 1).padStart(2, '0')}`, fleet: 'SERVICE' }));
const categories = ['Distraction', 'Harsh Acceleration', 'Harsh Brake', 'Yawning', 'Other'];
const alerts: SummaryAlertRow[] = [11, 6, 5, 2, 2, 2, 1].flatMap((count, index) => Array.from({ length: count }, (_, offset) => ({ ...roster[index], remarks: categories[offset % categories.length] })));

export default function RosterPreview() {
  const [empty, setEmpty] = useState(false);
  const [lang, setLang] = useState<'en' | 'th'>('en');
  const [driver, setDriver] = useState('');
  const filteredRoster = useMemo(() => filterDriverRoster(roster, { drivers: driver ? [driver] : [] }), [driver]);
  const model = useMemo(() => buildSummaryRosterData(empty ? [] : alerts.filter((row) => !driver || row.driver === driver), filteredRoster, true), [empty, driver, filteredRoster]);
  return <main id="main-content" className="mx-auto flex max-w-[1500px] flex-col gap-6 px-4 py-6 sm:px-8">
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-red-500">SongdeeGPS · Design preview</p><h1 className="mt-2 text-2xl font-bold">SERVICE · Driver overview</h1><p className="mt-2 text-xs text-zinc-500">September 2026 · Synthetic data · 15 roster drivers</p></div>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-2"><input type="checkbox" checked={empty} onChange={(event) => setEmpty(event.target.checked)} />Zero-alert period</label>
        <label className="flex items-center gap-2">Driver<select aria-label="Driver filter" value={driver} onChange={(event) => setDriver(event.target.value)} className="rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"><option value="">All drivers</option>{roster.map((entry) => <option key={entry.driver} value={entry.driver}>{entry.driver}</option>)}</select></label>
        <button type="button" onClick={() => setLang(lang === 'en' ? 'th' : 'en')} className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700">{lang === 'en' ? 'ภาษาไทย' : 'English'}</button>
      </div>
    </header>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard label={lang === 'en' ? 'Total alerts' : 'การแจ้งเตือนทั้งหมด'} value={model.totalAlerts} accentColor="#DC2626" />
      <KpiCard label={lang === 'en' ? 'Vehicles' : 'ยานพาหนะ'} value={model.totalVehicles} subtitle={lang === 'en' ? 'Including roster vehicles with no alerts' : 'รวมรถในรายชื่อที่ไม่พบการแจ้งเตือน'} />
      <KpiCard label={lang === 'en' ? 'Drivers' : 'คนขับ'} value={model.totalDrivers} subtitle={`${model.driversWithAlerts} with alerts · ${model.driversWithoutAlerts} no alerts`} />
      <KpiCard label="OverSpeed" value={model.overspeed} subtitle={lang === 'en' ? 'Recorded in the selected period' : 'ที่บันทึกในช่วงเวลาที่เลือก'} accentColor="#3B82F6" />
    </div>
    <SummaryDriverTable key={`${empty}:${driver}`} model={model} lang={lang} rosterEnabled namePolicy="vehicle" />
  </main>;
}

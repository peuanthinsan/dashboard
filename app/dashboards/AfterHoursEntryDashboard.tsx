'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardShell from './DashboardShell';
import KpiCard from 'app/ui/KpiCard';
import { DataTable, type Column } from 'app/ui/DataTable';
import MultiSelect from 'app/ui/MultiSelect';
import AfterHoursScheduleEditor from './AfterHoursScheduleEditor';
import { saveAfterHoursSchedule } from './afterHoursActions';
import { badgeInfo, badgeSuccess, badgeWarning, btnPrimary, btnSecondary, cardSection, heading2, inputBase, labelBase, selectBase, textSecondary } from 'app/ui/design-tokens';
import { entryChartData, entryPresetRange, filterAfterHoursEntries, isEntryRange, reclassifyEntries, summarizeEntries, validateAfterHoursSettings, type AfterHoursEntry, type AfterHoursSettings, type EntryDateRange, type EntryPeriod, type EntryStatus } from './afterHoursEntry';
import { useAfterHoursEntries } from './useAfterHoursEntries';

const COLORS = { early: '#2563eb', within: '#94a3b8', late: '#0891b2' };
const displayDay = (day: string) => day.split('-').reverse().join('/');

export default function AfterHoursEntryDashboard({ dashboardId, dashboardName, dashboardNotes, lang = 'en', isAdmin = false, dataUrl, initialRange, demoMode = false }: {
  dashboardId: string; dashboardName: string; dashboardNotes?: string | null; lang?: 'en' | 'th'; isAdmin?: boolean; dataUrl?: string; initialRange?: EntryDateRange; demoMode?: boolean;
}) {
  const th = lang === 'th';
  const copy = th ? {
    title: 'รถเข้าพื้นที่ลูกค้านอกเวลา', today: 'วันนี้', yesterday: 'เมื่อวาน', week: 'สัปดาห์นี้', month: 'เดือนนี้', custom: 'กำหนดช่วงวันที่',
    period: 'ช่วงวันที่', from: 'ตั้งแต่วันที่', to: 'ถึงวันที่', apply: 'แสดงข้อมูล', refresh: 'รีเฟรช', vehicleFilter: 'ทะเบียนรถ', fleetFilter: 'Fleet', clearFilters: 'ล้างตัวกรองรถและ Fleet',
    outside: 'เข้านอกเวลาทั้งหมด', early: 'ก่อนเวลา', late: 'หลังเวลา', within: 'เข้าในเวลา', vehicles: 'ทะเบียนนอกเวลา (คัน)',
    hours: 'เวลาที่อนุญาต', everyDay: 'ทุกวัน', areas: 'พื้นที่ลูกค้า', entries: 'รายการรถเข้าพื้นที่', count: 'รายการ',
    chart: 'จำนวนรถที่เข้าแต่ละช่วงเวลา', hour: 'รายชั่วโมง', day: 'รายวัน', all: 'ทุกสถานะ', tableStatus: 'สถานะในตาราง',
    status: 'สถานะ', difference: 'ต่างจากเวลาที่กำหนด', loading: 'กำลังอ่านข้อมูลจาก Google Sheets', empty: 'ไม่มีข้อมูลในช่วงวันที่นี้',
    invalid: 'รายการมีวันที่ไม่ถูกต้อง จึงไม่รวมในการคำนวณทุกช่วงวันที่', rangeError: 'เลือกวันที่เริ่มต้นไม่เกินวันที่สิ้นสุด',
    rule: 'ใช้เวลาที่ Admin บันทึกล่าสุดในการคำนวณข้อมูลทุกวัน รวมถึงข้อมูลย้อนหลัง',
  } : {
    title: 'After-Hours Customer Entry', today: 'Today', yesterday: 'Yesterday', week: 'This week', month: 'This month', custom: 'Custom range',
    period: 'Date period', from: 'From', to: 'To', apply: 'Apply range', refresh: 'Refresh', vehicleFilter: 'Vehicle No', fleetFilter: 'Fleet', clearFilters: 'Clear vehicle and fleet filters',
    outside: 'After-hours entries', early: 'Before hours', late: 'After hours', within: 'Within hours', vehicles: 'Unique after-hours vehicles',
    hours: 'Allowed hours', everyDay: 'Every day', areas: 'Customer areas', entries: 'Customer entry records', count: 'entries',
    chart: 'Entries by time', hour: 'Hourly', day: 'Daily', all: 'All statuses', tableStatus: 'Table status',
    status: 'Status', difference: 'Time outside allowed hours', loading: 'Reading Google Sheets', empty: 'No data for this period.',
    invalid: 'entries have unreadable dates and are excluded from every date period.', rangeError: 'Choose a start date on or before the end date.',
    rule: 'The latest Admin schedule applies every day, including historical entries.',
  };
  const [period, setPeriod] = useState<EntryPeriod>(initialRange ? 'custom' : 'today');
  const [range, setRange] = useState<EntryDateRange>(() => initialRange ?? entryPresetRange('today'));
  const [draft, setDraft] = useState(range);
  const [refresh, setRefresh] = useState(0);
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  const [selectedFleets, setSelectedFleets] = useState<string[]>([]);
  const [demoSettings, setDemoSettings] = useState<AfterHoursSettings | null>(null);
  const [scheduleMessage, setScheduleMessage] = useState('');
  const [chartMode, setChartMode] = useState<'hour' | 'day'>('hour');
  const [tableStatus, setTableStatus] = useState<EntryStatus | 'outside' | 'all'>('outside');
  const data = useAfterHoursEntries(dashboardId, range, refresh, dataUrl);
  const settings = demoMode && demoSettings ? demoSettings : data.settings;
  async function saveHours(hours: { startTime: string; endTime: string }) {
    setScheduleMessage('');
    if (demoMode) {
      setDemoSettings(validateAfterHoursSettings({ ...settings, ...hours }));
      setScheduleMessage(th ? 'เปลี่ยนเวลาในข้อมูลสาธิตแล้ว' : 'Demo hours updated.');
    } else {
      await saveAfterHoursSchedule({ dashboardId, ...hours });
      setRefresh((n) => n + 1);
      setScheduleMessage(th ? 'บันทึกเวลาร่วมกันแล้ว' : 'Shared hours saved.');
    }
  }
  // Keep Today and calendar presets correct if a dashboard remains open across Bangkok midnight.
  useEffect(() => {
    if (period === 'custom') return;
    const timer = setInterval(() => {
      const next = entryPresetRange(period);
      setRange((previous) => previous.from === next.from && previous.to === next.to ? previous : next);
    }, 60_000);
    return () => clearInterval(timer);
  }, [period]);
  function choosePeriod(value: EntryPeriod) {
    setPeriod(value);
    if (value === 'custom') { setDraft(range); return; }
    const next = entryPresetRange(value);
    setRange(next); setDraft(next);
  }
  const allEntries = useMemo(() => demoMode && demoSettings ? reclassifyEntries(data.entries, demoSettings) : data.entries, [data.entries, demoMode, demoSettings]);
  const vehicleOptions = useMemo(() => Array.from(new Set([...allEntries.map((entry) => entry.vehicle), ...selectedVehicles])).sort(), [allEntries, selectedVehicles]);
  const fleetOptions = useMemo(() => Array.from(new Set([...allEntries.map((entry) => entry.fleet), ...selectedFleets])).sort(), [allEntries, selectedFleets]);
  const entries = useMemo(() => filterAfterHoursEntries(allEntries, selectedVehicles, selectedFleets), [allEntries, selectedVehicles, selectedFleets]);
  const summary = useMemo(() => summarizeEntries(entries), [entries]);
  const tableEntries = useMemo(() => entries.filter((entry) => tableStatus === 'all'
    || (tableStatus === 'outside' ? entry.status !== 'within' : entry.status === tableStatus)), [entries, tableStatus]);
  const chart = useMemo(() => entryChartData(entries, chartMode), [entries, chartMode]);
  const maxCount = Math.max(1, ...chart.map((bucket) => bucket.early + bucket.within + bucket.late));
  const statuses: EntryStatus[] = ['early', 'within', 'late'];
  const columns: Column<AfterHoursEntry>[] = [
    { key: 'vehicle', label: 'Vehicle No', sortable: true },
    { key: 'driver', label: 'Driver Name', sortable: true },
    { key: 'fleet', label: 'Fleet', sortable: true },
    { key: 'timestamp', label: 'Alert Date Time', sortable: true, render: (_, row) => `${displayDay(row.day)} ${row.entryTime}` },
    { key: 'geofence', label: 'Geofence Name', sortable: true },
    { key: 'status', label: copy.status, render: (_, row) => <span className={row.status === 'early' ? badgeInfo : row.status === 'late' ? badgeWarning : badgeSuccess}>{copy[row.status]}</span> },
    { key: 'differenceSeconds', label: copy.difference, sortable: true, render: (_, row) => {
      if (row.status === 'within') return '—';
      const seconds = row.differenceSeconds;
      return `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds % 3600 / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    } },
  ];
  return <DashboardShell title={copy.title} subtitle={dashboardName} notes={dashboardNotes} lang={lang} dashboardId={dashboardId} isAdmin={isAdmin}
    lastUpdated={data.updated ? new Date(data.updated) : null} lastUpdatedTimeZone="Asia/Bangkok" isStale={data.status === 'error'} activeFilterCount={1 + Number(selectedVehicles.length > 0) + Number(selectedFleets.length > 0)}
    filterSummary={`${displayDay(range.from)} – ${displayDay(range.to)} · Asia/Bangkok`}
    actions={<button type="button" className={btnSecondary} onClick={() => setRefresh((n) => n + 1)}>{copy.refresh}</button>}>
    {/* The blurred card creates a stacking context; lift it above the KPI cards so menus can overlap them. */}
    <section className={`${cardSection} relative z-20`} aria-label={copy.period}>
      <div className="flex flex-wrap items-end gap-4">
        <label className={labelBase}>{copy.period}
          <select className={`${selectBase} mt-1`} value={period} onChange={(e) => choosePeriod(e.target.value as EntryPeriod)}>
            {(['today', 'yesterday', 'week', 'month', 'custom'] as const).map((value) => <option key={value} value={value}>{copy[value]}</option>)}
          </select>
        </label>
        {period === 'custom' && <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); if (isEntryRange(draft)) setRange({ ...draft }); }}>
          <label className={labelBase}>{copy.from}<input required type="date" className={`${inputBase} mt-1`} value={draft.from} onInput={(e) => setDraft({ ...draft, from: e.currentTarget.value })} /></label>
          <label className={labelBase}>{copy.to}<input required type="date" className={`${inputBase} mt-1`} value={draft.to} onInput={(e) => setDraft({ ...draft, to: e.currentTarget.value })} /></label>
          <button type="submit" disabled={!isEntryRange(draft)} className={`${btnPrimary} disabled:opacity-50`}>{copy.apply}</button>
          {!isEntryRange(draft) && <p role="alert" className="text-sm text-red-600">{copy.rangeError}</p>}
        </form>}
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div className="min-w-48 flex-1" role="group" aria-label={copy.vehicleFilter}><p className={`${labelBase} mb-1`}>{copy.vehicleFilter}</p><MultiSelect label={copy.vehicleFilter} options={vehicleOptions} selected={selectedVehicles} onChange={setSelectedVehicles} lang={lang} /></div>
        <div className="min-w-48 flex-1" role="group" aria-label={copy.fleetFilter}><p className={`${labelBase} mb-1`}>{copy.fleetFilter}</p><MultiSelect label={copy.fleetFilter} options={fleetOptions} selected={selectedFleets} onChange={setSelectedFleets} lang={lang} /></div>
        {(selectedVehicles.length > 0 || selectedFleets.length > 0) && <button type="button" className={btnSecondary} onClick={() => { setSelectedVehicles([]); setSelectedFleets([]); }}>{copy.clearFilters}</button>}
      </div>
      {settings && data.status === 'ready' && <div className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
        <p className="font-semibold">{copy.hours}: {settings.startTime}–{settings.endTime} · {copy.everyDay} · Asia/Bangkok</p>
        <p className="mt-1">{copy.areas}: {settings.geofenceNames.join(', ')}</p>
        <p className="mt-1 text-xs">{copy.rule}</p>
        {(isAdmin || demoMode) && <AfterHoursScheduleEditor key={`${settings.startTime}:${settings.endTime}`} settings={settings} lang={lang} demo={demoMode} onSave={saveHours} />}
      </div>}
      {scheduleMessage && <p role="status" className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">{scheduleMessage}</p>}
    </section>
    {data.status === 'loading' && <div className={cardSection} role="status" aria-live="polite">{copy.loading}… {data.scanned ? `(${data.scanned.toLocaleString()})` : ''}</div>}
    {data.status === 'error' && <div role="alert" className={`${cardSection} text-red-600 dark:text-red-400`}>{data.error}</div>}
    {data.status === 'ready' && <>
      {data.invalidDates > 0 && <p role="status" className="text-sm text-amber-700 dark:text-amber-300">{data.invalidDates.toLocaleString()} {copy.invalid}</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label={copy.outside} value={summary.outside.toLocaleString()} accentColor="#2563eb" />
        <KpiCard label={`${copy.early} (${settings?.startTime})`} value={summary.early.toLocaleString()} />
        <KpiCard label={`${copy.late} (${settings?.endTime})`} value={summary.late.toLocaleString()} accentColor="#0891b2" />
        <KpiCard label={copy.within} value={summary.within.toLocaleString()} />
        <KpiCard label={copy.vehicles} value={summary.vehicles.toLocaleString()} />
      </div>
      {entries.length === 0 ? <p role="status" className={cardSection}>{copy.empty}</p> : <section className={cardSection} aria-label={copy.chart}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={heading2}>{copy.chart}</h2>
          <div className="flex gap-2">{(['hour', 'day'] as const).map((mode) => <button type="button" key={mode} aria-pressed={chartMode === mode}
            onClick={() => setChartMode(mode)} className={chartMode === mode ? btnPrimary : btnSecondary}>{copy[mode]}</button>)}</div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <svg role="img" aria-label={copy.chart} width="100%" height="240" style={{ minWidth: Math.max(640, chart.length * 46) }} viewBox={`0 0 ${Math.max(640, chart.length * 46)} 240`}>
            <title>{copy.chart}</title>
            <desc>{chart.map((b) => `${b.key}: ${copy.early} ${b.early}, ${copy.within} ${b.within}, ${copy.late} ${b.late}`).join('; ')}</desc>
            {chart.map((bucket, index) => {
              const step = Math.max(640, chart.length * 46) / chart.length;
              let bottom = 206;
              return <g key={bucket.key}><title>{`${bucket.key}: ${copy.early} ${bucket.early}, ${copy.within} ${bucket.within}, ${copy.late} ${bucket.late}`}</title>
                {statuses.map((status) => { const height = bucket[status] / maxCount * 170; bottom -= height; return <rect key={status} x={index * step + 3} y={bottom} width={step - 6} height={height} fill={COLORS[status]} rx="2" />; })}
                <text x={index * step + step / 2} y="225" textAnchor="middle" fontSize="10" className="fill-zinc-500 dark:fill-zinc-400">{chartMode === 'hour' ? bucket.key : `${bucket.key.slice(8)}/${bucket.key.slice(5, 7)}`}</text>
              </g>;
            })}
          </svg>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-zinc-500 dark:text-zinc-400">{statuses.map((status) => <span key={status} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[status] }} />{copy[status]}</span>)}</div>
      </section>}
      <section className={cardSection} aria-label={copy.entries}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div><h2 className={heading2}>{copy.entries}</h2><p className={textSecondary}>{tableEntries.length.toLocaleString()} / {entries.length.toLocaleString()} {copy.count}</p></div>
          <label className={labelBase}>{copy.tableStatus}<select className={`${selectBase} mt-1`} value={tableStatus} onChange={(e) => setTableStatus(e.target.value as typeof tableStatus)}>
            {(['outside', 'early', 'late', 'within', 'all'] as const).map((status) => <option key={status} value={status}>{copy[status]}</option>)}
          </select></label>
        </div>
        <DataTable key={JSON.stringify([range, tableStatus, selectedVehicles, selectedFleets, settings?.startTime, settings?.endTime])} columns={columns} data={tableEntries} defaultSort={{ key: 'timestamp', direction: 'desc' }} pageSize={25} ariaLabel={copy.entries} />
      </section>
    </>}
  </DashboardShell>;
}

'use client';

import { useMemo, useState } from 'react';
import { dashboardSectionClass } from './DashboardShell';
import { heading2, textSecondary } from 'app/ui/design-tokens';
import type { buildSummaryRosterData } from './summaryRosterData';
import type { DriverRosterSettings } from './driverRoster';
import ExportButton from 'app/ui/ExportButton';

type Props = { model: ReturnType<typeof buildSummaryRosterData>; lang: 'en' | 'th'; rosterEnabled?: boolean;
  namePolicy?: DriverRosterSettings['namePolicy']; onRefreshRoster?: () => void };
const PAGE_SIZE = 20;

export default function SummaryDriverTable({ model, lang, rosterEnabled = false, namePolicy = 'recorded', onRefreshRoster }: Props) {
  const th = lang === 'th';
  const [filter, setFilter] = useState<'all' | 'alerts' | 'zero'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => model.data.filter((row) => {
    if (filter === 'alerts' && row.total === 0) return false;
    if (filter === 'zero' && row.total > 0) return false;
    return `${row.vehicle} ${row.driver}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  }), [model.data, filter, search]);
  const lastPage = Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1);
  const currentPage = Math.min(page, lastPage);
  const shown = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const exportData = filtered.map((row) => ({ Vehicle: row.vehicle, Driver: row.driver, Fleet: row.fleet,
    ...Object.fromEntries(model.columns.map((column) => [column.label, row.counts[column.key] ?? 0])),
    Total: row.total, Status: row.total ? 'Alerts recorded' : 'No alerts recorded' }));
  const tabs = [
    { key: 'all' as const, text: th ? 'ทั้งหมด' : 'All', count: model.data.length },
    { key: 'alerts' as const, text: th ? 'มีการแจ้งเตือน' : 'With alerts', count: model.data.filter((row) => row.total > 0).length },
    { key: 'zero' as const, text: th ? 'ไม่พบการแจ้งเตือน' : 'No alerts', count: model.data.filter((row) => row.total === 0).length },
  ];
  return (
    <section className={`${dashboardSectionClass} min-w-0`} aria-label={th ? 'คนขับและจำนวนการแจ้งเตือน' : 'Drivers and alert counts'}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">{rosterEnabled ? (th ? 'รายชื่อคนขับครบทุกคน' : 'Complete driver roster') : (th ? 'ข้อมูลแยกตามประเภท' : 'Classified data')}</p>
          <h2 className={heading2}>{th ? 'คนขับและจำนวนการแจ้งเตือน' : 'Drivers & alert counts'}</h2>
          <p className={`mt-1 ${textSecondary}`}>{rosterEnabled
            ? (th ? 'รวมคนขับที่ไม่พบการแจ้งเตือนในช่วงเวลาและตัวกรองที่เลือก' : 'Includes drivers with no recorded alerts for the selected period and filters.')
            : (th ? 'จำนวนการแจ้งเตือนแยกตามรถและคนขับ' : 'Alert counts by vehicle and driver.')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onRefreshRoster && <button type="button" onClick={onRefreshRoster} className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">{th ? 'อัปเดตรายชื่อ' : 'Refresh roster'}</button>}
          <ExportButton data={exportData} dashboardName="driver-alert-counts" lang={lang} label={th ? 'ส่งออกตาราง' : 'Export table'} />
        </div>
      </div>
      {rosterEnabled && <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: th ? 'คนขับในมุมมองนี้' : 'Drivers in view', value: model.totalDrivers, color: 'text-zinc-900 dark:text-zinc-100' },
          { label: th ? 'มีการแจ้งเตือน' : 'With alerts', value: model.driversWithAlerts, color: 'text-amber-700 dark:text-amber-400' },
          { label: th ? 'ไม่พบการแจ้งเตือน' : 'No alerts recorded', value: model.driversWithoutAlerts, color: 'text-teal-700 dark:text-teal-400' },
          { label: 'OverSpeed', value: model.overspeed, color: 'text-blue-700 dark:text-blue-400' },
        ].map((item) => <div key={item.label} className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40"><div className="text-xs text-zinc-500 dark:text-zinc-400">{item.label}</div><div className={`mt-1 text-2xl font-bold tabular-nums ${item.color}`}>{item.value}</div></div>)}
      </div>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-950" role="group" aria-label={th ? 'กรองสถานะการแจ้งเตือน' : 'Filter alert status'}>
          {tabs.map((tab) => <button key={tab.key} type="button" aria-pressed={filter === tab.key} onClick={() => { setFilter(tab.key); setPage(0); }} className={`rounded-md px-3 py-2 text-xs font-medium transition-colors ${filter === tab.key ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white'}`}>{tab.text}<span className="ml-2 tabular-nums opacity-70">{tab.count}</span></button>)}
        </div>
        <input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} aria-label={th ? 'ค้นหาคนขับหรือรถ' : 'Search driver or vehicle'} placeholder={th ? 'ค้นหาคนขับหรือรถ…' : 'Search driver or vehicle…'} className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:w-60 dark:border-zinc-700" />
      </div>
      <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800" tabIndex={0} role="region" aria-label={th ? 'ตารางการแจ้งเตือน เลื่อนแนวนอนได้' : 'Alert table, scroll horizontally'}>
        <table className="w-full min-w-[1000px] border-collapse text-xs" aria-label={th ? 'ตารางจำนวนการแจ้งเตือน' : 'Alert counts by vehicle and driver'}>
          <thead><tr className="bg-zinc-50 dark:bg-zinc-950">
            <th scope="col" className="px-4 py-3 text-left font-semibold text-zinc-500">{th ? 'รถ' : 'Vehicle'}</th>
            <th scope="col" className="px-4 py-3 text-left font-semibold text-zinc-500">{th ? 'คนขับ' : 'Driver'}</th>
            {model.columns.map((column) => <th key={column.key} scope="col" className={`px-3 py-3 text-center font-semibold ${column.key === 'Overspeed' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' : 'text-zinc-500 dark:text-zinc-400'}`}>{column.label}</th>)}
            <th scope="col" className="px-3 py-3 text-center font-semibold text-zinc-500">{th ? 'รวม' : 'Total'}</th>
            <th scope="col" className="px-4 py-3 text-left font-semibold text-zinc-500">{th ? 'สถานะ' : 'Status'}</th>
          </tr></thead>
          <tbody>{shown.length === 0
            ? <tr><td colSpan={model.columns.length + 4} className="p-8 text-center text-zinc-500">{th ? 'ไม่พบคนขับที่ตรงกับตัวกรอง' : 'No drivers match these filters.'}</td></tr>
            : shown.map((row) => <tr key={`${row.fleet}\0${row.vehicle}\0${row.driver}`} className="border-t border-zinc-100 hover:bg-zinc-50/60 dark:border-zinc-800/70 dark:hover:bg-zinc-800/30">
              <th scope="row" className="px-4 py-3 text-left font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">{row.vehicle}</th>
              <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-100">{row.driver}{rosterEnabled && !row.inRoster && <span className="mt-0.5 block text-[10px] font-normal text-zinc-500">{th ? 'ชื่อจากรายการแจ้งเตือน' : 'From alert records'}</span>}</td>
              {model.columns.map((column) => { const count = row.counts[column.key] ?? 0; return <td key={column.key} className={`px-3 py-3 text-center tabular-nums ${count > 0 ? 'font-semibold text-amber-800 dark:text-amber-200' : column.key === 'Overspeed' ? 'bg-blue-50/60 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400' : 'text-zinc-400 dark:text-zinc-500'}`} style={count > 0 ? { backgroundColor: `rgba(217,119,6,${0.1 + 0.3 * count / model.maxCount})` } : undefined}>{count}</td>; })}
              <td className="px-3 py-3 text-center font-bold tabular-nums text-zinc-800 dark:text-zinc-100">{row.total}</td>
              <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-medium ${row.total ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' : 'bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300'}`}><span className={`h-1.5 w-1.5 rounded-full ${row.total ? 'bg-amber-500' : 'bg-teal-500'}`} />{row.total ? (th ? 'มีการแจ้งเตือน' : 'Alerts recorded') : (th ? 'ไม่พบการแจ้งเตือน' : 'No alerts recorded')}</span></td>
            </tr>)}</tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
        <p>{filtered.length ? currentPage * PAGE_SIZE + 1 : 0}–{Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} / {filtered.length} {th ? 'รายการ' : 'assignments'}</p>
        {lastPage > 0 && <div className="flex gap-2"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="rounded border border-zinc-300 px-3 py-1.5 disabled:opacity-30 dark:border-zinc-700">{th ? 'ก่อนหน้า' : 'Previous'}</button><button type="button" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)} className="rounded border border-zinc-300 px-3 py-1.5 disabled:opacity-30 dark:border-zinc-700">{th ? 'ถัดไป' : 'Next'}</button></div>}
      </div>
      {rosterEnabled && <p className="mt-3 border-t border-zinc-100 pt-3 text-xs leading-relaxed text-zinc-500 dark:border-zinc-800">{namePolicy === 'vehicle'
        ? (th ? 'ชื่อคนขับอ้างอิงการจับคู่รถในรายชื่อปัจจุบัน ' : 'Names follow the current roster’s vehicle assignments. ')
        : (th ? 'คงชื่อคนขับที่บันทึกในแต่ละการแจ้งเตือน ' : 'Names recorded on individual alerts are preserved. ')}{th ? 'ไม่มีการแจ้งเตือนไม่ได้ยืนยันว่ามีการขับขี่ จึงไม่ให้คะแนนความปลอดภัยจากข้อมูลส่วนนี้' : 'No recorded alerts does not confirm driving activity, so these drivers are not assigned a safety score.'}</p>}
    </section>
  );
}

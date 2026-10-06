'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import useGoogleSheet from './useGoogleSheet';
import { rejectFutureMonthKeys, type AlertRule } from './dashboardDataUtils';
import {
  buildVinythaiAlerts, filterVinythaiAlerts, summarizeVinythaiAlerts,
  type VinythaiAlert, type VinythaiFilters,
} from './vinythaiSummaryData';
import styles from './VinythaiSummaryDashboard.module.css';
import type { Cell, SheetData } from 'write-excel-file/browser';

type Props = {
  dashboardId: string;
  dashboardName: string;
  sheetId: string;
  sheetGid: string;
  dashboardNotes?: string | null;
  organizationName?: string | null;
  organizationNames?: string[] | null;
  allowedAlertTypes?: string[] | null;
  allowedRemarks?: string[] | null;
  alertRules?: AlertRule[] | null;
  lang?: 'en' | 'th';
};

const COLORS = ['#5793ed', '#d36b38', '#51a581', '#c69232', '#cf6197', '#8f81dc', '#3fbfc5'];
const ALL: VinythaiFilters = { month: 'all', customer: 'all', type: 'all', hiddenCustomers: [] };
const PAGE_SIZE = 25;

function monthLabel(key: string, lang: 'en' | 'th', short = false) {
  return new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-GB', {
    month: short ? 'short' : 'long', year: short ? undefined : 'numeric', timeZone: 'UTC',
  }).format(new Date(`${key}-01T00:00:00Z`));
}

function dateLabel(date: Date, lang: 'en' | 'th') {
  return new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-GB', {
    day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  }).format(date);
}

async function downloadReport(alerts: VinythaiAlert[], filters: VinythaiFilters) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const header = (value: string): Cell => ({ value, type: String, fontWeight: 'bold', backgroundColor: '#202328', textColor: '#ffffff' });
  const summary = summarizeVinythaiAlerts(alerts);
  const detail: SheetData = [
    ['Date / time (Bangkok)', 'Vehicle', 'Customer / Fleet', 'Alert type', 'Remarks', 'Speed (km/h)', 'Driver', 'Location'].map(header),
    ...alerts.map((a) => [
      { value: a.date.toISOString().slice(0, 19).replace('T', ' '), type: String },
      ...[a.vehicle, a.fleet, a.alertType, a.remark].map((value) => ({ value, type: String })),
      { value: a.speed ?? undefined, type: Number },
      ...[a.driver, a.location].map((value) => ({ value, type: String })),
    ]),
  ];
  await writeXlsxFile([
    { sheet: 'Alerts', data: detail, columns: [23, 20, 30, 30, 24, 18, 28, 50].map((width) => ({ width })) },
    { sheet: 'Summary', data: [
      [header('Metric'), header('Value')],
      [{ value: 'Alert count', type: String }, { value: summary.total, type: Number }],
      [{ value: 'Vehicles with alerts', type: String }, { value: summary.vehicleCount, type: Number }],
      [{ value: 'Average speed (km/h)', type: String }, { value: summary.averageSpeed ?? undefined, type: Number }],
      [{ value: 'Month', type: String }, { value: filters.month, type: String }],
      [{ value: 'Customer', type: String }, { value: filters.customer, type: String }],
      [{ value: 'Alert type', type: String }, { value: filters.type, type: String }],
      [{ value: 'Hidden customers', type: String }, { value: filters.hiddenCustomers.join(', '), type: String }],
      [{ value: 'Counting rule', type: String }, { value: 'Fleet roster matches; exact duplicates and false/no-video alerts excluded; configured dashboard policies apply.', type: String }],
    ], columns: [{ width: 28 }, { width: 100 }] },
  ]).toFile(`Vinythai_Monthly_Summary_${filters.month}.xlsx`);
}

export function VinythaiSummaryReport({
  alerts, monthKeys, dashboardName, dashboardNotes, lang = 'th', loading = false,
  error, refreshing = false, progress, lastUpdated, onRefresh,
}: {
  alerts: VinythaiAlert[]; monthKeys: string[]; dashboardName: string; dashboardNotes?: string | null;
  lang?: 'en' | 'th'; loading?: boolean; error?: string | null; refreshing?: boolean;
  progress?: { done: number; total: number } | null; lastUpdated?: Date | null; onRefresh?: () => void;
}) {
  const [filters, setFilters] = useState<VinythaiFilters>(ALL);
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const th = lang === 'th';
  const copy = (thai: string, english: string) => th ? thai : english;
  const number = (value: number) => value.toLocaleString(th ? 'th-TH' : 'en-GB');
  const customers = useMemo(() => Array.from(new Set(alerts.map((a) => a.fleet))).sort(), [alerts]);
  const types = useMemo(() => Array.from(new Set(alerts.map((a) => a.alertType))).sort(), [alerts]);
  const colors = useMemo(() => new Map(customers.map((customer, index) => [customer, COLORS[index % COLORS.length]!])), [customers]);
  const filtered = useMemo(() => filterVinythaiAlerts(alerts, filters), [alerts, filters]);
  const summary = useMemo(() => summarizeVinythaiAlerts(filtered), [filtered]);
  // Keep the month overview visible when a month is selected, like the reference.
  const monthly = useMemo(() => summarizeVinythaiAlerts(filterVinythaiAlerts(alerts, { ...filters, month: 'all' })), [alerts, filters]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const pageRows = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const change = (next: Partial<VinythaiFilters>) => { setFilters((prev) => ({ ...prev, ...next })); setPage(0); };
  const reset = () => { setFilters(ALL); setPage(0); };
  const range = filters.month === 'all'
    ? copy('ทุกเดือน', 'All months')
    : monthLabel(filters.month, lang);
  const context = `${range} · ${filters.customer === 'all' ? copy('ลูกค้าทั้งหมด', 'All customers') : filters.customer}`;
  const monthTotals = monthKeys.map((key) => Array.from(monthly.months.get(key)?.values() ?? []).reduce((a, b) => a + b, 0));
  const maxMonthly = Math.max(1, ...monthTotals);
  const axisMax = Math.max(4, Math.ceil(maxMonthly / 4) * 4);
  const chartWidth = Math.max(1000, monthKeys.length * 80 + 80);
  const step = (chartWidth - 80) / Math.max(1, monthKeys.length);
  const maxHourly = Math.max(1, ...summary.hours.map((h) => h.count));
  const busy = loading || refreshing || !!error;

  return (
    <div className={styles.report}>
      <div className={styles.topline}>
        <span>VINYTHAI · {copy('รายงานสรุปการแจ้งเตือนรายเดือน', 'MONTHLY ALERT SUMMARY')}</span>
        <Link href="/dashboard">{copy('แดชบอร์ดทั้งหมด', 'All dashboards')} ↗</Link>
      </div>
      <header className={styles.header}>
        <h1>{dashboardName}</h1>
        <p>{copy('นับเฉพาะรถในฟลีท · แยกลูกค้าตาม Fleet ในชีต', 'Fleet vehicles only · Customers grouped by the sheet’s Fleet column')}</p>
      </header>
      <div className={styles.filters}>
        <label>{copy('เดือน', 'Month')}
          <select aria-label={copy('เดือน', 'Month')} value={filters.month} onChange={(e) => change({ month: e.target.value })} disabled={loading}>
            <option value="all">{copy('ทุกเดือน', 'All months')}</option>
            {monthKeys.map((key) => <option key={key} value={key}>{monthLabel(key, lang)}</option>)}
          </select>
        </label>
        <label>{copy('ลูกค้า', 'Customer')}
          <select aria-label={copy('ลูกค้า', 'Customer')} value={filters.customer} onChange={(e) => change({ customer: e.target.value, hiddenCustomers: [] })} disabled={loading}>
            <option value="all">{copy('ลูกค้าทั้งหมด', 'All customers')}</option>
            {customers.map((customer) => <option key={customer}>{customer}</option>)}
          </select>
        </label>
        <label>{copy('ประเภทแจ้งเตือน', 'Alert type')}
          <select aria-label={copy('ประเภทแจ้งเตือน', 'Alert type')} value={filters.type} onChange={(e) => change({ type: e.target.value })} disabled={loading}>
            <option value="all">{copy('ทุกประเภท', 'All alert types')}</option>
            <option value="remark:mobile phone">{copy('ใช้โทรศัพท์ (Mobile Phone)', 'Mobile Phone')}</option>
            {types.map((type) => <option key={type}>{type}</option>)}
          </select>
        </label>
        <button className={styles.reset} onClick={reset}>{copy('ล้างตัวเลือก', 'Reset filters')}</button>
        <button className={styles.export} disabled={busy || exporting || filtered.length === 0} onClick={async () => {
          setExporting(true); setExportError(null);
          try { await downloadReport(filtered, filters); }
          catch { setExportError(copy('ส่งออกไม่สำเร็จ โปรดลองอีกครั้ง', 'Export failed. Please try again.')); }
          finally { setExporting(false); }
        }}><span aria-hidden="true">↓</span>{exporting ? copy('กำลังส่งออก…', 'Exporting…') : copy('ดาวน์โหลด Excel', 'Download Excel')}</button>
      </div>
      <div className={styles.status} aria-live="polite">
        <span>{refreshing ? copy('กำลังอัปเดตข้อมูล', 'Refreshing data') : lastUpdated ? `${copy('อัปเดต', 'Updated')} ${lastUpdated.toLocaleTimeString(th ? 'th-TH' : 'en-GB')}` : context}{progress ? ` · ${progress.done}/${progress.total}` : ''}</span>
        {onRefresh ? <button onClick={onRefresh} disabled={loading || refreshing}>{copy('รีเฟรช', 'Refresh')}</button> : null}
      </div>
      {exportError ? <p role="alert" className={styles.error}>{exportError}</p> : null}
      {error ? <div role="alert" className={styles.error}>{copy('ไม่สามารถโหลดข้อมูลครบทุกเดือนได้', 'Unable to load complete monthly data')}: {error}</div>
        : loading ? <div role="status" className={styles.message}>{copy('กำลังโหลดข้อมูลรายเดือน…', 'Loading complete monthly data…')}{progress ? ` ${progress.done}/${progress.total}` : ''}</div>
        : <>
          <div className={styles.kpis}>
            <div className={styles.card}><span>{copy('จำนวนแจ้งเตือน', 'Alert count')}</span><strong data-testid="vinythai-total">{number(summary.total)}</strong><small>{range}</small></div>
            <div className={styles.card}><span>{copy('จำนวนรถที่เกิดแจ้งเตือน', 'Vehicles with alerts')}</span><strong data-testid="vinythai-vehicles">{number(summary.vehicleCount)}</strong><small>{copy('คัน', 'vehicles')}</small></div>
            <div className={styles.card}><span>{copy('รถที่แจ้งเตือนบ่อยสุด', 'Vehicle with most alerts')}</span><strong className={styles.plate}>{summary.topVehicle?.label ?? '—'}</strong><small>{summary.topVehicle ? `${number(summary.topVehicle.count)} ${copy('ครั้ง', 'alerts')} · ${(summary.topVehicle.count / summary.total * 100).toFixed(0)}%` : '—'}</small></div>
            <div className={styles.card}><span>{copy('ความเร็วเฉลี่ยขณะเกิดเหตุ', 'Average speed during alerts')}</span><strong>{summary.averageSpeed === null ? '—' : summary.averageSpeed.toFixed(1)}</strong><small>{copy('กม./ชม.', 'km/h')}</small></div>
          </div>
          {summary.total === 0 ? <p className={styles.message}>{copy('ไม่พบการแจ้งเตือนสำหรับตัวเลือกนี้', 'No fleet alerts match these filters.')}</p> : null}
          <section className={styles.panel}>
            <div className={styles.panelHeading}><h2>{copy('จำนวนแจ้งเตือนรายเดือน', 'Monthly alert count')}</h2><small>{copy('คลิกแท่งเพื่อเลือกเดือน', 'Click a bar to select a month')}</small></div>
            <div className={styles.legend}>{customers.map((customer) => <button key={customer} aria-pressed={!filters.hiddenCustomers.includes(customer)} onClick={() => change({ hiddenCustomers: filters.hiddenCustomers.includes(customer) ? filters.hiddenCustomers.filter((c) => c !== customer) : [...filters.hiddenCustomers, customer] })}><i style={{ background: colors.get(customer) }} />{customer}</button>)}</div>
            <div className={styles.chartScroll}>
              <svg viewBox={`0 0 ${chartWidth} 290`} style={{ minWidth: chartWidth }} role="group" aria-label={copy('กราฟแจ้งเตือนรายเดือน', 'Monthly alert chart')}>
                {[0, 1, 2, 3, 4].map((tick) => <g key={tick}><line x1="55" x2={chartWidth - 15} y1={240 - tick * 50} y2={240 - tick * 50} className={styles.gridline} /><text x="45" y={244 - tick * 50} textAnchor="end">{number(axisMax * tick / 4)}</text></g>)}
                {monthKeys.map((key, index) => {
                  let offset = 0;
                  const counts = monthly.months.get(key);
                  const total = monthTotals[index]!;
                  const x = 55 + index * step + step * 0.22;
                  const width = step * 0.56;
                  return <g key={key} role="button" tabIndex={0} aria-label={`${monthLabel(key, lang)}: ${total}`} aria-pressed={filters.month === key} onClick={() => change({ month: filters.month === key ? 'all' : key })} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); change({ month: filters.month === key ? 'all' : key }); } }} className={styles.monthBar}>
                    <rect x={x - 3} y="20" width={width + 6} height="220" fill={filters.month === key ? '#ffffff0d' : 'transparent'} />
                    {customers.map((customer) => { const count = counts?.get(customer) ?? 0; const height = count / axisMax * 200; offset += height; return count > 0 ? <rect key={customer} x={x} y={240 - offset} width={width} height={height} fill={colors.get(customer)}><title>{`${customer}: ${number(count)}`}</title></rect> : null; })}
                    <text x={x + width / 2} y={230 - total / axisMax * 200} textAnchor="middle" className={styles.chartTotal}>{number(total)}</text>
                    <text x={x + width / 2} y="266" textAnchor="middle">{monthLabel(key, lang, true)}</text>
                  </g>;
                })}
              </svg>
            </div>
          </section>
          <div className={styles.twoColumns}>
            <section className={styles.panel}>
              <div className={styles.panelHeading}><h2>{copy('แยกตามลูกค้า', 'By customer')}</h2></div><p className={styles.subtitle}>{context}</p>
              <div className={styles.donutLayout}>
                <svg viewBox="0 0 180 180" className={styles.donut} role="img" aria-label={copy('สัดส่วนแจ้งเตือนตามลูกค้า', 'Alert distribution by customer')}>
                  <circle cx="90" cy="90" r="65" fill="none" stroke="#303339" strokeWidth="23" />
                  {summary.customers.map((customer, index) => { const before = summary.customers.slice(0, index).reduce((sum, c) => sum + c.count, 0); return <circle key={customer.label} cx="90" cy="90" r="65" fill="none" stroke={colors.get(customer.label)} strokeWidth="23" strokeDasharray={`${customer.count / summary.total * 408.407} 408.407`} strokeDashoffset={-before / summary.total * 408.407} transform="rotate(-90 90 90)"><title>{`${customer.label}: ${number(customer.count)}`}</title></circle>; })}
                  <text x="90" y="88" textAnchor="middle" className={styles.donutTotal}>{number(summary.total)}</text><text x="90" y="110" textAnchor="middle">{copy('แจ้งเตือน', 'alerts')}</text>
                </svg>
                <div className={styles.customerList}>{summary.customers.map((customer) => <button key={customer.label} onClick={() => change({ customer: customer.label, hiddenCustomers: [] })}><span><i style={{ background: colors.get(customer.label) }} />{customer.label}</span><strong>{number(customer.count)} <small>({(customer.count / summary.total * 100).toFixed(0)}%)</small></strong></button>)}</div>
              </div>
            </section>
            <section className={styles.panel}>
              <div className={styles.panelHeading}><h2>{copy('แยกตามทะเบียนรถ', 'By vehicle')}</h2></div><p className={styles.subtitle}>{context}</p>
              <div className={styles.ranking}>{summary.vehicles.slice(0, 12).map((vehicle) => <div key={vehicle.label}><span>{vehicle.label}</span><div className={styles.track}><div style={{ width: `${vehicle.count / (summary.topVehicle?.count ?? 1) * 100}%` }} /></div><strong>{number(vehicle.count)}</strong></div>)}</div>
              <small className={styles.subtitle}>{copy('แสดง', 'Showing')} {Math.min(12, summary.vehicleCount)} / {summary.vehicleCount} {copy('คัน', 'vehicles')}</small>
            </section>
          </div>
          <section className={styles.panel}>
            <div className={styles.panelHeading}><h2>{copy('ช่วงเวลาที่เกิดแจ้งเตือน', 'Alerts by hour')}</h2><small>{copy('เวลาประเทศไทย', 'Bangkok time')}</small></div><p className={styles.subtitle}>{context}</p>
            <div className={styles.chartScroll}><svg viewBox="0 0 1000 225" style={{ minWidth: 700 }} role="img" aria-label={copy('แจ้งเตือนตามชั่วโมง', 'Hourly alert count')}>
              {[0, 1, 2, 3].map((tick) => <g key={tick}><line x1="40" x2="985" y1={185 - tick * 50} y2={185 - tick * 50} className={styles.gridline} /><text x="32" y={190 - tick * 50} textAnchor="end">{number(Math.round(maxHourly * tick / 3))}</text></g>)}
              {summary.hours.map(({ hour, count }) => <g key={hour}><rect x={48 + hour * 39} y={185 - count / maxHourly * 150} width="25" height={count / maxHourly * 150} rx="2" fill="#5793ed"><title>{`${String(hour).padStart(2, '0')}:00 · ${number(count)}`}</title></rect><text x={60 + hour * 39} y="210" textAnchor="middle">{String(hour).padStart(2, '0')}</text></g>)}
            </svg></div>
          </section>
          <section className={styles.panel}>
            <div className={styles.panelHeading}><h2>{copy('รายการแจ้งเตือน', 'Alert details')}</h2><small>{number(filtered.length)} {copy('รายการ', 'events')}</small></div><p className={styles.subtitle}>{context}</p>
            <div className={styles.tableScroll}><table><thead><tr>{[copy('วันเวลา', 'Date / time'), copy('ทะเบียน', 'Vehicle'), copy('ลูกค้า', 'Customer'), copy('ประเภทแจ้งเตือน', 'Alert type'), copy('ความเร็ว (กม./ชม.)', 'Speed (km/h)'), copy('หมายเหตุ', 'Remarks')].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{pageRows.map((alert) => <tr key={alert.key}><td>{dateLabel(alert.date, lang)}</td><td>{alert.vehicle}</td><td>{alert.fleet}</td><td>{alert.alertType}</td><td>{alert.speed ?? '—'}</td><td>{alert.remark || '—'}</td></tr>)}</tbody></table></div>
            <div className={styles.pagination}><span>{number(currentPage * PAGE_SIZE + (filtered.length ? 1 : 0))}–{number(Math.min((currentPage + 1) * PAGE_SIZE, filtered.length))} / {number(filtered.length)}</span><div><button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>{copy('ก่อนหน้า', 'Previous')}</button><button disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)}>{copy('ถัดไป', 'Next')}</button></div></div>
          </section>
        </>}
      <footer className={styles.footer}>{copy('เฉพาะรถที่มี Fleet ในชีต · ตัดแถวซ้ำและ False alert / No video · ใช้กฎที่กำหนดไว้สำหรับแดชบอร์ด', 'Only vehicles with a Fleet roster match · Exact duplicates and false/no-video alerts excluded · Dashboard alert policies apply')}{dashboardNotes ? <p>{dashboardNotes}</p> : null}<span>SongdeeGPS</span></footer>
    </div>
  );
}

export default function VinythaiSummaryDashboard(props: Props) {
  const [monthKeys, setMonthKeys] = useState<string[]>([]);
  const sheet = useGoogleSheet({ sheetId: props.sheetId, gid: props.sheetGid, monthKeys, loadMonthCatalog: true, requireMonthScope: true, fallbackToTrackTime: true, preserveSourceFields: true });
  const catalogKeys = useMemo(() => rejectFutureMonthKeys(sheet.availableMonths.map((m) => m.key)).sort(), [sheet.availableMonths]);
  // React adjusts state before children render when a newly loaded catalog arrives.
  if (catalogKeys.join(',') !== monthKeys.join(',')) setMonthKeys(catalogKeys);
  const { organizationName, organizationNames, allowedAlertTypes, allowedRemarks, alertRules } = props;
  const alerts = useMemo(() => buildVinythaiAlerts(sheet.rows, { organizationName, organizationNames, allowedAlertTypes, allowedRemarks, alertRules }).filter((a) => monthKeys.includes(a.month)), [sheet.rows, organizationName, organizationNames, allowedAlertTypes, allowedRemarks, alertRules, monthKeys]);
  return <VinythaiSummaryReport alerts={alerts} monthKeys={monthKeys} dashboardName={props.dashboardName} dashboardNotes={props.dashboardNotes} lang={props.lang} loading={sheet.loading && (sheet.availableMonths.length === 0 || monthKeys.length > 0)} refreshing={sheet.refreshing} error={sheet.error} progress={sheet.progress} lastUpdated={sheet.lastUpdated} onRefresh={sheet.refresh} />;
}

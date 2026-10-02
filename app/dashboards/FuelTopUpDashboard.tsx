'use client';

import { useMemo, useState } from 'react';
import DashboardShell, { dashboardSectionClass } from './DashboardShell';
import useFuelSheet from './useFuelSheet';
import FuelTelemetryChart from './FuelTelemetryChart';
import { detectFuelIncreases, formatFuelTime, parseFuelRows, type FuelIncrease, type FuelReading } from './fuelData';
import type { DashboardLang } from 'app/dashboard/i18n-copy';
import KpiCard from 'app/ui/KpiCard';
import ExportButton from 'app/ui/ExportButton';
import { DataTable, type Column } from 'app/ui/DataTable';
import { btnSecondary, heading2, inputBase } from 'app/ui/design-tokens';

type Props = {
  dashboardId: string;
  dashboardName: string;
  sheetId: string;
  sheetGid: string;
  dashboardNotes?: string | null;
  organizationName?: string | null;
  organizationNames?: string[] | null;
  lang?: DashboardLang;
  isAdmin?: boolean;
};

const number = (value: number) => value.toLocaleString('en-GB', { maximumFractionDigits: 2 });
const valueOrDash = (value: number | null) => value === null ? '—' : number(value);
const toTime = (value: string) => value ? Date.parse(`${value}Z`) : null;

export default function FuelTopUpDashboard({ dashboardId, dashboardName, sheetId, sheetGid, dashboardNotes, organizationName, organizationNames, lang = 'en', isAdmin }: Props) {
  const t = (en: string, th: string) => lang === 'th' ? th : en;
  const sheet = useFuelSheet(sheetId, sheetGid);
  const [vehicle, setVehicle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [minimum, setMinimum] = useState('5');
  const [unitMode, setUnitMode] = useState('source');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const unit = unitMode === 'litres' ? 'L' : t('source units', 'หน่วยตามชีต');
  const threshold = Number(minimum);
  const invalidThreshold = minimum.trim() === '' || !Number.isFinite(threshold) || threshold <= 0;
  const startTime = toTime(start), endTime = toTime(end);
  const invalidRange = (startTime !== null && !Number.isFinite(startTime)) || (endTime !== null && !Number.isFinite(endTime)) || (startTime !== null && endTime !== null && startTime > endTime);
  const fleetColumn = sheet.columns.find((c) => ['fleet', 'fleet name', 'organization', 'ฟลีท', 'กลุ่มรถ'].includes(c.label.trim().toLowerCase()));
  const hasConfiguredFleet = Boolean(organizationNames?.length || organizationName);
  const scopedRows = useMemo(() => {
    const scope = new Set((organizationNames?.length ? organizationNames : organizationName ? [organizationName] : []).map((v) => v.trim().toLowerCase()));
    // This telemetry template uses a dedicated sheet when no fleet dimension exists.
    // The protected viewer still requires entitlement to every configured organization.
    return !fleetColumn || !scope.size ? sheet.rows : sheet.rows.filter((row) => scope.has(String(row[fleetColumn.fieldKey] ?? '').trim().toLowerCase()));
  }, [fleetColumn, sheet.rows, organizationName, organizationNames]);
  const parsed = useMemo(() => parseFuelRows(scopedRows), [scopedRows]);
  const vehicles = useMemo(() => Array.from(new Set(parsed.readings.map((row) => row.vehicle))).sort(), [parsed.readings]);
  const readings = useMemo(() => invalidRange ? [] : parsed.readings.filter((row) => (!vehicle || row.vehicle === vehicle) && (startTime === null || row.timestamp >= startTime) && (endTime === null || row.timestamp <= endTime)), [parsed.readings, vehicle, startTime, endTime, invalidRange]);
  const increases = useMemo(() => invalidThreshold ? [] : detectFuelIncreases(readings, threshold), [readings, threshold, invalidThreshold]);
  const selected = increases.find((event) => event.id === selectedId);
  const totalIncrease = increases.reduce((sum, row) => sum + row.amount, 0);
  const stationary = increases.filter((row) => row.stationary);
  const missingFuel = readings.filter((row) => row.fuel === null).length;
  const blockedVehicles = Array.from(new Set(readings.filter((row) => row.continuityBlocked).map((row) => row.vehicle)));
  const hasComparableReadings = useMemo(() => {
    const previous = new Map<string, FuelReading>();
    return readings.some((row) => {
      const before = previous.get(row.vehicle);
      previous.set(row.vehicle, row);
      return !row.continuityBlocked && before && before.fuel !== null && row.fuel !== null && row.timestamp > before.timestamp && row.timestamp - before.timestamp <= 600_000;
    });
  }, [readings]);
  const detectionUnavailable = invalidThreshold || invalidRange || blockedVehicles.length > 0 || !hasComparableReadings;
  const sourceUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/edit#gid=${encodeURIComponent(sheetGid)}`;
  const reset = () => { setVehicle(''); setStart(''); setEnd(''); setMinimum('5'); setUnitMode('source'); setSelectedId(null); };
  const activeFilters = Number(Boolean(vehicle)) + Number(Boolean(start || end)) + Number(minimum !== '5');
  const coverage = readings.length ? `${formatFuelTime(readings[0].timestamp, true)} – ${formatFuelTime(readings[readings.length - 1].timestamp, true)}` : '—';
  const amountLabel = `${t('Increase', 'ปริมาณเพิ่ม')} (${unit})`;
  const exportData = increases.map((row) => ({
    vehicle: row.vehicle, beforeTime: formatFuelTime(row.before.timestamp, true), afterTime: formatFuelTime(row.after.timestamp, true),
    beforeFuel: row.before.fuel, afterFuel: row.after.fuel, increase: row.amount, units: unit,
    beforeSpeed: row.before.speed ?? '', afterSpeed: row.after.speed ?? '', ignition: row.after.ignition,
    classification: row.stationary ? 'Stationary at both readings; unconfirmed' : 'Moving or speed unknown; unconfirmed',
    minimumIncrease: threshold, maxGapMinutes: 10, location: row.after.location,
  }));
  const eventColumns: Column<FuelIncrease>[] = [
    { key: 'after', label: t('Time (Bangkok)', 'เวลา (ไทย)'), render: (_, row) => <button className="whitespace-nowrap text-left font-medium text-blue-700 underline decoration-blue-200 underline-offset-4 dark:text-blue-300" onClick={() => setSelectedId(row.id)}>{formatFuelTime(row.after.timestamp, true)}</button> },
    { key: 'vehicle', label: t('Vehicle', 'ทะเบียนรถ'), sortable: true },
    { key: 'before', label: t('Before → after', 'ก่อน → หลัง'), render: (_, row) => `${valueOrDash(row.before.fuel)} → ${valueOrDash(row.after.fuel)}` },
    { key: 'amount', label: amountLabel, sortable: true, render: (_, row) => <span className="font-semibold tabular-nums text-orange-700 dark:text-orange-300">+{number(row.amount)}</span> },
    { key: 'stationary', label: t('Speed context', 'สถานะความเร็ว'), render: (_, row) => <span>{row.stationary ? t('Both readings at 0', 'ทั้งสองจุดเป็น 0') : t('Moving / unknown', 'เคลื่อนที่ / ไม่ทราบ')}<span className="block text-xs text-zinc-500">{valueOrDash(row.before.speed)} → {valueOrDash(row.after.speed)} {t('(sheet speed)', '(ความเร็วตามชีต)')}</span></span> },
    { key: 'ignition', label: t('Ignition', 'กุญแจ'), render: (_, row) => row.after.ignition || '—' },
    { key: 'location', label: t('Location', 'สถานที่'), wrap: true, wrapClassName: 'min-w-48 max-w-80 break-words', render: (_, row) => row.after.location || '—' },
  ];
  const readingColumns: Column<FuelReading>[] = [
    { key: 'timestamp', label: t('Time (Bangkok)', 'เวลา (ไทย)'), sortable: true, render: (_, row) => formatFuelTime(row.timestamp, true) },
    { key: 'vehicle', label: t('Vehicle', 'ทะเบียนรถ'), sortable: true },
    { key: 'fuel', label: `${t('Total Fuel', 'ระดับน้ำมันรวม')} (${unit})`, sortable: true, render: (_, row) => valueOrDash(row.fuel) },
    { key: 'speed', label: t('Speed (sheet value)', 'ความเร็วตามชีต'), sortable: true, render: (_, row) => valueOrDash(row.speed) },
    { key: 'ignition', label: t('Ignition', 'กุญแจ') },
  ];
  return <main id="main-content"><DashboardShell title={dashboardName} subtitle={t('Fuel top-up / increase', 'การเติม / เพิ่มขึ้นของน้ำมัน')} lang={lang} dashboardId={dashboardId} isAdmin={isAdmin}
    lastUpdated={sheet.lastUpdated} isStale={Boolean(sheet.error && sheet.lastUpdated)} activeFilterCount={activeFilters} notes={dashboardNotes}
    actions={<><a className={btnSecondary} href={sourceUrl} target="_blank" rel="noreferrer">{t('Open sheet', 'เปิดชีต')} ↗</a><button className={btnSecondary} onClick={() => void sheet.refresh()} disabled={sheet.loading}>{sheet.loading ? t('Loading…', 'กำลังโหลด…') : t('Refresh', 'รีเฟรช')}</button></>}>
    {sheet.error && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{sheet.error} {sheet.lastUpdated && t('Showing the last successful snapshot.', 'แสดงข้อมูลที่โหลดสำเร็จล่าสุด')}</div>}
    {sheet.loading && !sheet.lastUpdated ? <p role="status" className="p-12 text-center">{t('Loading fuel readings from Google Sheets…', 'กำลังโหลดข้อมูลน้ำมันจาก Google Sheets…')}</p> : sheet.lastUpdated && <>
      <section className={dashboardSectionClass} aria-label={t('Fuel filters', 'ตัวกรองน้ำมัน')}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{t('Vehicle', 'ทะเบียนรถ')}<select className={`${inputBase} mt-1.5 w-full`} value={vehicle} onChange={(e) => { setVehicle(e.target.value); setSelectedId(null); }}><option value="">{t('All vehicles', 'รถทั้งหมด')}</option>{vehicles.map((v) => <option key={v}>{v}</option>)}</select></label>
          <label className="min-w-0 text-xs font-medium text-zinc-600 dark:text-zinc-300">{t('From · Bangkok time', 'เริ่ม · เวลาไทย')}<input type="datetime-local" className={`${inputBase} mt-1.5 w-full min-w-0`} value={start} onChange={(e) => { setStart(e.target.value); setSelectedId(null); }} /></label>
          <label className="min-w-0 text-xs font-medium text-zinc-600 dark:text-zinc-300">{t('To · Bangkok time', 'สิ้นสุด · เวลาไทย')}<input type="datetime-local" className={`${inputBase} mt-1.5 w-full min-w-0`} value={end} onChange={(e) => { setEnd(e.target.value); setSelectedId(null); }} /></label>
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{t('Minimum increase', 'ปริมาณเพิ่มขั้นต่ำ')}<input type="number" min="0.01" step="0.01" className={`${inputBase} mt-1.5 w-full`} value={minimum} onChange={(e) => { setMinimum(e.target.value); setSelectedId(null); }} aria-invalid={invalidThreshold} /></label>
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{t('Fuel unit', 'หน่วยน้ำมัน')}<select className={`${inputBase} mt-1.5 w-full`} value={unitMode} onChange={(e) => setUnitMode(e.target.value)}><option value="source">{t('Source units (unspecified)', 'หน่วยตามชีต (ไม่ระบุ)')}</option><option value="litres">{t('Litres (user confirmed)', 'ลิตร (ผู้ใช้ยืนยัน)')}</option></select></label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-zinc-500">{t('Observed period', 'ช่วงข้อมูล')}: {coverage} · {number(readings.length)} {t('readings', 'รายการ')}</p><button className="min-h-9 text-sm font-medium text-blue-700 hover:underline dark:text-blue-300" onClick={reset}>{t('Reset filters', 'ล้างตัวกรอง')}</button></div>
        {(invalidThreshold || invalidRange) && <p role="alert" className="mt-2 text-sm text-red-600">{invalidThreshold ? t('Enter a minimum increase greater than zero.', 'ระบุปริมาณเพิ่มขั้นต่ำมากกว่าศูนย์') : t('The end time must be after the start time.', 'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม')}</p>}
      </section>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t('Detected increase total', 'ผลรวมค่าที่เพิ่มขึ้น')} value={detectionUnavailable ? '—' : number(totalIncrease)} unit={unit} subtitle={t('Sum of qualifying positive changes', 'ผลรวมส่วนต่างบวกที่ผ่านเกณฑ์')} accentColor="#c2410c" />
        <KpiCard label={t('Detected increases', 'จำนวนครั้งที่ค่าเพิ่ม')} value={detectionUnavailable ? '—' : increases.length} subtitle={t('Each change is unconfirmed', 'ยังไม่ยืนยันว่าเป็นการเติมน้ำมัน')} />
        <KpiCard label={t('Stationary increases', 'ค่าเพิ่มขณะหยุดรถ')} value={detectionUnavailable ? '—' : stationary.length} subtitle={t('Speed = 0 at both readings', 'ความเร็วเป็น 0 ทั้งก่อนและหลัง')} />
        <KpiCard label={t('Fuel readings', 'รายการระดับน้ำมัน')} value={number(readings.length - missingFuel)} subtitle={`${number(missingFuel)} ${t('missing / invalid fuel values', 'ค่าที่ขาดหาย / ไม่ถูกต้อง')}`} />
      </div>
      <section className={dashboardSectionClass}>
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className={heading2}>{t('Fuel level & detected increases', 'ระดับน้ำมันและค่าที่เพิ่มขึ้น')}</h2><span className="text-xs text-zinc-500">{unit} · {t('Bangkok time (UTC+7)', 'เวลาไทย (UTC+7)')}</span></div>
        <p className="mb-5 mt-2 max-w-4xl text-sm text-zinc-500">{t('Increases are changes between consecutive readings within 10 minutes. They may reflect refuelling, sensor movement or calibration; the sheet does not confirm top-ups.', 'ค่าที่เพิ่มขึ้นคือส่วนต่างระหว่างข้อมูลต่อเนื่องภายใน 10 นาที อาจเกิดจากการเติมน้ำมัน การแกว่งของเซนเซอร์ หรือการปรับเทียบ ชีตไม่ได้ยืนยันรายการเติมน้ำมัน')}</p>
        <FuelTelemetryChart readings={readings} increases={increases} mode="level" unit={unit} selectedId={selectedId} onSelect={setSelectedId} lang={lang} />
        {!hasComparableReadings && <p className="mb-4 text-sm text-amber-700 dark:text-amber-300">{t('Not enough consecutive valid readings to calculate increases in this selection.', 'ข้อมูลต่อเนื่องที่ใช้ได้ไม่เพียงพอสำหรับคำนวณค่าเพิ่มในช่วงที่เลือก')}</p>}
        <div className="mb-3 mt-6 flex flex-wrap items-baseline justify-between gap-2 border-t border-zinc-100 pt-5 dark:border-zinc-800"><h3 className="text-sm font-semibold">{t('Detected increases over time', 'ค่าที่เพิ่มขึ้นตามเวลา')}</h3><span className="text-xs text-zinc-500">{invalidThreshold ? '—' : `≥ ${number(threshold)} ${unit}`}</span></div>
        <FuelTelemetryChart readings={readings} increases={increases} mode="increase" unit={unit} selectedId={selectedId} onSelect={setSelectedId} lang={lang} />
        {selected && <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-950 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-100"><strong>{selected.vehicle} · +{number(selected.amount)} {unit}</strong><p className="mt-1">{formatFuelTime(selected.before.timestamp, true)} → {formatFuelTime(selected.after.timestamp, true)} · {valueOrDash(selected.before.fuel)} → {valueOrDash(selected.after.fuel)}</p><p className="mt-1">{selected.after.location || '—'}</p><button className="mt-2 min-h-8 underline" onClick={() => setSelectedId(null)}>{t('Clear selection', 'ยกเลิกการเลือก')}</button></div>}
      </section>
      <section className={dashboardSectionClass}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className={heading2}>{t('Increase review', 'ตรวจสอบค่าที่เพิ่มขึ้น')}</h2><p className="mt-1 text-xs text-zinc-500">{t('Before and after values are from the same vehicle and selected period.', 'ค่าก่อนและหลังมาจากรถคันเดียวกันและอยู่ในช่วงเวลาที่เลือก')}</p></div><ExportButton data={exportData} dashboardName={dashboardName} dateRange="fuel-increases" label={t('Export increases', 'ส่งออกค่าที่เพิ่มขึ้น')} lang={lang} /></div>
        <DataTable data={increases} columns={eventColumns} pageSize={10} ariaLabel={t('Detected fuel increases', 'ค่าระดับน้ำมันที่เพิ่มขึ้น')} />
      </section>
      <section className={dashboardSectionClass}>
        <details><summary className="cursor-pointer text-sm font-semibold">{t('Source readings & calculation notes', 'ข้อมูลต้นทางและวิธีคำนวณ')}</summary>
          <div className="my-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
            <p>{t('Source: Total Fuel, Vehicle No, Date Time, Speed, Ignition and Location. Fuel units are not specified in the sheet; selecting litres changes labels only.', 'แหล่งข้อมูล: Total Fuel, Vehicle No, Date Time, Speed, Ignition และ Location ชีตไม่ได้ระบุหน่วยน้ำมัน การเลือกลิตรจะเปลี่ยนเฉพาะป้ายกำกับ')}</p>
            {!fleetColumn && hasConfiguredFleet && <p>{t('This is a dedicated telemetry sheet with no Fleet column. All vehicles in the configured sheet are included; access still requires every assigned fleet permission.', 'ชีตนี้เป็นข้อมูลเฉพาะแหล่งและไม่มีคอลัมน์ Fleet จึงรวมรถทุกคันในชีตที่กำหนด ผู้เข้าดูยังต้องมีสิทธิ์ของทุกฟลีทที่ผูกไว้')}</p>}
            <p>{t('Increase = later Total Fuel − earlier Total Fuel. Missing fuel, duplicate-time conflicts and gaps over 10 minutes break comparisons. Both endpoints must fall within the selected period. Fuel levels are never summed, and increases do not measure fuel consumption.', 'ปริมาณเพิ่ม = Total Fuel หลัง − Total Fuel ก่อน ไม่เปรียบเทียบข้ามค่าที่ขาดหาย เวลาเดียวกันที่ขัดแย้ง หรือช่วงห่างเกิน 10 นาที ทั้งสองจุดต้องอยู่ในช่วงเวลาที่เลือก ไม่รวมระดับน้ำมันเข้าด้วยกัน และค่าเพิ่มไม่ใช่อัตราสิ้นเปลือง')}</p>
            <p>{t('Import quality', 'คุณภาพข้อมูล')}: {parsed.invalidRows} {t('invalid rows', 'แถวไม่ถูกต้อง')} · {parsed.duplicateRows} {t('duplicate rows removed', 'แถวซ้ำที่ตัดออก')} · {parsed.conflictingRows} {t('conflicting rows', 'แถวที่ขัดแย้ง')}</p>
          </div>
          <div className="mb-4"><ExportButton data={readings.map((r) => ({ ...r.source }))} dashboardName={dashboardName} dateRange="fuel-readings" label={t('Export filtered readings', 'ส่งออกข้อมูลที่กรอง')} lang={lang} /></div>
          <DataTable data={readings} columns={readingColumns} defaultSort={{ key: 'timestamp', direction: 'desc' }} pageSize={15} ariaLabel={t('Source fuel readings', 'ข้อมูลน้ำมันต้นทาง')} />
        </details>
      </section>
      {blockedVehicles.length > 0 && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{t('Increase detection is unavailable for vehicles with unreadable timestamps:', 'ไม่สามารถคำนวณค่าเพิ่มสำหรับรถที่มีเวลาไม่ถูกต้อง:')} {blockedVehicles.join(', ')}. {t('Valid level readings remain visible.', 'ยังแสดงระดับน้ำมันที่อ่านได้')}</p>}
      {parsed.invalidRows > 0 && <p className="text-xs text-amber-700 dark:text-amber-300">{parsed.invalidRows} {t('source rows could not be placed on the timeline. See calculation notes.', 'แถวไม่สามารถระบุเวลาบนกราฟได้ ดูหมายเหตุการคำนวณ')}</p>}
    </>}
  </DashboardShell></main>;
}

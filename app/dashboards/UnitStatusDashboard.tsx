'use client';

import { Fragment, useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import type { DashboardLang } from 'app/dashboard/i18n-copy';
import DateTimeRangePicker from 'app/ui/DateTimeRangePicker';
import MultiSelect from 'app/ui/MultiSelect';
import {
  badgeDanger, badgeDefault, badgeSuccess, badgeWarning, btnSecondary,
  inputBase, labelBase, selectBase,
} from 'app/ui/design-tokens';
import DashboardShell from './DashboardShell';
import LoadingState from './LoadingState';
import { normalizeLabel, parseDate, scopeFleetSet } from './dashboardDataUtils';
import { formatDateTimeGB } from './dateFormat';
import { isCompleteDateTimeRange, isDateInDateTimeRange, type DateTimeRange } from './dateTimeRange';
import {
  buildUnitMonitorRows, buildUnitRows, getUnitMonitorColumns, getUnitMonitorDamage, getUnitChecks,
  hasUnitStatusColumns, isReportedValue,
  type UnitCheck, type UnitHealth, type UnitMonitorRow, type UnitRow, type UnitUpdateStatus,
} from './unitStatusData';
import useUnitStatusSheet from './useUnitStatusSheet';

type DashboardProps = {
  dashboardId: string;
  dashboardName: string;
  sheetId: string;
  sheetGid: string;
  dashboardNotes?: string | null;
  organizationName?: string | null;
  organizationNames?: string[] | null;
  companyName?: string | null;
  legacyBigthSource?: boolean;
  lang?: DashboardLang;
  isAdmin?: boolean;
};

const COPY = {
  en: {
    title: 'Unit status', units: 'Units', gpsOnline: 'GPS online', gpsOffline: 'GPS offline', attention: 'Needs attention',
    attentionNote: 'Units with warnings, an offline status or failed camera checks', gpsUnknown: 'GPS status not reported',
    recent: 'Recent updates', stale: 'Stale updates', unknown: 'Unknown update time',
    recentBadge: 'Recent', staleBadge: 'Stale', unknownBadge: 'Unknown', online: 'Online', offline: 'Offline',
    autoRefresh: 'Auto-refresh', refresh: 'Refresh', refreshing: 'Refreshing…',
    search: 'Search units', placeholder: 'Vehicle number or location', updateStatus: 'Update status',
    all: 'All updates', reset: 'Reset', vehicle: 'Vehicle', update: 'Update', network: 'Network',
    storage: 'Storage', storageRaw: 'Reported storage', recording: 'Recording', videoLoss: 'Video loss', details: 'Details',
    show: 'View details', hide: 'Hide details', report: 'Last report', cameras: 'Cameras & storage',
    ai: 'AI alerts', aiStatus: 'AI', device: 'Device', cameraSetup: 'Camera setup', cameraSetupNote: 'Active / expected cameras',
    location: 'Location', speed: 'Speed', dataTime: 'Data time', gpsRaw: 'Reported GPS',
    direction: 'Direction', mainPower: 'Main power', battery: 'Battery', idKey: 'ID key last detected',
    storageAlert: 'Storage alert', storageAlertTime: 'Storage alert time', latestAi: 'Latest alert',
    aiTime: 'Alert time', notReported: 'Not reported', fleet: 'Fleet', driver: 'Driver', type: 'Type', deviceType: 'Device type',
    fleets: 'fleets', vehicles: 'vehicles', drivers: 'drivers', types: 'types', locations: 'locations', dates: 'Report date & time',
    locationFilter: 'Location / region', failedCheck: 'Failed check', allChecks: 'All checks', overall: 'Overall status',
    healthy: 'Healthy', warning: 'Warning', accessories: 'BSD & accessories', issues: 'Issues to check',
    noIssues: 'No offline checks reported.', staleIssue: 'The last update is more than 30 minutes old. Check the connection; device checks show the last report.',
    unknownUpdateIssue: 'The update time is unavailable or invalid. Device checks show the last report.',
    expectedUnknown: 'Expected count not reported', onlineCameras: (count: number) => `${count} online`,
    checklist: 'Device checklist', damage: 'Damage matrix', damageNote: 'Offline checks in the filtered units. Missing data is excluded.',
    installation: 'Fleet installation', installNote: 'Configured units and cameras across the dashboard fleet scope. Filters above do not change these totals.',
    cameraCount: 'Cameras', total: 'Total', installEmpty: 'No installation data reported.',
    cameraLegend: 'Status indicators: ✓ Online · × Offline · ? Not reported. Camera positions with no reported data stay blank.',
    unknownCameraUnits: (count: number) => `${count} ${count === 1 ? 'unit' : 'units'} with unknown camera counts`,
    metadataUnavailable: 'Additional equipment configuration could not be loaded. Available source checks are shown.', metadataLoading: 'Loading additional equipment configuration…',
    timeNote: 'Times shown in Bangkok time', intercomNote: 'Intercom is always Online because its data has no status trigger.',
    defaultStatusNote: 'Seat Vibrator and Cabin default to Online when their status is not reported.',
    freshness: 'Updates older than 30 minutes are marked stale. Device statuses use the last report; missing data is Not reported.',
    empty: 'No units are available in this sheet for the dashboard scope.', noMatch: 'No units match the current filters.',
    loading: 'Loading unit status…', sourceError: 'This template needs vehicle number and GPS status or update time columns.',
    count: (shown: number, total: number) => `${shown} of ${total} units`,
    gpsTitle: 'GPS Status', damageTitle: 'Damage Status', completion: 'Checklist completion',
    complete: 'Complete', waiting: 'Waiting', completionNote: 'Based on each unit’s required positions and latest checks.',
    gpsRule: 'Online = a data report within the last 10 minutes.',
    scopeNote: 'Summary panels cover all authorized units; filters apply to the table.',
    filters: 'Search & filters', customer: 'Customer', customers: 'customers', moreFilters: 'More filters',
    noSelection: 'No selection shows all.', noDamage: 'No actionable equipment issues.', previous: 'Previous page', next: 'Next page',
    damageRange: (start: number, end: number, total: number) => `${start}–${end} of ${total}`,
    sortHint: 'Select a column heading to sort.', sortBy: 'Sort by', dateTime: 'Date & time',
    duplicateRecording: 'Duplicate names in recording data. Review the source report.',
    geofence: 'In geofence', inferred: 'Inferred', geofenceReported: 'Geofence status is explicitly reported by the source.',
    geofenceInferred: 'Inferred from the reported equipment pattern; location is not confirmed.',
    activeRequired: 'Online / required positions', checksLegend: '✓ Online · × Offline · ? Not reported · blank = position not reported for this unit',
    cameraInactive: 'Camera inactive in geofence', rawCameraNote: 'Camera checks below show the last reported values.',
    lastContact: 'Last data report', reportAge: 'Report age', movement: 'Movement at last report', moving: 'Moving', stationary: 'Stationary',
    justNow: 'Less than a minute ago', ageMinutes: (value: number) => `${value} min ago`, ageHours: (value: number) => `${value} hr ago`, ageDays: (value: number) => `${value} days ago`,
    diagnostics: 'Needs attention', clearReport: 'No actionable equipment issues.', clearReportNote: 'The latest checks do not identify a component to investigate.',
    evidence: 'Reported value', suggestedCheck: 'Suggested check', reportedOffline: 'This check is reported offline.',
    storageCheck: 'Review the storage status and most recent storage alert in the source report.',
    aiCheck: 'Review the latest AI alert and its timestamp in the source report.',
    cameraCheck: 'Compare the recording and video-loss fields in Raw telemetry.',
    deviceCheck: 'Review this equipment check in the latest source report.',
    reportDelayed: 'Data report is overdue', reportDelayedNote: 'The last data report is outside the 10-minute online window. Compare its timestamp with the latest report in the source system.',
    reportUnknown: 'Report time needs checking', reportUnknownNote: 'The data timestamp is missing, invalid or in the future. Recency cannot be established.',
    apiDelayed: 'API update is stale', apiDelayedNote: 'The API update is over 30 minutes old. Raw telemetry includes both timestamps for comparison.',
    geofenceDiagnostic: 'Camera checks are suppressed in the damage list while this geofence status applies. Original values remain in Raw telemetry.',
    reversePending: 'Reverse BSD assessment pending', reversePendingNote: 'Reported Offline. Alerts for this check apply only when GPS is Online and the last reported speed is above zero.',
    duplicateTitle: 'Recording data has duplicate names', configurationUnknown: 'Equipment requirements are not reported',
    configurationUnknownNote: 'A required-position count is needed to determine checklist completion.',
    setup: 'Equipment setup', awaitingStatus: 'Awaiting status', setupIncomplete: 'The required count is known, but some positions or statuses are not fully reported.',
    noRequiredPositions: 'The configuration requires no equipment positions.', defaults: 'Template defaults',
    rawTelemetry: 'Raw telemetry', rawTelemetryNote: 'Source fields and additional diagnostics for investigation.', showUnreported: 'Show unreported fields',
    sourceChecks: 'Original device checks', noReportedFields: 'No values reported in this group.',
    workingPositions: (count: number) => `${count} positions online`,
    copyDiagnostic: 'Copy diagnostic summary', copyingDiagnostic: 'Copying…', diagnosticCopied: 'Diagnostic summary copied.', diagnosticCopyFailed: 'Could not copy. Please try again.',
  },
  th: {
    title: 'สถานะอุปกรณ์', units: 'รถทั้งหมด', gpsOnline: 'GPS ออนไลน์', gpsOffline: 'GPS ออฟไลน์', attention: 'ต้องตรวจสอบ',
    attentionNote: 'รถที่มีคำเตือน สถานะออฟไลน์ หรือกล้องขัดข้อง', gpsUnknown: 'ไม่มีข้อมูลสถานะ GPS',
    recent: 'อัปเดตล่าสุด', stale: 'ข้อมูลเก่า', unknown: 'ไม่ทราบเวลาอัปเดต',
    recentBadge: 'ล่าสุด', staleBadge: 'ข้อมูลเก่า', unknownBadge: 'ไม่ทราบ', online: 'ออนไลน์', offline: 'ออฟไลน์',
    autoRefresh: 'รีเฟรชอัตโนมัติ', refresh: 'รีเฟรช', refreshing: 'กำลังรีเฟรช…',
    search: 'ค้นหารถ', placeholder: 'ทะเบียนรถหรือสถานที่', updateStatus: 'สถานะการอัปเดต',
    all: 'ทุกสถานะ', reset: 'ล้างตัวกรอง', vehicle: 'รถ', update: 'อัปเดต', network: 'เครือข่าย',
    storage: 'พื้นที่จัดเก็บ', storageRaw: 'ข้อมูลพื้นที่จัดเก็บ', recording: 'การบันทึก', videoLoss: 'วิดีโอขาดหาย', details: 'รายละเอียด',
    show: 'ดูรายละเอียด', hide: 'ซ่อนรายละเอียด', report: 'รายงานล่าสุด', cameras: 'กล้องและพื้นที่จัดเก็บ',
    ai: 'การแจ้งเตือน AI', aiStatus: 'AI', device: 'อุปกรณ์', cameraSetup: 'จำนวนกล้อง', cameraSetupNote: 'กล้องที่ทำงาน / กล้องที่ติดตั้ง',
    location: 'สถานที่', speed: 'ความเร็ว', dataTime: 'เวลาข้อมูล', gpsRaw: 'ข้อมูล GPS ที่รายงาน',
    direction: 'ทิศทาง', mainPower: 'ไฟเลี้ยงหลัก', battery: 'แบตเตอรี่', idKey: 'ตรวจพบ ID Key ล่าสุด',
    storageAlert: 'แจ้งเตือนพื้นที่จัดเก็บ', storageAlertTime: 'เวลาแจ้งเตือนพื้นที่จัดเก็บ', latestAi: 'แจ้งเตือนล่าสุด',
    aiTime: 'เวลาแจ้งเตือน', notReported: 'ไม่มีข้อมูลรายงาน', fleet: 'กลุ่มรถ', driver: 'คนขับ', type: 'ประเภท', deviceType: 'ประเภทอุปกรณ์',
    fleets: 'กลุ่มรถ', vehicles: 'รถ', drivers: 'คนขับ', types: 'ประเภท', locations: 'สถานที่', dates: 'วันที่และเวลารายงาน',
    locationFilter: 'สถานที่ / พื้นที่', failedCheck: 'รายการที่ขัดข้อง', allChecks: 'ทุกรายการ', overall: 'สถานะโดยรวม',
    healthy: 'ปกติ', warning: 'คำเตือน', accessories: 'BSD และอุปกรณ์เสริม', issues: 'รายการที่ต้องตรวจสอบ',
    noIssues: 'ไม่มีรายงานรายการออฟไลน์', staleIssue: 'ไม่มีการอัปเดตเกิน 30 นาที กรุณาตรวจสอบการเชื่อมต่อ สถานะอุปกรณ์แสดงตามรายงานล่าสุด',
    unknownUpdateIssue: 'ไม่มีเวลาอัปเดตหรือเวลาไม่ถูกต้อง สถานะอุปกรณ์แสดงตามรายงานล่าสุด',
    expectedUnknown: 'ไม่มีข้อมูลจำนวนกล้องที่ติดตั้ง', onlineCameras: (count: number) => `${count} กล้องออนไลน์`,
    checklist: 'รายการตรวจสอบอุปกรณ์', damage: 'สรุปอุปกรณ์ขัดข้อง', damageNote: 'จำนวนรายการออฟไลน์จากรถที่กรองไว้ ไม่นับรายการที่ไม่มีข้อมูล',
    installation: 'การติดตั้งตามกลุ่มรถ', installNote: 'รถและกล้องที่กำหนดไว้ในขอบเขตกลุ่มรถของแดชบอร์ด ตัวกรองด้านบนไม่เปลี่ยนยอดรวมนี้',
    cameraCount: 'กล้อง', total: 'รวม', installEmpty: 'ไม่มีข้อมูลการติดตั้ง',
    cameraLegend: 'สถานะ: ✓ ออนไลน์ · × ออฟไลน์ · ? ไม่มีข้อมูลรายงาน ตำแหน่งกล้องที่ไม่มีข้อมูลรายงานจะแสดงว่าง',
    unknownCameraUnits: (count: number) => `${count} คันไม่มีข้อมูลจำนวนกล้อง`,
    metadataUnavailable: 'ไม่สามารถโหลดข้อมูลการกำหนดอุปกรณ์เพิ่มเติมได้ แสดงรายการตรวจสอบจากข้อมูลต้นทางที่มีอยู่', metadataLoading: 'กำลังโหลดข้อมูลการกำหนดอุปกรณ์เพิ่มเติม…',
    timeNote: 'แสดงเวลาประเทศไทย', intercomNote: 'Intercom แสดงออนไลน์เสมอ เนื่องจากข้อมูลไม่มีเงื่อนไขแจ้งสถานะ',
    defaultStatusNote: 'Seat Vibrator และ Cabin แสดงออนไลน์เป็นค่าเริ่มต้นเมื่อไม่มีรายงานสถานะ',
    freshness: 'ข้อมูลที่อัปเดตเกิน 30 นาทีจะแสดงว่าข้อมูลเก่า สถานะอุปกรณ์อ้างอิงรายงานล่าสุด รายการที่ขาดจะแสดงว่าไม่มีข้อมูลรายงาน',
    empty: 'ไม่พบรถในชีตนี้ตามขอบเขตของแดชบอร์ด', noMatch: 'ไม่พบรถที่ตรงกับตัวกรอง',
    loading: 'กำลังโหลดสถานะอุปกรณ์…', sourceError: 'เทมเพลตนี้ต้องมีคอลัมน์ทะเบียนรถ และสถานะ GPS หรือเวลาอัปเดต',
    count: (shown: number, total: number) => `${shown} จาก ${total} คัน`,
    gpsTitle: 'สถานะ GPS', damageTitle: 'สถานะอุปกรณ์ขัดข้อง', completion: 'ความครบถ้วนของรายการตรวจสอบ',
    complete: 'ครบ', waiting: 'รอ', completionNote: 'อ้างอิงตำแหน่งที่แต่ละคันต้องมีและผลตรวจสอบล่าสุด',
    gpsRule: 'ออนไลน์ = มีรายงานข้อมูลภายใน 10 นาทีล่าสุด',
    scopeNote: 'แผงสรุปนับรถทั้งหมดในขอบเขตที่เข้าถึงได้ ตัวกรองใช้กับตาราง',
    filters: 'ค้นหาและตัวกรอง', customer: 'ลูกค้า', customers: 'ลูกค้า', moreFilters: 'ตัวกรองเพิ่มเติม',
    noSelection: 'ไม่เลือกตัวกรองจะแสดงทั้งหมด', noDamage: 'ไม่มีอุปกรณ์ที่เข้าเงื่อนไขต้องตรวจสอบ', previous: 'หน้าก่อนหน้า', next: 'หน้าถัดไป',
    damageRange: (start: number, end: number, total: number) => `${start}–${end} จาก ${total}`,
    sortHint: 'กดหัวคอลัมน์เพื่อเรียงลำดับ', sortBy: 'เรียงตาม', dateTime: 'วันที่และเวลา',
    duplicateRecording: 'ชื่อซ้ำในข้อมูลการบันทึก กรุณาตรวจสอบรายงานต้นทาง',
    geofence: 'อยู่ใน Geofence', inferred: 'คาดการณ์', geofenceReported: 'ต้นทางรายงานสถานะ Geofence โดยตรง',
    geofenceInferred: 'คาดการณ์จากรูปแบบสถานะอุปกรณ์ที่รายงาน ยังไม่ยืนยันตำแหน่ง',
    activeRequired: 'ตำแหน่งออนไลน์ / ที่ต้องมี', checksLegend: '✓ ออนไลน์ · × ออฟไลน์ · ? ไม่มีข้อมูลรายงาน · ว่าง = ไม่มีรายงานตำแหน่งนี้สำหรับรถคันนี้',
    cameraInactive: 'กล้องไม่ทำงานใน Geofence', rawCameraNote: 'สถานะกล้องด้านล่างแสดงค่าที่รายงานล่าสุด',
    lastContact: 'รายงานข้อมูลล่าสุด', reportAge: 'อายุรายงาน', movement: 'การเคลื่อนที่ในรายงานล่าสุด', moving: 'กำลังเคลื่อนที่', stationary: 'หยุดนิ่ง',
    justNow: 'น้อยกว่า 1 นาทีที่แล้ว', ageMinutes: (value: number) => `${value} นาทีที่แล้ว`, ageHours: (value: number) => `${value} ชั่วโมงที่แล้ว`, ageDays: (value: number) => `${value} วันที่แล้ว`,
    diagnostics: 'รายการที่ต้องตรวจสอบ', clearReport: 'ไม่มีอุปกรณ์ที่เข้าเงื่อนไขต้องตรวจสอบ', clearReportNote: 'ผลตรวจสอบล่าสุดไม่ระบุอุปกรณ์ที่ต้องตรวจสอบเพิ่มเติม',
    evidence: 'ค่าที่รายงาน', suggestedCheck: 'แนะนำให้ตรวจสอบ', reportedOffline: 'รายการนี้รายงานสถานะออฟไลน์',
    storageCheck: 'ตรวจสอบสถานะพื้นที่จัดเก็บและการแจ้งเตือนล่าสุดจากรายงานต้นทาง',
    aiCheck: 'ตรวจสอบการแจ้งเตือน AI ล่าสุดและเวลาที่แจ้งจากรายงานต้นทาง',
    cameraCheck: 'เปรียบเทียบข้อมูลการบันทึกและวิดีโอขาดหายในข้อมูลดิบ',
    deviceCheck: 'ตรวจสอบรายการอุปกรณ์นี้จากรายงานต้นทางล่าสุด',
    reportDelayed: 'รายงานข้อมูลเกินกำหนด', reportDelayedNote: 'รายงานล่าสุดเกินเกณฑ์ออนไลน์ 10 นาที ควรเปรียบเทียบเวลากับรายงานล่าสุดในระบบต้นทาง',
    reportUnknown: 'ต้องตรวจสอบเวลารายงาน', reportUnknownNote: 'ไม่มีเวลาข้อมูล เวลาไม่ถูกต้อง หรือเป็นเวลาในอนาคต จึงไม่สามารถระบุความใหม่ของข้อมูลได้',
    apiDelayed: 'ข้อมูล API เก่า', apiDelayedNote: 'การอัปเดต API เกิน 30 นาที ในข้อมูลดิบมีเวลาทั้งสองค่าให้เปรียบเทียบ',
    geofenceDiagnostic: 'รายการกล้องไม่ถูกนับในรายการขัดข้องขณะที่ใช้สถานะ Geofence นี้ ค่ารายงานเดิมยังดูได้ในข้อมูลดิบ',
    reversePending: 'รอประเมิน Reverse BSD', reversePendingNote: 'รายงานสถานะออฟไลน์ รายการนี้จะแจ้งเตือนเมื่อ GPS ออนไลน์และความเร็วที่รายงานล่าสุดมากกว่าศูนย์เท่านั้น',
    duplicateTitle: 'ชื่อซ้ำในข้อมูลการบันทึก', configurationUnknown: 'ไม่มีรายงานข้อกำหนดอุปกรณ์',
    configurationUnknownNote: 'ต้องมีจำนวนตำแหน่งที่กำหนดไว้จึงจะประเมินความครบถ้วนได้',
    setup: 'การกำหนดอุปกรณ์', awaitingStatus: 'รอรายงานสถานะ', setupIncomplete: 'ทราบจำนวนที่ต้องมี แต่บางตำแหน่งหรือสถานะยังรายงานไม่ครบ',
    noRequiredPositions: 'การกำหนดนี้ไม่ต้องมีตำแหน่งอุปกรณ์', defaults: 'ค่าเริ่มต้นของเทมเพลต',
    rawTelemetry: 'ข้อมูลดิบ', rawTelemetryNote: 'ข้อมูลต้นทางและสถานะเพิ่มเติมสำหรับตรวจสอบ', showUnreported: 'แสดงช่องที่ไม่มีข้อมูลรายงาน',
    sourceChecks: 'สถานะอุปกรณ์เดิม', noReportedFields: 'ไม่มีค่ารายงานในกลุ่มนี้',
    workingPositions: (count: number) => `${count} ตำแหน่งออนไลน์`,
    copyDiagnostic: 'คัดลอกสรุปการตรวจสอบ', copyingDiagnostic: 'กำลังคัดลอก…', diagnosticCopied: 'คัดลอกสรุปการตรวจสอบแล้ว', diagnosticCopyFailed: 'ไม่สามารถคัดลอกได้ กรุณาลองอีกครั้ง',
  },
};

type Copy = typeof COPY.en;

function reported(value: string, copy: Copy) {
  return isReportedValue(value) ? value : copy.notReported;
}

function reportedTime(value: string, copy: Copy) {
  if (!isReportedValue(value)) return copy.notReported;
  const date = parseDate(value);
  return date ? formatDateTimeGB(date) : value;
}

function UpdateBadge({ status, copy }: { status: UnitUpdateStatus; copy: Copy }) {
  const styles = { recent: badgeSuccess, stale: badgeWarning, unknown: badgeDefault };
  const labels = { recent: copy.recentBadge, stale: copy.staleBadge, unknown: copy.unknownBadge };
  return <span className={styles[status]}>{labels[status]}</span>;
}

function OverallBadge({ status, copy }: { status: UnitRow['overallStatus']; copy: Copy }) {
  const styles = { healthy: badgeSuccess, warning: badgeWarning, offline: badgeDanger, unknown: badgeDefault };
  const labels = { healthy: copy.healthy, warning: copy.warning, offline: copy.offline, unknown: copy.notReported };
  return <span className={styles[status]}>{labels[status]}</span>;
}

function DetailGroup({ title, fields }: { title: string; fields: [string, string][] }) {
  return (
    <section className="min-w-0">
      <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      <dl className="space-y-3 text-sm">
        {fields.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3">
            <dt className="break-words text-zinc-500 dark:text-zinc-400">{label}</dt>
            <dd className="break-words text-zinc-700 dark:text-zinc-200">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function reportAgeLabel(dataTime: string, now: Date, copy: Copy) {
  const reportedAt = parseDate(dataTime);
  const age = reportedAt ? now.getTime() + 7 * 60 * 60 * 1_000 - reportedAt.getTime() : NaN;
  if (!Number.isFinite(age) || age < 0) return copy.notReported;
  const minutes = Math.floor(age / 60_000);
  return minutes < 1 ? copy.justNow : minutes < 60 ? copy.ageMinutes(minutes)
    : minutes < 24 * 60 ? copy.ageHours(Math.floor(minutes / 60)) : copy.ageDays(Math.floor(minutes / (24 * 60)));
}

function issueExplanation(check: UnitCheck, row: UnitRow, copy: Copy) {
  const explicit = row.monitorSource?.values[check.key] ?? '';
  const evidence = isReportedValue(explicit) ? explicit : check.key === 'storage' ? row.storageRaw
    : check.key === 'statusAi' ? row.lastAiAlert : check.key === 'deviceStatus' ? row.storageRaw : '';
  const camera = /^c[1-9]$/.test(check.key) || ['ch1Ai', 'front', 'reverseBsd', 'frontBsd', 'rearRight', 'rearLeft', 'leftBsd', 'rightBsd', 'cabin'].includes(check.key);
  const suggestion = check.key === 'storage' ? copy.storageCheck : check.key === 'statusAi' || check.key === 'fatigueAi' ? copy.aiCheck : camera ? copy.cameraCheck : copy.deviceCheck;
  return { evidence, suggestion };
}

function UnitDetails({ monitor, copy, lang, now }: { monitor: UnitMonitorRow; copy: Copy; lang: DashboardLang; now: Date }) {
  const row = monitor.unit;
  const locale = lang === 'th' ? 'th' : 'en';
  const [showUnreported, setShowUnreported] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');
  const issues = getUnitMonitorDamage(monitor);
  const age = reportAgeLabel(row.dataTime, now, copy);
  const speed = isReportedValue(row.speed) ? Number(row.speed) : NaN;
  const movement = Number.isFinite(speed) && speed >= 0 ? `${speed === 0 ? copy.stationary : copy.moving} · ${row.speed} km/h` : copy.notReported;
  const awaiting = monitor.checks.filter((check) => check.present !== false && check.status === 'unknown');
  const notes: Array<{ title: string; body: string; tone: 'amber' | 'violet' | 'neutral' }> = [];
  if (monitor.gpsStatus === 'offline') notes.push({ title: copy.reportDelayed, body: copy.reportDelayedNote, tone: 'amber' });
  else if (monitor.gpsStatus === 'unknown') notes.push({ title: copy.reportUnknown, body: copy.reportUnknownNote, tone: 'amber' });
  if (row.updateStatus === 'stale' && monitor.gpsStatus !== 'offline') notes.push({ title: copy.apiDelayed, body: copy.apiDelayedNote, tone: 'amber' });
  if (monitor.geofence) notes.push({ title: `${copy.geofence}${monitor.geofence === 'inferred' ? ` · ${copy.inferred}` : ''}`, body: `${monitor.geofence === 'inferred' ? copy.geofenceInferred : copy.geofenceReported} ${copy.geofenceDiagnostic}`, tone: 'violet' });
  if (monitor.duplicateRecording) notes.push({ title: copy.duplicateTitle, body: copy.duplicateRecording, tone: 'amber' });
  if (!monitor.geofence && monitor.checks.some((check) => check.key === 'reverseBsd' && check.present !== false && check.status === 'offline')
    && !(monitor.gpsStatus === 'online' && speed > 0)) notes.push({ title: copy.reversePending, body: copy.reversePendingNote, tone: 'amber' });
  const healthLabels = { online: copy.online, offline: copy.offline, unknown: copy.notReported };
  const overallLabels = { healthy: copy.healthy, warning: copy.warning, offline: copy.offline, unknown: copy.notReported };
  const rawGroups: Array<{ title: string; fields: [string, string][] }> = [
    { title: copy.report, fields: [
      [copy.fleet, row.fleet], [copy.driver, row.driver], [copy.type, row.type], [copy.deviceType, row.deviceType],
      [copy.location, row.location], [copy.speed, row.speed], [copy.dataTime, row.dataTime], [copy.update, row.updatedRaw],
      [copy.gpsRaw, row.gps], [copy.network, row.network], [copy.direction, row.direction], ['HDOP', row.hdop],
      [copy.mainPower, row.mainPower], [copy.battery, row.battery], [copy.idKey, row.idKeyLastDetected],
    ] },
    { title: copy.cameras, fields: [
      [copy.storageRaw, row.storageRaw], [copy.recording, row.recording], [copy.videoLoss, row.videoLoss],
      [copy.storageAlert, row.storageAlert], [copy.storageAlertTime, row.storageAlertTime],
      [copy.cameraSetup, row.expectedCameras == null ? '' : `${row.activeCameras}/${row.expectedCameras}`],
    ] },
    { title: copy.ai, fields: [[copy.latestAi, row.lastAiAlert], [copy.aiTime, row.lastAiAlertTime]] },
    { title: copy.sourceChecks, fields: [
      [copy.overall, overallLabels[row.overallStatus]],
      ...getUnitChecks(row).map((check): [string, string] => [check[locale], check.status === 'unknown' ? '' : healthLabels[check.status]]),
    ] },
  ];
  const required = monitor.requiredPositions;
  const setupText = required == null ? copy.expectedUnknown : `${monitor.activePositions}/${required}`;
  const copySummary = async () => {
    setCopyStatus('copying');
    const summary = [
      `${copy.vehicle}: ${row.vehicleNo}${row.fleet ? ` · ${row.fleet}` : ''}`,
      `${copy.lastContact}: ${reportedTime(row.dataTime, copy)} (${age}; ${copy.timeNote})`,
      `GPS: ${healthLabels[monitor.gpsStatus]} · ${copy.overall}: ${overallLabels[monitor.overallStatus]}`,
      `${copy.movement}: ${movement}`,
      ...(isReportedValue(row.location) ? [`${copy.location}: ${row.location}`] : []),
      `${copy.setup}: ${setupText} (${copy.activeRequired})`,
      `${copy.diagnostics}: ${issues.length ? issues.map((check) => check[locale]).join(', ') : copy.noDamage}`,
      ...issues.map((check) => { const explanation = issueExplanation(check, row, copy); return `${check[locale]}: ${isReportedValue(explanation.evidence) ? explanation.evidence : copy.reportedOffline} — ${explanation.suggestion}`; }),
      ...notes.map((note) => `${note.title}: ${note.body}`),
      ...(required == null ? [`${copy.configurationUnknown}: ${copy.configurationUnknownNote}`] : []),
      `${copy.defaults}: ${copy.defaultStatusNote} ${copy.intercomNote}`,
    ].join('\n');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(summary);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  };

  return (
    <div className="space-y-4 border-t border-zinc-200 py-4 text-sm dark:border-zinc-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-4">
          <div className="col-span-2 sm:col-span-1"><dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{copy.lastContact}</dt><dd className="mt-1 text-xs font-semibold tabular-nums text-zinc-800 dark:text-zinc-100">{reportedTime(row.dataTime, copy)}</dd></div>
          <div><dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{copy.reportAge}</dt><dd className="mt-1 text-xs font-semibold text-zinc-800 dark:text-zinc-100">{age}</dd></div>
          <div><dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{copy.movement}</dt><dd className="mt-1 text-xs text-zinc-700 dark:text-zinc-200">{movement}</dd></div>
          {isReportedValue(row.driver) && <div><dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{copy.driver}</dt><dd className="mt-1 text-xs text-zinc-700 dark:text-zinc-200">{row.driver}</dd></div>}
          {isReportedValue(row.location) && <div className="col-span-2"><dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{copy.location}</dt><dd className="mt-1 break-words text-xs text-zinc-700 dark:text-zinc-200">{row.location}</dd></div>}
        </dl>
        <div className="flex flex-col items-start gap-2 sm:items-end"><OverallBadge status={monitor.overallStatus} copy={copy} /><button type="button" className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800" disabled={copyStatus === 'copying'} onClick={copySummary}>{copyStatus === 'copying' ? copy.copyingDiagnostic : copy.copyDiagnostic}</button><p className="max-w-56 text-[10px] text-zinc-500 dark:text-zinc-400" role="status" aria-live="polite">{copyStatus === 'copied' ? copy.diagnosticCopied : copyStatus === 'failed' ? copy.diagnosticCopyFailed : ''}</p></div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section aria-label={copy.diagnostics} className="min-w-0">
          <h3 className="mb-2 text-xs font-bold text-zinc-800 dark:text-zinc-100">{copy.diagnostics}</h3>
          <div className="space-y-2">
            {issues.map((check) => { const explanation = issueExplanation(check, row, copy); return <article key={check.key} className="rounded-lg border border-red-200 bg-red-50/60 p-3 dark:border-red-900 dark:bg-red-950/20"><h4 className="text-xs font-semibold text-red-800 dark:text-red-300">{check[locale]}</h4><p className="mt-1 break-words text-xs text-zinc-700 dark:text-zinc-300">{isReportedValue(explanation.evidence) ? `${copy.evidence}: ${explanation.evidence}` : copy.reportedOffline}</p><p className="mt-1.5 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400"><span className="font-medium">{copy.suggestedCheck}: </span>{explanation.suggestion}</p></article>; })}
            {issues.length === 0 && <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900"><p className="text-xs font-medium text-zinc-700 dark:text-zinc-200">{copy.clearReport}</p>{notes.length === 0 && monitor.installation === 'complete' && <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{copy.clearReportNote}</p>}</div>}
            {notes.map((note) => <aside key={note.title} className={`rounded-lg border-l-2 px-3 py-2 ${note.tone === 'violet' ? 'border-violet-400 bg-violet-50/60 dark:bg-violet-950/20' : 'border-amber-400 bg-amber-50/60 dark:bg-amber-950/20'}`}><h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">{note.title}</h4><p className="mt-1 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">{note.body}</p></aside>)}
          </div>
        </section>

        <section aria-label={copy.setup} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-100">{copy.setup}</h3><span className="text-base font-semibold tabular-nums text-zinc-800 dark:text-zinc-100">{required == null ? copy.workingPositions(monitor.activePositions) : setupText}</span></div>
          {required != null && required > 0 && <><p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">{copy.activeRequired}</p><progress className="mt-2 h-2 w-full overflow-hidden rounded-full accent-blue-600" value={Math.min(monitor.activePositions, required)} max={required} aria-label={copy.activeRequired}>{setupText}</progress></>}
          {required === 0 && <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{copy.noRequiredPositions}</p>}
          {required == null && <div className="mt-2 text-xs text-amber-800 dark:text-amber-300"><p className="font-medium">{copy.configurationUnknown}</p><p className="mt-1 text-[11px] leading-relaxed">{copy.configurationUnknownNote}</p></div>}
          {required != null && monitor.installation === 'unknown' && <p className="mt-2 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">{copy.setupIncomplete}</p>}
          {awaiting.length > 0 && <p className="mt-2 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400"><span className="font-medium">{copy.awaitingStatus}: </span>{awaiting.map((check) => check[locale]).join(', ')}</p>}
          <div className="mt-3 border-t border-zinc-200 pt-2 text-[10px] leading-relaxed text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"><p className="mb-1 font-semibold">{copy.defaults}</p><p>{copy.defaultStatusNote}</p><p className="mt-1">{copy.intercomNote}</p></div>
        </section>
      </div>

      <details className="group rounded-lg border border-zinc-200 dark:border-zinc-700">
        <summary className="cursor-pointer rounded-lg px-3 py-2.5 text-xs font-semibold text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-zinc-200">{copy.rawTelemetry}<span className="ml-2 text-[10px] font-normal text-zinc-500 dark:text-zinc-400">{copy.rawTelemetryNote}</span></summary>
        <div className="space-y-4 border-t border-zinc-200 p-3 dark:border-zinc-700">
          <label className="inline-flex min-h-7 items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300"><input type="checkbox" checked={showUnreported} onChange={(event) => setShowUnreported(event.target.checked)} className="accent-blue-600" />{copy.showUnreported}</label>
          <div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-4">{rawGroups.map((group) => { const fields = group.fields.filter(([, value]) => showUnreported || isReportedValue(value)).map(([label, value]): [string, string] => [label, reported(value, copy)]); return fields.length ? <DetailGroup key={group.title} title={group.title} fields={fields} /> : showUnreported ? <section key={group.title}><h3 className="text-xs font-semibold">{group.title}</h3><p className="mt-1 text-xs text-zinc-500">{copy.noReportedFields}</p></section> : null; })}</div>
        </div>
      </details>
    </div>
  );
}

function optionsFor(units: UnitRow[], key: 'vehicleNo' | 'fleet' | 'driver' | 'type' | 'location') {
  return Array.from(new Set(units.map((row) => row[key]).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' }));
}

function unitKey(row: UnitRow) {
  return JSON.stringify([normalizeLabel(row.fleet), normalizeLabel(row.vehicleNo)]);
}

const OVERALL_STATUSES = ['healthy', 'warning', 'offline', 'unknown'] as const;

function aggregateCheckLabels(check: { key: string; en: string; th: string }) {
  if (check.key === 'ch1Ai') return { en: 'AI camera', th: 'กล้อง AI' };
  const camera = /^c([1-9])$/.exec(check.key);
  return camera ? { en: `Camera ${camera[1]}`, th: `กล้อง ${camera[1]}` } : { en: check.en, th: check.th };
}

type SortState = { key: string; direction: 'asc' | 'desc' };
const HEALTH_ORDER: Record<UnitHealth, number> = { offline: 0, unknown: 1, online: 2 };
const monitorCard = 'min-w-0 rounded-[10px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900';
const matrixCell = 'border-b border-zinc-200 px-2 py-1.5 text-center text-xs dark:border-zinc-700';

function MonitorPanel({ title, tone, children }: { title: string; tone: 'green' | 'gold' | 'blue' | 'plain'; children: ReactNode }) {
  const colors = {
    green: 'bg-gradient-to-b from-[#5c8a3f] to-[#3f6b2a] text-white',
    gold: 'bg-gradient-to-b from-[#f2b23d] to-[#d99420] text-[#3a2c05]',
    blue: 'bg-gradient-to-b from-[#3f7fc4] to-[#275c98] text-white',
    plain: 'border-b border-zinc-200 text-zinc-800 dark:border-zinc-700 dark:text-zinc-100',
  };
  return <section className={monitorCard}><h2 className={`rounded-t-[9px] px-3 py-2 text-xs font-bold ${colors[tone]}`}>{title}</h2><div className="p-3">{children}</div></section>;
}

function StatusMark({ status, label, copy }: { status: UnitHealth; label: string; copy: Copy }) {
  const words = { online: copy.online, offline: copy.offline, unknown: copy.notReported };
  const symbols = { online: '✓', offline: '×', unknown: '?' };
  const colors = { online: 'text-green-700 dark:text-green-400', offline: 'text-red-700 dark:text-red-400', unknown: 'text-zinc-400 dark:text-zinc-500' };
  return <span className={`inline-flex min-h-6 items-center justify-center text-base font-bold ${colors[status]}`} title={`${label}: ${words[status]}`}><span aria-hidden="true">{symbols[status]}</span><span className="sr-only">{label}: {words[status]}</span></span>;
}

function GeofenceBadge({ value, copy }: { value: UnitMonitorRow['geofence']; copy: Copy }) {
  if (!value) return null;
  const description = value === 'inferred' ? copy.geofenceInferred : copy.geofenceReported;
  return <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300" title={description}>
    {copy.geofence}{value === 'inferred' ? ` · ${copy.inferred}` : ''}<span className="sr-only">. {description}</span>
  </span>;
}

function CompletionBadge({ monitor, copy }: { monitor: UnitMonitorRow; copy: Copy }) {
  const styles = { complete: badgeSuccess, partial: badgeWarning, unknown: badgeDefault };
  const labels = { complete: copy.complete, partial: copy.waiting, unknown: copy.notReported };
  return <div className="space-y-1"><span className={styles[monitor.installation]}>{labels[monitor.installation]}</span><span className="block text-[10px] tabular-nums text-zinc-500 dark:text-zinc-400" title={copy.activeRequired}>{monitor.requiredPositions == null ? copy.expectedUnknown : `${monitor.activePositions}/${monitor.requiredPositions}`}</span></div>;
}

function sortValue(row: UnitMonitorRow, key: string): string | number | null {
  switch (key) {
    case 'vehicle': return row.unit.vehicleNo;
    case 'dateTime': return parseDate(row.unit.dataTime || row.unit.updatedRaw)?.getTime() ?? null;
    case 'gps': return HEALTH_ORDER[row.gpsStatus];
    case 'statusAi': return HEALTH_ORDER[row.statusAi];
    case 'deviceStatus': return HEALTH_ORDER[row.deviceStatus];
    case 'completion': return row.requiredPositions == null ? null : row.requiredPositions === 0 ? 1 : row.activePositions / row.requiredPositions;
    default: {
      const check = row.checks.find((item) => `check:${item.key}` === key);
      return !check || check.present === false ? null : HEALTH_ORDER[check.status];
    }
  }
}

function compareMonitorRows(a: UnitMonitorRow, b: UnitMonitorRow, sort: SortState) {
  const left = sortValue(a, sort.key);
  const right = sortValue(b, sort.key);
  // Missing dates/positions stay last in either direction.
  if (left === null || right === null) return left === right ? a.unit.vehicleNo.localeCompare(b.unit.vehicleNo, 'en', { numeric: true }) : left === null ? 1 : -1;
  const comparison = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right), 'en', { numeric: true, sensitivity: 'base' });
  return comparison * (sort.direction === 'asc' ? 1 : -1) || a.unit.vehicleNo.localeCompare(b.unit.vehicleNo, 'en', { numeric: true });
}

export default function UnitStatusDashboard({
  dashboardId, dashboardName, sheetId, sheetGid, dashboardNotes, organizationName,
  organizationNames, companyName, legacyBigthSource = false, lang = 'en', isAdmin = false,
}: DashboardProps) {
  const copy = COPY[lang === 'th' ? 'th' : 'en'];
  const locale = lang === 'th' ? 'th' : 'en';
  const instanceId = useId();
  const primary = useUnitStatusSheet({ sheetId, ...(legacyBigthSource ? { tabName: 'Unitstatus' } : { gid: sheetGid }) });
  const channelSheet = useUnitStatusSheet({ sheetId, tabName: 'CH' });
  const { columns, rows, loading, error, lastUpdated } = primary;
  const refreshPrimary = primary.refresh;
  const refreshChannels = channelSheet.refresh;
  const refreshing = primary.refreshing || channelSheet.refreshing;
  const refresh = useCallback(() => { refreshPrimary(); refreshChannels(); }, [refreshPrimary, refreshChannels]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<UnitUpdateStatus | ''>('');
  const [dateTimeRange, setDateTimeRange] = useState<DateTimeRange>({ start: '', end: '' });
  const [fleetFilters, setFleetFilters] = useState<string[]>([]);
  const [customerFilters, setCustomerFilters] = useState<string[]>([]);
  const [vehicleFilters, setVehicleFilters] = useState<string[]>([]);
  const [driverFilters, setDriverFilters] = useState<string[]>([]);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [locationFilters, setLocationFilters] = useState<string[]>([]);
  const [failedCheck, setFailedCheck] = useState('');
  const [overallFilters, setOverallFilters] = useState<UnitRow['overallStatus'][]>([]);
  const [moreFilters, setMoreFilters] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [damagePage, setDamagePage] = useState(0);
  const [sort, setSort] = useState<SortState>({ key: 'vehicle', direction: 'asc' });
  const [now, setNow] = useState(() => new Date());
  // A newly received report can be newer than the 30-second display clock.
  // Evaluate it at least at receipt time so fresh data is not briefly "future".
  const observationTime = useMemo(() => new Date(Math.max(now.getTime(), lastUpdated?.getTime() ?? 0)), [now, lastUpdated]);
  const scopeSet = useMemo(() => scopeFleetSet(organizationName, organizationNames), [organizationName, organizationNames]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, refresh]);

  const units = useMemo(() => buildUnitRows(rows, channelSheet.rows, scopeSet, observationTime, companyName), [rows, channelSheet.rows, scopeSet, observationTime, companyName]);
  const monitors = useMemo(() => buildUnitMonitorRows(units, observationTime), [units, observationTime]);
  const monitorColumns = useMemo(() => getUnitMonitorColumns(monitors), [monitors]);
  const options = useMemo(() => ({
    fleets: optionsFor(units, 'fleet'), vehicles: optionsFor(units, 'vehicleNo'),
    drivers: optionsFor(units, 'driver'), types: optionsFor(units, 'type'), locations: optionsFor(units, 'location'),
    customers: Array.from(new Set(monitors.flatMap((row) => row.customers))).sort((a, b) => a.localeCompare(b)),
  }), [units, monitors]);
  const checkOptions = useMemo(() => Array.from(new Map(monitors.flatMap((monitor) => [
    ...monitor.checks.filter((check) => check.present !== false),
    { key: 'statusAi', en: 'Status AI', th: 'สถานะ AI', status: monitor.statusAi },
    { key: 'deviceStatus', en: 'Device Status', th: 'สถานะอุปกรณ์', status: monitor.deviceStatus },
  ]).filter((check) => check.key !== 'intercom').map((check) => [check.key, { ...check, ...aggregateCheckLabels(check) }])).values())
    .sort((a, b) => a.en.localeCompare(b.en)), [monitors]);
  const filtered = useMemo(() => {
    const query = normalizeLabel(search);
    const fleets = new Set(fleetFilters.map(normalizeLabel));
    const customers = new Set(customerFilters.map(normalizeLabel));
    return monitors.filter((monitor) => {
      const row = monitor.unit;
      return (!status || row.updateStatus === status)
        && (!query || normalizeLabel(`${row.vehicleNo} ${row.location}`).includes(query))
        && (!isCompleteDateTimeRange(dateTimeRange) || isDateInDateTimeRange(parseDate(row.dataTime || row.updatedRaw), dateTimeRange))
        && (fleets.size === 0 || fleets.has(normalizeLabel(row.fleet)))
        && (customers.size === 0 || monitor.customers.some((customer) => customers.has(normalizeLabel(customer))))
        && (vehicleFilters.length === 0 || vehicleFilters.includes(row.vehicleNo))
        && (driverFilters.length === 0 || driverFilters.includes(row.driver))
        && (typeFilters.length === 0 || typeFilters.includes(row.type))
        && (locationFilters.length === 0 || locationFilters.includes(row.location))
        && (!failedCheck || getUnitMonitorDamage(monitor).some((check) => check.key === failedCheck))
        && (overallFilters.length === 0 || overallFilters.includes(monitor.overallStatus));
    });
  }, [monitors, search, status, dateTimeRange, fleetFilters, customerFilters, vehicleFilters, driverFilters, typeFilters, locationFilters, failedCheck, overallFilters]);
  const sorted = useMemo(() => [...filtered].sort((a, b) => compareMonitorRows(a, b, sort)), [filtered, sort]);
  // Reference summary panels intentionally remain fixed while table filters change.
  const damageEntries = useMemo(() => monitors.flatMap((monitor) => getUnitMonitorDamage(monitor).map((check) => ({ monitor, check }))), [monitors]);
  const maxDamagePage = Math.max(0, Math.ceil(damageEntries.length / 5) - 1);
  const currentDamagePage = Math.min(damagePage, maxDamagePage);
  const damageStart = currentDamagePage * 5;
  const fleetSummary = useMemo(() => {
    const result = new Map<string, { fleet: string; complete: number; partial: number; unknown: number; total: number }>();
    for (const row of monitors) {
      const key = normalizeLabel(row.unit.fleet);
      const entry = result.get(key) ?? { fleet: row.unit.fleet, complete: 0, partial: 0, unknown: 0, total: 0 };
      entry[row.installation] += 1;
      entry.total += 1;
      result.set(key, entry);
    }
    return Array.from(result.values()).sort((a, b) => a.fleet.localeCompare(b.fleet));
  }, [monitors]);
  const completionTotals = fleetSummary.reduce((sum, row) => ({ complete: sum.complete + row.complete, partial: sum.partial + row.partial, unknown: sum.unknown + row.unknown }), { complete: 0, partial: 0, unknown: 0 });
  const activeFilterCount = Number(Boolean(search.trim())) + Number(Boolean(status)) + Number(isCompleteDateTimeRange(dateTimeRange))
    + fleetFilters.length + customerFilters.length + vehicleFilters.length + driverFilters.length + typeFilters.length
    + locationFilters.length + Number(Boolean(failedCheck)) + overallFilters.length;
  const invalidSource = columns.length > 0 && !hasUnitStatusColumns(columns);
  const reset = () => {
    setSearch(''); setStatus(''); setExpanded(null); setDateTimeRange({ start: '', end: '' });
    setFleetFilters([]); setCustomerFilters([]); setVehicleFilters([]); setDriverFilters([]); setTypeFilters([]);
    setLocationFilters([]); setFailedCheck(''); setOverallFilters([]); setDamagePage(0); setSort({ key: 'vehicle', direction: 'asc' });
  };
  const focusDamageUnit = (monitor: UnitMonitorRow) => {
    reset();
    setVehicleFilters([monitor.unit.vehicleNo]);
    if (monitor.unit.fleet) setFleetFilters([monitor.unit.fleet]);
    setExpanded(unitKey(monitor.unit));
  };
  const toggle = (current: string[], value: string) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
  const overallLabels = { healthy: copy.healthy, warning: copy.warning, offline: copy.offline, unknown: copy.notReported };
  const checkedAt = lastUpdated ? new Date(lastUpdated.getTime() + 7 * 60 * 60 * 1_000) : null;
  const headers = [
    { key: 'vehicle', label: copy.vehicle }, { key: 'dateTime', label: copy.dateTime }, { key: 'gps', label: 'GPS' },
    { key: 'statusAi', label: lang === 'th' ? 'สถานะ AI' : 'Status AI' }, { key: 'deviceStatus', label: lang === 'th' ? 'สถานะอุปกรณ์' : 'Device Status' },
    ...monitorColumns.map((column) => ({ key: `check:${column.key}`, label: column[locale] })),
    { key: 'completion', label: copy.completion },
  ];

  return (
    <DashboardShell title={dashboardName} subtitle={copy.title} lang={lang}
      dashboardId={dashboardId} isAdmin={isAdmin} notes={dashboardNotes} lastUpdated={checkedAt}
      activeFilterCount={activeFilterCount} actions={<>
        <label className="inline-flex min-h-10 items-center gap-2 px-2 text-sm text-zinc-700 dark:text-zinc-200">
          <input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} className="h-4 w-4 accent-blue-600" />{copy.autoRefresh}
        </label>
        <button type="button" className={btnSecondary} onClick={refresh} disabled={loading || refreshing}>{refreshing ? copy.refreshing : copy.refresh}</button>
      </>}
    >
      {loading || error || invalidSource ? (
        <LoadingState lang={lang} message={copy.loading} error={error ?? (invalidSource ? copy.sourceError : undefined)} onRetry={refresh} />
      ) : (
        <div className="flex min-w-0 flex-col gap-3">
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{copy.scopeNote}</p>
          <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-[1.15fr_1.15fr_1.2fr_1fr]">
            <MonitorPanel title={copy.gpsTitle} tone="green">
              {(['online', 'offline', 'unknown'] as const).map((health) => {
                const count = monitors.filter((row) => row.gpsStatus === health).length;
                const color = { online: 'bg-[#57a13c]', offline: 'bg-red-600', unknown: 'bg-zinc-400' };
                return <div key={health} className="flex items-center gap-2 py-1.5 text-xs"><span className="w-20 text-zinc-600 dark:text-zinc-300">{health === 'unknown' ? copy.unknownBadge : copy[health]}</span><div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700" aria-hidden="true"><div className={`h-full rounded-full ${color[health]}`} style={{ width: `${monitors.length ? count / monitors.length * 100 : 0}%` }} /></div><span className="w-7 text-right font-semibold tabular-nums text-zinc-800 dark:text-zinc-100">{count}</span></div>;
              })}
              <div className="mt-2 flex justify-between border-t border-zinc-200 pt-2 text-xs font-bold dark:border-zinc-700"><span>{copy.total}</span><span className="tabular-nums">{monitors.length}</span></div>
              <p className="mt-2 text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">{copy.gpsRule}</p>
            </MonitorPanel>
            <MonitorPanel title={copy.damageTitle} tone="gold">
              <ol start={damageStart + 1} className="min-h-[125px] text-xs">
                {damageEntries.slice(damageStart, damageStart + 5).map(({ monitor, check }, index) => <li key={`${unitKey(monitor.unit)}:${check.key}`} className="flex items-start gap-2 border-b border-zinc-100 py-1 dark:border-zinc-800"><span className="w-4 shrink-0 text-zinc-400">{damageStart + index + 1}</span><button type="button" className="min-w-0 text-left text-zinc-700 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-zinc-200 dark:hover:text-blue-300" onClick={() => focusDamageUnit(monitor)}><strong>{monitor.unit.vehicleNo}</strong><span className="ml-1 text-zinc-500 dark:text-zinc-400">{check[locale]}</span></button></li>)}
                {damageEntries.length === 0 && <li className="py-3 text-zinc-500 dark:text-zinc-400">{copy.noDamage}</li>}
              </ol>
              <div className="mt-2 flex items-center justify-end gap-2 text-[10px] text-zinc-500 dark:text-zinc-400"><span>{copy.damageRange(damageEntries.length ? damageStart + 1 : 0, Math.min(damageStart + 5, damageEntries.length), damageEntries.length)}</span><button type="button" aria-label={copy.previous} disabled={currentDamagePage === 0} onClick={() => setDamagePage(currentDamagePage - 1)} className="h-7 w-7 rounded border border-zinc-200 text-base disabled:opacity-30 dark:border-zinc-700">‹</button><button type="button" aria-label={copy.next} disabled={currentDamagePage >= maxDamagePage} onClick={() => setDamagePage(currentDamagePage + 1)} className="h-7 w-7 rounded border border-zinc-200 text-base disabled:opacity-30 dark:border-zinc-700">›</button></div>
            </MonitorPanel>
            <MonitorPanel title={copy.completion} tone="blue">
              <div className="max-h-[220px] overflow-auto"><table className="w-full text-xs"><thead><tr className="text-[10px] text-zinc-500 dark:text-zinc-400"><th scope="col" className="pb-2 text-left font-medium">{copy.fleet}</th><th scope="col" className="pb-2 text-right font-medium">{copy.complete}</th><th scope="col" className="pb-2 text-right font-medium">{copy.waiting}</th><th scope="col" className="pb-2 text-right font-medium">{copy.unknownBadge}</th></tr></thead><tbody>{fleetSummary.map((row) => <tr key={row.fleet} className="text-zinc-700 dark:text-zinc-200"><th scope="row" className="max-w-[100px] break-words py-1 text-left font-medium">{row.fleet || copy.notReported}</th><td className="py-1 text-right font-semibold tabular-nums text-green-700 dark:text-green-400">{row.complete}</td><td className="py-1 text-right tabular-nums text-amber-700 dark:text-amber-400">{row.partial}</td><td className="py-1 text-right tabular-nums text-zinc-400">{row.unknown}</td></tr>)}</tbody><tfoot><tr className="border-t border-zinc-200 font-bold dark:border-zinc-700"><th scope="row" className="pt-2 text-left">{copy.total}</th><td className="pt-2 text-right tabular-nums">{completionTotals.complete}</td><td className="pt-2 text-right tabular-nums">{completionTotals.partial}</td><td className="pt-2 text-right tabular-nums">{completionTotals.unknown}</td></tr></tfoot></table></div>
              <p className="mt-2 text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">{copy.completionNote}</p>
            </MonitorPanel>
            <MonitorPanel title={copy.filters} tone="plain">
              <label htmlFor={`${instanceId}-search`} className="sr-only">{copy.search}</label><input id={`${instanceId}-search`} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.placeholder} className={`${inputBase} mb-2 !min-h-8 !rounded-md !py-1 !text-xs`} />
              <fieldset><legend className="mb-1 text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">{copy.fleet}</legend><div className="max-h-24 overflow-y-auto">{options.fleets.map((fleet) => <label key={fleet} className="flex min-h-7 items-center justify-between gap-2 text-xs text-zinc-700 dark:text-zinc-200"><span className="flex min-w-0 items-center gap-2"><input type="checkbox" checked={fleetFilters.includes(fleet)} onChange={() => setFleetFilters((current) => toggle(current, fleet))} className="accent-blue-600" /><span className="truncate">{fleet}</span></span><span className="tabular-nums text-zinc-400">{monitors.filter((row) => row.unit.fleet === fleet).length}</span></label>)}</div></fieldset>
              <fieldset className="mt-2 border-t border-zinc-100 pt-2 dark:border-zinc-800"><legend className="pt-2 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">{copy.customer}</legend><div className="max-h-24 overflow-y-auto">{options.customers.map((customer) => <label key={customer} className="flex min-h-7 items-center justify-between gap-2 text-xs text-zinc-700 dark:text-zinc-200"><span className="flex min-w-0 items-center gap-2"><input type="checkbox" checked={customerFilters.includes(customer)} onChange={() => setCustomerFilters((current) => toggle(current, customer))} className="accent-blue-600" /><span className="truncate">{customer}</span></span><span className="tabular-nums text-zinc-400">{monitors.filter((row) => row.customers.includes(customer)).length}</span></label>)}{options.customers.length === 0 && <p className="py-1 text-[10px] text-zinc-400">{copy.notReported}</p>}</div></fieldset>
              <p className="mt-2 text-[10px] text-zinc-400">{copy.noSelection}</p>
            </MonitorPanel>
          </div>

          <section className={`${monitorCard} relative z-20`} data-print-hide>
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"><button type="button" className="inline-flex min-h-8 items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200" aria-expanded={moreFilters} aria-controls={`${instanceId}-more-filters`} onClick={() => setMoreFilters((value) => !value)}><span aria-hidden="true">{moreFilters ? '▾' : '▸'}</span>{copy.moreFilters}{activeFilterCount > 0 && <span className={badgeDefault}>{activeFilterCount}</span>}</button><button type="button" className="min-h-8 rounded px-2 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950" onClick={reset}>{copy.reset}</button></div>
            <div id={`${instanceId}-more-filters`} hidden={!moreFilters} className="space-y-3 border-t border-zinc-200 p-3 dark:border-zinc-700">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="sm:col-span-2"><p className={`${labelBase} mb-1 !text-xs`}>{copy.dates}</p><DateTimeRangePicker value={dateTimeRange} onChange={setDateTimeRange} lang={lang} className="w-full" /></div><div><label htmlFor={`${instanceId}-update`} className={`${labelBase} mb-1 !text-xs`}>{copy.updateStatus}</label><select id={`${instanceId}-update`} className={selectBase} value={status} onChange={(event) => setStatus(event.target.value as UnitUpdateStatus | '')}><option value="">{copy.all}</option><option value="recent">{copy.recent}</option><option value="stale">{copy.stale}</option><option value="unknown">{copy.unknown}</option></select></div><div><label htmlFor={`${instanceId}-failed`} className={`${labelBase} mb-1 !text-xs`}>{copy.failedCheck}</label><select id={`${instanceId}-failed`} className={selectBase} value={failedCheck} onChange={(event) => setFailedCheck(event.target.value)}><option value="">{copy.allChecks}</option>{checkOptions.map((check) => <option key={check.key} value={check.key}>{check[locale]}</option>)}</select></div></div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div role="group" aria-label={copy.vehicle}><p className={`${labelBase} mb-1 !text-xs`}>{copy.vehicle}</p><MultiSelect label={copy.vehicles} options={options.vehicles} selected={vehicleFilters} onChange={setVehicleFilters} lang={lang} /></div><div role="group" aria-label={copy.driver}><p className={`${labelBase} mb-1 !text-xs`}>{copy.driver}</p><MultiSelect label={copy.drivers} options={options.drivers} selected={driverFilters} onChange={setDriverFilters} lang={lang} /></div><div role="group" aria-label={copy.type}><p className={`${labelBase} mb-1 !text-xs`}>{copy.type}</p><MultiSelect label={copy.types} options={options.types} selected={typeFilters} onChange={setTypeFilters} lang={lang} /></div><div role="group" aria-label={copy.locationFilter}><p className={`${labelBase} mb-1 !text-xs`}>{copy.locationFilter}</p><MultiSelect label={copy.locations} options={options.locations} selected={locationFilters} onChange={setLocationFilters} lang={lang} /></div></div>
              <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-zinc-100 pt-2 dark:border-zinc-800"><legend className="sr-only">{copy.overall}</legend><span aria-hidden="true" className="text-xs font-medium text-zinc-500">{copy.overall}</span>{OVERALL_STATUSES.map((overallStatus) => <label key={overallStatus} className="inline-flex min-h-7 items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300"><input type="checkbox" checked={overallFilters.includes(overallStatus)} onChange={() => setOverallFilters((current) => current.includes(overallStatus) ? current.filter((value) => value !== overallStatus) : [...current, overallStatus])} className="accent-blue-600" />{overallLabels[overallStatus]}</label>)}</fieldset>
            </div>
          </section>

          <section className={monitorCard}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-700"><p className="text-[11px] text-zinc-500 dark:text-zinc-400">{copy.sortHint}</p><p className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400" aria-live="polite">{copy.count(sorted.length, monitors.length)}</p></div>
            <div className="overflow-x-auto [container-type:inline-size]" tabIndex={0} role="region" aria-label={copy.title}>
              <table className="w-full border-collapse text-xs" style={{ minWidth: 560 + monitorColumns.length * 82 }}>
                <thead><tr>{headers.map((header, index) => <th key={header.key} scope="col" aria-sort={sort.key === header.key ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'} className={`border-r border-white/10 bg-[#274357] px-2 py-2 text-center text-[10px] font-semibold text-white dark:bg-[#12232f] ${index === 0 ? 'sticky left-0 z-30 min-w-[125px] text-left' : ''}`}><button type="button" className="inline-flex min-h-7 items-center justify-center gap-1 whitespace-nowrap rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" aria-label={`${copy.sortBy}: ${header.label}`} onClick={() => setSort((current) => ({ key: header.key, direction: current.key === header.key && current.direction === 'asc' ? 'desc' : 'asc' }))}>{header.label}<span aria-hidden="true" className="text-[9px] opacity-60">{sort.key === header.key ? sort.direction === 'asc' ? '↑' : '↓' : '↕'}</span></button></th>)}</tr></thead>
                <tbody>{sorted.map((monitor, index) => {
                  const row = monitor.unit;
                  const key = unitKey(row);
                  const isExpanded = expanded === key;
                  const detailsId = `unit-status-details-${instanceId}-${encodeURIComponent(key)}`;
                  const background = index % 2 === 0 ? 'bg-[#d7f0f8] dark:bg-[#1c333d]' : 'bg-white dark:bg-zinc-900';
                  const checkMap = new Map(monitor.checks.map((check) => [check.key, check]));
                  return <Fragment key={key}>
                    <tr className={background}>
                      <th scope="row" className={`${matrixCell} sticky left-0 z-10 ${background} !text-left`}><span className="font-bold text-zinc-900 dark:text-zinc-100">{row.vehicleNo}</span>{monitor.duplicateRecording && <span className="ml-1 text-amber-700 dark:text-amber-400" title={copy.duplicateRecording}><span aria-hidden="true">⚠</span><span className="sr-only">{copy.duplicateRecording}</span></span>}<span className="ml-1 text-[9px] font-normal text-zinc-500 dark:text-zinc-400">{row.fleet}</span><button type="button" className="flex min-h-7 items-center gap-1 rounded text-[10px] font-medium text-blue-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-blue-300" aria-expanded={isExpanded} aria-controls={isExpanded ? detailsId : undefined} aria-label={`${isExpanded ? copy.hide : copy.show}: ${row.vehicleNo}${row.fleet ? ` · ${row.fleet}` : ''}`} onClick={() => setExpanded(isExpanded ? null : key)}>{isExpanded ? copy.hide : copy.show}<span aria-hidden="true">{isExpanded ? '▴' : '▾'}</span></button></th>
                      <td className={`${matrixCell} whitespace-nowrap !text-left tabular-nums`}><span className="block">{reportedTime(row.dataTime || row.updatedRaw, copy)}</span><span className="mt-0.5 block"><UpdateBadge status={row.updateStatus} copy={copy} /></span></td>
                      <td className={matrixCell}><span className={`text-[11px] font-semibold ${monitor.gpsStatus === 'online' ? 'text-green-700 dark:text-green-400' : monitor.gpsStatus === 'offline' ? 'text-red-700 dark:text-red-400' : 'text-zinc-400'}`}>{monitor.gpsStatus === 'unknown' ? copy.unknownBadge : copy[monitor.gpsStatus]}</span></td>
                      <td className={`${matrixCell} bg-[#dcecd4] dark:bg-[#1f3325]`}><StatusMark status={monitor.statusAi} label={copy.aiStatus} copy={copy} /></td>
                      <td className={`${matrixCell} bg-[#dcecd4] dark:bg-[#1f3325]`}><StatusMark status={monitor.deviceStatus} label={copy.device} copy={copy} />{monitor.geofence && <span className="block"><GeofenceBadge value={monitor.geofence} copy={copy} /></span>}</td>
                      {monitorColumns.map((column) => {
                        const check = checkMap.get(column.key);
                        const inactiveLabel = `${column[locale]}: ${copy.cameraInactive}. ${monitor.geofence === 'inferred' ? copy.geofenceInferred : copy.geofenceReported}`;
                        return <td key={column.key} className={matrixCell}>{check && check.present !== false && (check.displayStatus === 'inactive'
                          ? <span className="text-zinc-400 dark:text-zinc-500" title={inactiveLabel}><span aria-hidden="true">—</span><span className="sr-only">{inactiveLabel}</span></span>
                          : <StatusMark status={check.status} label={column[locale]} copy={copy} />)}</td>;
                      })}
                      <td className={matrixCell}><CompletionBadge monitor={monitor} copy={copy} /></td>
                    </tr>
                    {isExpanded && <tr className="border-b border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950"><td colSpan={headers.length} className="p-0 align-top"><div id={detailsId} className="sticky left-0 box-border w-[100cqw] max-w-full px-4 sm:px-6" role="region" aria-label={`${copy.details}: ${row.vehicleNo}${row.fleet ? ` · ${row.fleet}` : ''}`}><div className="flex flex-wrap items-center gap-2 pt-4 pb-3"><p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{row.vehicleNo}{row.fleet ? ` · ${row.fleet}` : ''}</p><GeofenceBadge value={monitor.geofence} copy={copy} /></div><UnitDetails monitor={monitor} copy={copy} lang={lang} now={observationTime} /></div></td></tr>}
                  </Fragment>;
                })}{sorted.length === 0 && <tr><td colSpan={headers.length} className="px-4 py-10 text-center text-sm text-zinc-500">{monitors.length ? copy.noMatch : copy.empty}</td></tr>}</tbody>
              </table>
            </div>
            <div className="space-y-1 px-3 py-2 text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400"><p>{copy.checksLegend}</p><p>{copy.intercomNote}</p><p>{copy.defaultStatusNote}</p><p>{copy.activeRequired} · {copy.timeNote}</p>{(channelSheet.error || channelSheet.loading) && <p role="status">{channelSheet.error ? copy.metadataUnavailable : copy.metadataLoading}</p>}</div>
          </section>
        </div>
      )}
    </DashboardShell>
  );
}

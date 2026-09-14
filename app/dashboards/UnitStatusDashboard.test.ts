import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoogleSheetRow } from './googleSheetParse';
import UnitStatusDashboard from './UnitStatusDashboard';
import useUnitStatusSheet from './useUnitStatusSheet';

vi.mock('./useUnitStatusSheet', () => ({ default: vi.fn() }));

const now = new Date('2026-09-14T05:00:00Z'); // 12:00 Bangkok
const sourceRow = (vehicleNo: string, overrides: GoogleSheetRow = {}): GoogleSheetRow => ({
  vehicleno: vehicleNo,
  username: 'Acme',
  datatime: '14/09/2026 11:59:00',
  lastupdatedtime: '14/09/2026 11:59:00',
  'Status AI': 'online',
  'Device Status': 'online',
  Front: 'online',
  Storage: 'online',
  'In Geofence': false,
  ...overrides,
});

function renderDashboard(rows: GoogleSheetRow[], lang: 'en' | 'th' = 'en', metadataAvailable = true) {
  vi.mocked(useUnitStatusSheet).mockReturnValue({
    columns: [{ fieldKey: 'vehicleno', label: 'vehicleno', type: 'string' }, { fieldKey: 'datatime', label: 'datatime', type: 'string' }],
    rows,
    channelRows: [],
    cameraHistory: {},
    historyAvailable: true,
    metadataAvailable,
    lastUpdated: now,
    loading: false,
    refreshing: false,
    error: null,
    refresh: vi.fn(async () => {}),
  });
  return renderToStaticMarkup(createElement(UnitStatusDashboard, {
    dashboardId: 'offline-display-test',
    dashboardName: 'Fleet monitor',
    sheetId: 'test-sheet',
    sheetGid: '0',
    lang,
  }));
}

// Read the rendered matrix without depending on styling or surrounding panels.
function matrixRow(markup: string, vehicleNo: string) {
  const table = Array.from(markup.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/g))
    .find((match) => match[1].includes('aria-sort='))?.[1];
  expect(table, 'equipment matrix').toBeDefined();
  const row = Array.from(table!.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g))
    .find((match) => match[1].includes(`>${vehicleNo}</span>`))?.[1];
  expect(row, `matrix row for ${vehicleNo}`).toBeDefined();
  const cells = Array.from(row!.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g), (match) => match[1]);
  const labels = Array.from(table!.matchAll(/<th\b[^>]*scope="col"[^>]*>[\s\S]*?<button\b[^>]*>([^<]*)/g), (match) => match[1]);
  return { cells, byLabel: new Map(labels.slice(1).map((label, index) => [label, cells[index]])) };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('UnitStatusDashboard offline equipment display', () => {
  it.each([false, true])('shows a literal dash in every equipment column when the vehicle is offline (geofence: %s)', (geofence) => {
    const markup = renderDashboard([
      sourceRow('OFFLINE', {
        datatime: '14/09/2026 11:49:59',
        'Status AI': 'offline',
        'Seat Vibrator': 'offline',
        Intercom: 'offline',
        'In Geofence': geofence,
      }),
      sourceRow('OTHER', { MCR: 'online', Camera4: 'online' }),
    ]);
    const { cells, byLabel } = matrixRow(markup, 'OFFLINE');

    expect(cells[1]).toContain('>Offline</span>');
    expect(byLabel.get('Intercom')).toContain('title="Intercom: Vehicle offline"');
    // MCR and Camera 4 are visible only because another vehicle reports them.
    expect(byLabel.has('MCR')).toBe(true);
    expect(byLabel.has('Camera 4')).toBe(true);
    expect(cells.slice(2, -1).length).toBeGreaterThan(5);
    for (const cell of cells.slice(2, -1)) {
      expect(cell).toContain('<span aria-hidden="true">-</span>');
      expect(cell).toContain(': Vehicle offline');
      expect(cell).not.toMatch(/<span aria-hidden="true">[✓×?—]<\/span>/);
    }
  });

  it.each([
    ['14/09/2026 11:50:00', 'Online'],
    ['invalid', 'Unknown'],
  ])('preserves equipment marks and blanks for report time %s, including independent device faults', (dataTime, gpsLabel) => {
    const markup = renderDashboard([
      sourceRow('VISIBLE', {
        datatime: dataTime,
        'Status AI': '',
        'Device Status': 'offline',
        Storage: 'offline',
        Intercom: 'offline',
      }),
      sourceRow('OTHER', { MCR: 'online' }),
    ]);
    const { cells, byLabel } = matrixRow(markup, 'VISIBLE');

    expect(cells[1]).toContain(`>${gpsLabel}</span>`);
    expect(byLabel.get('Status AI')).toContain('<span aria-hidden="true">?</span>');
    expect(byLabel.get('Device Status')).toContain('<span aria-hidden="true">×</span>');
    expect(byLabel.get('Storage')).toContain('<span aria-hidden="true">×</span>');
    expect(byLabel.get('Front')).toContain('<span aria-hidden="true">✓</span>');
    expect(byLabel.get('Intercom')).toContain('<span aria-hidden="true">✓</span>');
    expect(byLabel.get('MCR')).toBe('');
    expect(cells.join('')).not.toContain('Vehicle offline');
  });

  it('retains the camera geofence mark for an online vehicle while Intercom stays online', () => {
    const { byLabel } = matrixRow(renderDashboard([sourceRow('GEOFENCE', { 'In Geofence': true })]), 'GEOFENCE');
    expect(byLabel.get('Front')).toContain('<span aria-hidden="true">—</span>');
    expect(byLabel.get('Front')).toContain('Camera inactive in geofence');
    expect(byLabel.get('Intercom')).toContain('<span aria-hidden="true">✓</span>');
  });

  it('changes the equipment display as a report crosses the ten-minute online boundary', () => {
    const rows = [sourceRow('AGING', { datatime: '14/09/2026 11:50:00' })];
    const before = matrixRow(renderDashboard(rows), 'AGING');
    expect(before.byLabel.get('Intercom')).toContain('<span aria-hidden="true">✓</span>');

    vi.setSystemTime(new Date(now.getTime() + 1_000));
    const after = matrixRow(renderDashboard(rows), 'AGING');
    expect(after.cells[1]).toContain('>Offline</span>');
    expect(after.byLabel.get('Intercom')).toContain('<span aria-hidden="true">-</span>');
  });
});

describe('UnitStatusDashboard footer', () => {
  it.each([
    {
      lang: 'en' as const,
      offlineLabel: 'Vehicle offline',
      removed: [
        '✓ Online · × Offline · ? Unknown · blank = assumed uninstalled',
        'Camera installation is remembered across refreshes.',
        'Intercom is always Online because its data has no status trigger.',
        'Seat Vibrator and Cabin default to Online when their status is not reported.',
        'Online / required positions · Times shown in Bangkok time',
      ],
      metadata: 'Equipment/fleet metadata could not be loaded. Only units whose fleet can be verified are shown.',
    },
    {
      lang: 'th' as const,
      offlineLabel: 'รถออฟไลน์',
      removed: [
        '✓ ออนไลน์ · × ออฟไลน์ · ? ไม่ทราบ · ว่าง = คาดว่าไม่ติดตั้ง',
        'จดจำกล้องที่เคยบันทึกข้ามการรีเฟรช',
        'Intercom แสดงออนไลน์เสมอ เนื่องจากข้อมูลไม่มีเงื่อนไขแจ้งสถานะ',
        'Seat Vibrator และ Cabin แสดงออนไลน์เป็นค่าเริ่มต้นเมื่อไม่มีรายงานสถานะ',
        'ตำแหน่งออนไลน์ / ที่ต้องมี · แสดงเวลาประเทศไทย',
      ],
      metadata: 'ไม่สามารถโหลดข้อมูลอุปกรณ์และกลุ่มรถได้ แสดงเฉพาะรถที่ยืนยันสิทธิ์กลุ่มรถจากต้นทางได้',
    },
  ])('removes the explanatory text in $lang and retains metadata failure feedback', ({ lang, offlineLabel, removed, metadata }) => {
    const markup = renderDashboard([sourceRow('OFFLINE', { datatime: '14/09/2026 11:40:00' })], lang, false);
    for (const paragraph of removed) expect(markup).not.toContain(paragraph);
    expect(markup).toContain(offlineLabel);
    expect(markup).toContain('role="status"');
    expect(markup).toContain(metadata);
  });
});

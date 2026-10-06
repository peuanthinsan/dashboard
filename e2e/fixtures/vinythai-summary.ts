import type { GoogleSheetRow } from '../../app/dashboards/googleSheetParse';

export const monthKeys = ['2026-06', '2026-07', '2026-08', '2026-09'];
const fleets = ['Thongtransport Vinythai', 'Fusion Vinythai', 'SaengArunroge Vinythai', 'TSSKVinythai', 'VINITHAI'];

/** Synthetic, visibly labelled preview data; never customer records. */
export const rows: GoogleSheetRow[] = Array.from({ length: 420 }, (_, i) => ({
  id: String(i), 'Vehicle No': `VNT-${String(i % 27 + 1).padStart(3, '0')}`,
  Fleet: fleets[i % fleets.length]!, 'Driver Name': `Preview driver ${i % 20 + 1}`,
  'Alert Type': i % 3 === 0 ? 'OverSpeed' : 'Eye Closing-A2',
  Remarks: i % 3 === 0 ? 'Overspeed' : 'Mobile Phone',
  'Alert Date Time': `${monthKeys[Math.floor(i / 105)]}-15 ${String(i % 24).padStart(2, '0')}:15:00`,
  'Track Time': `${monthKeys[Math.floor(i / 105)]}-15 ${String(i % 24).padStart(2, '0')}:15:00`,
  Speed: 25 + i % 60,
}));
rows.push({ ...rows[0]! }); // duplicate does not change totals
rows.push({ ...rows[0]!, id: 'non-fleet', Fleet: '', 'Vehicle No': 'OUTSIDE' });
rows.push({ ...rows[1]!, id: 'fallback', 'Alert Date Time': '', 'Track Time': '2026-07-05 3:07:01' });

export const columns = Object.keys(rows[0]!).map((label) => ({ label, fieldKey: label, type: label.includes('Time') ? 'datetime' : label === 'Speed' ? 'number' : 'string' }));

import { describe, expect, it } from 'vitest';
import type { GoogleSheetColumn, GoogleSheetRow } from './googleSheetParse';
import { buildSimpleSummaryComparison, isSimpleSummarySheet, parseSimpleSummary } from './simpleSummaryData';

const columns: GoogleSheetColumn[] = [
  { label: 'เดือน (YYYY-MM)', fieldKey: 'month-field', type: 'string' },
  { label: 'ประเภท (คอลัมน์ H)', fieldKey: 'type-field', type: 'string' },
  { label: 'จำนวนสรุป', fieldKey: 'count-field', type: 'number' },
];
const row = (month: GoogleSheetRow[string], alertType: GoogleSheetRow[string], count: GoogleSheetRow[string]): GoogleSheetRow => ({
  'month-field': month, 'type-field': alertType, 'count-field': count,
});

// All 28 supplied monthly summaries, including types outside the former three categories.
const sheetRows = [
  row('2026-06', 'Distraction', '733'),
  row('2026-06', 'Eating/Drinking', '23'),
  row('2026-06', 'F&D', '1'),
  row('2026-06', 'Fatigue', '2'),
  row('2026-06', 'Maintenance', '8'),
  row('2026-06', 'Mirror Check', '16'),
  row('2026-06', 'Mobile Phone', '77'),
  row('2026-06', 'Smoking', '9'),
  row('2026-06', 'Storage Error', '2'),
  row('2026-06', 'Yawning', '17'),
  row('2026-07', 'Distraction', '1584'),
  row('2026-07', 'Eating/Drinking', '33'),
  row('2026-07', 'False alert', '1'),
  row('2026-07', 'Fatigue', '30'),
  row('2026-07', 'Maintenance', '31'),
  row('2026-07', 'Mirror Check', '44'),
  row('2026-07', 'Mobile Phone', '138'),
  row('2026-07', 'Smoking', '26'),
  row('2026-07', 'Speed Meter Check', '130'),
  row('2026-07', 'Yawning', '56'),
  row('2026-08', 'Distraction', '161'),
  row('2026-08', 'Eating/Drinking', '4'),
  row('2026-08', 'Fatigue', '4'),
  row('2026-08', 'Mirror Check', '6'),
  row('2026-08', 'Mobile Phone', '18'),
  row('2026-08', 'Smoking', '1'),
  row('2026-08', 'Speed Meter Check', '2'),
  row('2026-08', 'Yawning', '7'),
];

describe('parseSimpleSummary', () => {
  it('reads the supplied three-column summary through field keys and preserves all 12 types', () => {
    const parsed = parseSimpleSummary(columns, sheetRows);
    expect(parsed.error).toBeNull();
    expect(parsed.records).toHaveLength(28);
    expect(parsed.months).toEqual(['2026-06', '2026-07', '2026-08']);
    expect(parsed.alertTypes).toEqual([
      'Distraction', 'Eating/Drinking', 'F&D', 'False alert', 'Fatigue', 'Maintenance',
      'Mirror Check', 'Mobile Phone', 'Smoking', 'Speed Meter Check', 'Storage Error', 'Yawning',
    ]);
    const comparison = buildSimpleSummaryComparison(parsed.records);
    expect(comparison.total).toBe(3164);
    expect(comparison.rows.map(({ total }) => total)).toEqual([888, 2073, 203]);
  });

  it.each([
    ['\uFEFF  MONTH  ', ' Alert  Type ', ' SUMMARY COUNT '],
    ['Month (YYYY-MM)', 'Type', 'Count'],
    ['เดือน', 'ประเภท', 'Total'],
    [' เดือน (YYYY-MM) ', ' ประเภท (คอลัมน์ H) ', ' จำนวนสรุป '],
  ])('accepts aliases and BOM/whitespace/case differences: %s / %s / %s', (...labels) => {
    const aliasedColumns = columns.map((column, index) => ({ ...column, label: labels[index]! }));
    expect(parseSimpleSummary(aliasedColumns, [row(' 2026-07 ', ' New Type ', ' 1,584 ')])).toEqual({
      records: [{ month: '2026-07', alertType: 'New Type', count: 1584 }],
      months: ['2026-07'], alertTypes: ['New Type'], error: null,
    });
  });

  it('sums duplicates, retains zero counts, and orders future months across a year boundary', () => {
    const parsed = parseSimpleSummary(columns, [
      row('2031-01', 'Unknown alert', 0), row('2030-12', 'F&D', 2),
      row('2030-12', 'F&D', '3'), row('2030-02', 'Storage Error', 1),
    ]);
    expect(parsed.records).toEqual([
      { month: '2030-02', alertType: 'Storage Error', count: 1 },
      { month: '2030-12', alertType: 'F&D', count: 5 },
      { month: '2031-01', alertType: 'Unknown alert', count: 0 },
    ]);
    expect(parsed.alertTypes).toContain('Unknown alert');
  });

  it('ignores wholly blank rows, including empty objects, while retaining a zero row', () => {
    expect(parseSimpleSummary(columns, [{}, row(null, '  ', null), row('2026-01', 'New', 0)]).records)
      .toEqual([{ month: '2026-01', alertType: 'New', count: 0 }]);
    expect(parseSimpleSummary(columns, []).error).toBeNull();
  });

  it('reports missing or ambiguous schema even when there are no data rows', () => {
    expect(parseSimpleSummary(columns.slice(0, 2), []).error).toContain('must include');
    expect(parseSimpleSummary([...columns, { label: 'Month', fieldKey: 'other', type: 'string' }], []).error)
      .toContain('more than one month column');
  });

  it('detects complete summary headers without mistaking partial or raw schemas for summaries', () => {
    expect(isSimpleSummarySheet(columns)).toBe(true);
    expect(isSimpleSummarySheet(columns.slice(0, 2))).toBe(false);
    expect(isSimpleSummarySheet([
      { label: 'Timestamp', fieldKey: 'timestamp', type: 'date' },
      { label: 'Alert Type', fieldKey: 'alert', type: 'string' },
      { label: 'Remark', fieldKey: 'remark', type: 'string' },
    ])).toBe(false);
    expect(isSimpleSummarySheet([...columns, { label: 'Count', fieldKey: 'extra', type: 'number' }])).toBe(false);
  });

  it.each(['Count', 'Total'])('recognizes the English three-column summary using %s', (countHeader) => {
    expect(isSimpleSummarySheet(['Month', 'Alert Type', countHeader].map((label) => ({
      label, fieldKey: label, type: 'string',
    })))).toBe(true);
  });

  it.each([
    'Alert Date Time', 'Track Time', 'Date', 'Timestamp',
    'Vehicle No', 'Vehicle No TH', 'Driver Name', 'Remarks', 'Remark',
    'Fleet', 'Speed', 'Max Speed',
  ])('preserves raw sheets with Month/Count helper columns and a %s event column', (rawHeader) => {
    for (const countHeader of ['Count', 'Total']) {
      const helperColumns = ['Month', 'Alert Type', countHeader].map((label) => ({
        label, fieldKey: label, type: 'string',
      }));
      expect(isSimpleSummarySheet([
        ...helperColumns,
        { label: rawHeader, fieldKey: 'raw-field', type: 'string' },
      ])).toBe(false);
      expect(isSimpleSummarySheet([
        ...helperColumns,
        { label: `\uFEFF ${rawHeader.toUpperCase().replace(/ /g, '  ')} `, fieldKey: 'raw-field', type: 'string' },
      ])).toBe(false);
    }
  });

  it.each(['2026-00', '2026-13', '2026-7', '26-07', '2026-07-01', 'July 2026', '0000-01', null, 202607])(
    'rejects invalid month %s and exposes a row-specific error without partial totals', (month) => {
      const parsed = parseSimpleSummary(columns, [sheetRows[0]!, row(month, 'New', 1)]);
      expect(parsed.error).toContain('Row 3: Month');
      expect(parsed.records).toEqual([]);
      expect(parsed.months).toEqual([]);
    },
  );

  it.each(['', null, false, '-1', -1, '1.5', 1.5, '1,23', '1,234,56', '1e3', '1 000', Number.NaN, Number.POSITIVE_INFINITY, '9007199254740992'])(
    'rejects invalid count %s instead of turning it into zero', (count) => {
      expect(parseSimpleSummary(columns, [row('2026-07', 'New', count)]).error).toContain('Row 2: Count');
    },
  );

  it('rejects missing type and partially filled rows', () => {
    expect(parseSimpleSummary(columns, [row('2026-07', ' ', 1)]).error).toContain('Alert Type');
    expect(parseSimpleSummary(columns, [{ unrelated: 'nonblank data' }]).error).toContain('Row 2: Month');
  });

  it('rejects totals that exceed exact integer precision', () => {
    expect(parseSimpleSummary(columns, [row('2026-07', 'A', Number.MAX_SAFE_INTEGER), row('2026-07', 'B', 1)]).error)
      .toContain('total exceeds');
  });
});

describe('buildSimpleSummaryComparison', () => {
  const records = parseSimpleSummary(columns, sheetRows).records;

  it('zero-fills absent month/type pairs and retains months after filtering a rare type', () => {
    const comparison = buildSimpleSummaryComparison(records, undefined, ['F&D', 'Storage Error']);
    expect(comparison.months).toEqual(['2026-06', '2026-07', '2026-08']);
    expect(comparison.rows).toEqual([
      { month: '2026-06', counts: { 'F&D': 1, 'Storage Error': 2 }, total: 3 },
      { month: '2026-07', counts: { 'F&D': 0, 'Storage Error': 0 }, total: 0 },
      { month: '2026-08', counts: { 'F&D': 0, 'Storage Error': 0 }, total: 0 },
    ]);
    expect(comparison.total).toBe(3);
    expect(comparison.typeTotals).toEqual({ 'F&D': 1, 'Storage Error': 2 });
  });

  it('applies both filters and computes totals using the selected data only', () => {
    const comparison = buildSimpleSummaryComparison(records, ['2026-08', '2026-07'], ['Mobile Phone', 'False alert']);
    expect(comparison.months).toEqual(['2026-07', '2026-08']);
    expect(comparison.typeTotals).toEqual({ 'False alert': 1, 'Mobile Phone': 156 });
    expect(comparison.rows.map(({ total }) => total)).toEqual([139, 18]);
    expect(comparison.total).toBe(157);
  });

  it('treats empty selections as all and ignores unavailable selected values', () => {
    expect(buildSimpleSummaryComparison(records, [], [])).toEqual(buildSimpleSummaryComparison(records));
    const unknownType = buildSimpleSummaryComparison(records, undefined, ['Unavailable']);
    expect(unknownType.months).toHaveLength(3);
    expect(unknownType.alertTypes).toEqual([]);
    expect(unknownType.total).toBe(0);
    expect(buildSimpleSummaryComparison(records, ['Unavailable']).rows).toEqual([]);
  });

  it('sums unaggregated input and safely handles arbitrary alert labels including prototype keys', () => {
    const parsed = parseSimpleSummary(columns, [
      row('2026-06', '__proto__', 2), row('2026-06', 'constructor', 3),
      row('2026-07', 'toString', 0), row('2026-06', 'New/Unknown', 1),
    ]);
    expect(parsed.error).toBeNull();
    const comparison = buildSimpleSummaryComparison([
      ...parsed.records, { month: '2026-06', alertType: '__proto__', count: 4 },
    ]);
    expect(comparison.total).toBe(10);
    expect(Object.hasOwn(comparison.typeTotals, '__proto__')).toBe(true);
    expect(comparison.typeTotals.__proto__).toBe(6);
    expect(comparison.typeTotals.constructor).toBe(3);
    expect(comparison.rows[1]!.counts.__proto__).toBe(0);
    expect(comparison.rows[1]!.counts.toString).toBe(0);
    expect(Object.getPrototypeOf(comparison.typeTotals)).toBe(Object.prototype);
  });
});

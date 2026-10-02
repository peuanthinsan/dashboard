import { describe, expect, it } from 'vitest';
import { parseFuelSheet } from './fuelSheet';

const wrap = (data: unknown) => `google.visualization.Query.setResponse(${JSON.stringify(data)});`;
describe('fuel sheet response', () => {
  it('rejects GViz errors, HTML and missing required columns instead of showing zero', () => {
    expect(() => parseFuelSheet(wrap({ status: 'error' }))).toThrow();
    expect(() => parseFuelSheet('<html>Sign in</html>')).toThrow();
    expect(() => parseFuelSheet(wrap({ table: { cols: [{ label: 'Alert' }], rows: [] } }))).toThrow('Missing fuel columns');
  });
  it('retains zero, null and all fuel columns without applying alert exclusions', () => {
    const result = parseFuelSheet(wrap({ table: {
      cols: ['Vehicle No', 'Date Time', 'Total Fuel', 'Tank2 Fuel'].map((label) => ({ label })),
      rows: [{ c: [{ v: '700-2187' }, { v: 'Date(2026,8,24,14,8,7)', f: '24/09/2026 14:08:07' }, { v: 0 }, null] }],
    } }));
    expect(result.rows).toEqual([{ 'Vehicle No': '700-2187', 'Date Time': '24/09/2026 14:08:07', 'Total Fuel': 0, 'Tank2 Fuel': null }]);
  });
});

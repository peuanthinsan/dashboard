import { describe, it, expect } from 'vitest';
import { assignUniqueFieldKeys, parseGoogleSheetTable, parseGoogleSheetGvizText } from './googleSheetParse';

describe('Vinythai complete GViz responses', () => {
  it('rejects HTTP-200 error or missing-table bodies instead of returning empty totals', () => {
    for (const json of [{ status: 'error', errors: [{ reason: 'invalid_query' }] }, { status: 'ok' }, { table: { cols: [] } }]) {
      expect(() => parseGoogleSheetGvizText(`google.visualization.Query.setResponse(${JSON.stringify(json)});`)).toThrow('unsuccessful or incomplete');
    }
    expect(parseGoogleSheetGvizText('google.visualization.Query.setResponse({"status":"ok","table":{"cols":[],"rows":[]}});').rows).toEqual([]);
  });
});

describe('assignUniqueFieldKeys', () => {
  it('leaves unique labels unchanged', () => {
    expect(assignUniqueFieldKeys(['Date', 'Driver'])).toEqual(['Date', 'Driver']);
  });

  it('suffixes second and third duplicate labels', () => {
    expect(assignUniqueFieldKeys(['Date', 'Date', 'Date'])).toEqual(['Date', 'Date (2)', 'Date (3)']);
  });
});

describe('parseGoogleSheetTable', () => {
  it('uses distinct field keys for duplicate column labels so both values are kept', () => {
    const json = {
      table: {
        cols: [
          { label: 'Date', type: 'string' },
          { label: 'Date', type: 'string' },
        ],
        rows: [{ c: [{ v: 'first' }, { v: 'second' }] }],
      },
    };
    const { columns, rows } = parseGoogleSheetTable(json);
    expect(columns.map((c) => c.fieldKey)).toEqual(['Date', 'Date (2)']);
    expect(rows[0]).toEqual({ Date: 'first', 'Date (2)': 'second' });
  });
});

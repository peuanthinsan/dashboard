import { describe, it, expect } from 'vitest';
import { assignUniqueFieldKeys, parseGoogleSheetTable } from './googleSheetParse';

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

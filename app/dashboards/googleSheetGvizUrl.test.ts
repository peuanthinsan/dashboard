import { describe, it, expect } from 'vitest';
import { buildGvizJsonUrl, gvizColumnLetter } from './googleSheetGvizUrl';

describe('gvizColumnLetter', () => {
  it('maps zero-based indices to spreadsheet column references', () => {
    expect(gvizColumnLetter(0)).toBe('A');
    expect(gvizColumnLetter(3)).toBe('D');
    expect(gvizColumnLetter(25)).toBe('Z');
    expect(gvizColumnLetter(26)).toBe('AA');
    expect(gvizColumnLetter(27)).toBe('AB');
    expect(gvizColumnLetter(51)).toBe('AZ');
    expect(gvizColumnLetter(52)).toBe('BA');
  });
});

describe('buildGvizJsonUrl', () => {
  const SHEET = 'sheet1';
  const GID = '0';

  it('omits the tq clause when no row limit is given', () => {
    expect(buildGvizJsonUrl(SHEET, GID)).not.toContain('tq=');
  });

  it('orders by column A descending by default when recentFirst', () => {
    const url = buildGvizJsonUrl(SHEET, GID, 25_000, true);
    expect(decodeURIComponent(url)).toContain('select * order by A desc limit 25000');
  });

  it('orders by the given column when recentFirst (e.g. the timestamp column)', () => {
    const url = buildGvizJsonUrl(SHEET, GID, 25_000, true, 'D');
    expect(decodeURIComponent(url)).toContain('select * order by D desc limit 25000');
  });

  it('does not order (takes the first N) when recentFirst is false', () => {
    const url = buildGvizJsonUrl(SHEET, GID, 1, false);
    expect(decodeURIComponent(url)).toContain('select * limit 1');
    expect(decodeURIComponent(url)).not.toContain('order by');
  });
});

import { describe, it, expect } from 'vitest';
import {
  buildDatedRowsWhere,
  buildGvizJsonUrl,
  buildMonthListQuery,
  buildNonNullIdWhere,
  gvizColumnLetter,
  gvizDateLiteral,
  monthKeyToDateRange,
  splitDateRangeIntoChunks,
} from './googleSheetGvizUrl';

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

  it('omits the tq clause when no row limit / where / order is given', () => {
    expect(buildGvizJsonUrl(SHEET, GID)).not.toContain('tq=');
  });

  it('orders by column A descending by default when recentFirst (legacy positional args)', () => {
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

  it('accepts options object with where + recentFirst (poison-row filter)', () => {
    const url = buildGvizJsonUrl(SHEET, GID, {
      rowLimit: 25_000,
      recentFirst: true,
      orderColId: 'E',
      where: buildNonNullIdWhere('A'),
    });
    const tq = decodeURIComponent(url);
    expect(tq).toContain('where A is not null');
    expect(tq).toContain('order by E desc');
    expect(tq).toContain('limit 25000');
  });

  it('builds a dated range query without order', () => {
    const url = buildGvizJsonUrl(SHEET, GID, {
      rowLimit: 25_000,
      where: buildDatedRowsWhere('E', '2026-06-01', '2026-06-08'),
    });
    const tq = decodeURIComponent(url);
    expect(tq).toContain("where A is not null and E >= date '2026-06-01' and E < date '2026-06-08'");
    expect(tq).not.toContain('order by');
    expect(tq).toContain('limit 25000');
  });
});

describe('monthKeyToDateRange', () => {
  it('maps YYYY-MM to [first-of-month, first-of-next)', () => {
    expect(monthKeyToDateRange('2026-06')).toEqual({
      start: '2026-06-01',
      endExclusive: '2026-07-01',
    });
    expect(monthKeyToDateRange('2026-12')).toEqual({
      start: '2026-12-01',
      endExclusive: '2027-01-01',
    });
  });

  it('rejects invalid keys', () => {
    expect(monthKeyToDateRange('2026-13')).toBeNull();
    expect(monthKeyToDateRange('june')).toBeNull();
    expect(monthKeyToDateRange('')).toBeNull();
  });
});

describe('splitDateRangeIntoChunks', () => {
  it('splits a month into 7-day windows', () => {
    const chunks = splitDateRangeIntoChunks('2026-06-01', '2026-07-01', 7);
    expect(chunks).toEqual([
      { start: '2026-06-01', endExclusive: '2026-06-08' },
      { start: '2026-06-08', endExclusive: '2026-06-15' },
      { start: '2026-06-15', endExclusive: '2026-06-22' },
      { start: '2026-06-22', endExclusive: '2026-06-29' },
      { start: '2026-06-29', endExclusive: '2026-07-01' },
    ]);
  });

  it('returns empty for inverted or equal ranges', () => {
    expect(splitDateRangeIntoChunks('2026-07-01', '2026-06-01', 7)).toEqual([]);
    expect(splitDateRangeIntoChunks('2026-06-01', '2026-06-01', 7)).toEqual([]);
  });
});

describe('gviz helpers', () => {
  it('formats date literals', () => {
    expect(gvizDateLiteral('2026-04-01')).toBe("date '2026-04-01'");
  });

  it('builds the month-list aggregation query', () => {
    expect(buildMonthListQuery('E')).toBe(
      'select year(E), month(E), count(A) where A is not null group by year(E), month(E)',
    );
  });
});

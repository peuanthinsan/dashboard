import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  buildAlertColumnSelect,
  detectSheetDateColumn,
  fetchRecentSheetRows,
  fetchSheetDateRange,
  listSheetMonths,
  SheetDateColumnError,
} from './googleSheetFetch';
import type { GoogleSheetColumn } from './googleSheetParse';

function cols(...labels: string[]): GoogleSheetColumn[] {
  return labels.map((label) => ({ label, type: 'string', fieldKey: label }));
}

function gvizPayload(
  colDefs: Array<{ label: string; type: string }>,
  rows: unknown[][] = [],
): string {
  return `google.visualization.Query.setResponse(${JSON.stringify({
    table: {
      cols: colDefs,
      rows: rows.map((cells) => ({ c: cells.map((v) => ({ v })) })),
    },
  })});`;
}

/** Stub global fetch; returns the list of requested URLs for assertions. */
function stubFetch(payloads: string[]): string[] {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL) => {
      calls.push(String(url));
      const body = payloads[Math.min(calls.length - 1, payloads.length - 1)]!;
      return { ok: true, status: 200, text: async () => body } as Response;
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildAlertColumnSelect', () => {
  it('always keeps column A and matches alert labels case-insensitively', () => {
    const select = buildAlertColumnSelect(
      cols('id', 'Vehicle No', 'Driver Name', 'Alert Type', 'Alert Date Time', 'Speed', 'videoURL', 'Remarks', 'Fleet', 'noise'),
    );
    // A=id, B=Vehicle, C=Driver, D=Alert Type, E=Alert Date Time, F=Speed, G=videoURL(skipped), H=Remarks, I=Fleet
    expect(select).toBe('A,B,C,D,E,F,H,I');
    expect(select).not.toContain('G'); // videoURL omitted
  });

  it('falls back to * when only the id column is present', () => {
    expect(buildAlertColumnSelect(cols('id'))).toBe('*');
  });

  it('includes Track Time / Location aliases used by OverSpeed', () => {
    const select = buildAlertColumnSelect(
      cols('SlNo', 'Plate', 'Track Time', 'Location', 'Over Speed', 'User'),
    );
    expect(select).toBe('A,B,C,D,E,F');
  });

  it('keeps videoURL/Videoit when includeVideo is true (Detail needs video evidence)', () => {
    const select = buildAlertColumnSelect(
      cols('id', 'Vehicle No', 'Alert Type', 'videoURL', 'Videoit', 'noise'),
      { includeVideo: true },
    );
    // A=id, B=Vehicle, C=Alert Type, D=videoURL, E=Videoit
    expect(select).toBe('A,B,C,D,E');
  });
});

// Each test uses a unique sheetId: detectSheetDateColumn caches per sheet for 10 min.
describe('fetchRecentSheetRows', () => {
  it('requests FULL columns (no pruned select) so legacy templates keep their data', async () => {
    const header = [
      { label: 'SlNo', type: 'string' },
      { label: 'Driver Name', type: 'string' },
      { label: 'Date', type: 'datetime' },
      { label: 'WorkHrs duration', type: 'string' },
      { label: 'videoURL', type: 'string' },
    ];
    const calls = stubFetch([gvizPayload(header)]);
    await fetchRecentSheetRows('sheet-recent-full', '0');
    expect(calls).toHaveLength(2);
    const tq = decodeURIComponent(calls[1]!);
    expect(tq).toContain('select *');
    expect(tq).not.toContain('select A,');
    // Still ordered by the detected timestamp column (C), newest first.
    expect(tq).toContain('order by C desc');
    expect(tq).toContain('A is not null');
  });
});

describe('fetchSheetDateRange', () => {
  it('throws SheetDateColumnError instead of silently serving recent rows when no date column exists', async () => {
    const header = [
      { label: 'SlNo', type: 'string' },
      { label: 'Alert Date Time', type: 'string' }, // text-formatted, not date-typed
    ];
    stubFetch([gvizPayload(header)]);
    await expect(
      fetchSheetDateRange('sheet-no-date-col', '0', '2026-06-01', '2026-06-03'),
    ).rejects.toBeInstanceOf(SheetDateColumnError);
  });

  it('scopes by a date column even when it sits in column A', async () => {
    const header = [
      { label: 'Timestamp', type: 'datetime' },
      { label: 'Vehicle No', type: 'string' },
    ];
    const calls = stubFetch([gvizPayload(header)]);
    await fetchSheetDateRange('sheet-date-in-a', '0', '2026-06-01', '2026-06-03');
    expect(calls).toHaveLength(2);
    const tq = decodeURIComponent(calls[1]!);
    expect(tq).toContain("A >= date '2026-06-01'");
    expect(tq).toContain("A < date '2026-06-03'");
    expect(tq).not.toContain('order by');
  });

  it('omits videoURL from the pruned select by default', async () => {
    const header = [
      { label: 'id', type: 'string' },
      { label: 'Alert Date Time', type: 'datetime' },
      { label: 'videoURL', type: 'string' },
    ];
    const calls = stubFetch([gvizPayload(header)]);
    await fetchSheetDateRange('sheet-video-omitted', '0', '2026-06-01', '2026-06-03');
    const tq = decodeURIComponent(calls[1]!);
    expect(tq.match(/select ([A-Z,]+)/)?.[1]).toBe('A,B');
  });

  it('keeps videoURL in the pruned select when includeVideo is requested (Detail)', async () => {
    const header = [
      { label: 'id', type: 'string' },
      { label: 'Alert Date Time', type: 'datetime' },
      { label: 'videoURL', type: 'string' },
    ];
    const calls = stubFetch([gvizPayload(header)]);
    await fetchSheetDateRange('sheet-video-included', '0', '2026-06-01', '2026-06-03', undefined, {
      includeVideo: true,
    });
    const tq = decodeURIComponent(calls[1]!);
    expect(tq.match(/select ([A-Z,]+)/)?.[1]).toBe('A,B,C');
  });
});

describe('listSheetMonths', () => {
  it('lists months when the date column is column A', async () => {
    const header = [
      { label: 'Timestamp', type: 'datetime' },
      { label: 'Vehicle No', type: 'string' },
    ];
    const monthsPayload = gvizPayload(
      [
        { label: 'year(Timestamp)', type: 'number' },
        { label: 'month(Timestamp)', type: 'number' },
        { label: 'count(Timestamp)', type: 'number' },
      ],
      [
        [2026, 4, 120], // GViz month() is 0-based → May
        [2026, 5, 80], // June
      ],
    );
    const calls = stubFetch([gvizPayload(header), monthsPayload]);
    const months = await listSheetMonths('sheet-months-in-a', '0', new Date('2026-07-21T05:00:00Z'));
    expect(calls).toHaveLength(2);
    expect(months.map((m) => m.key)).toEqual(['2026-06', '2026-05']);
    expect(months.find((m) => m.key === '2026-05')?.count).toBe(120);
  });

  it('drops months after the current Bangkok calendar month', async () => {
    const header = [{ label: 'Alert Date Time', type: 'datetime' }];
    const monthsPayload = gvizPayload(
      [
        { label: 'year(Alert Date Time)', type: 'number' },
        { label: 'month(Alert Date Time)', type: 'number' },
        { label: 'count(id)', type: 'number' },
      ],
      [
        [2026, 6, 2637], // July
        [2026, 10, 4], // November poison
      ],
    );
    stubFetch([gvizPayload(header), monthsPayload]);
    const months = await listSheetMonths('sheet-poison-future', '0', new Date('2026-07-21T05:00:00Z'));
    expect(months.map((m) => m.key)).toEqual(['2026-07']);
  });

  it('returns no months when the sheet has no date-typed column', async () => {
    stubFetch([gvizPayload([{ label: 'SlNo', type: 'string' }])]);
    const months = await listSheetMonths('sheet-months-none', '0');
    expect(months).toEqual([]);
  });
});

describe('detectSheetDateColumn', () => {
  it('distinguishes "date column at A" from "no date column"', async () => {
    stubFetch([gvizPayload([{ label: 'Timestamp', type: 'datetime' }])]);
    const withDate = await detectSheetDateColumn('sheet-detect-a', '0');
    expect(withDate).toMatchObject({ orderColId: 'A', hasDateColumn: true });
    vi.unstubAllGlobals();

    stubFetch([gvizPayload([{ label: 'SlNo', type: 'string' }])]);
    const withoutDate = await detectSheetDateColumn('sheet-detect-none', '0');
    expect(withoutDate).toMatchObject({ orderColId: 'A', hasDateColumn: false });
  });
});

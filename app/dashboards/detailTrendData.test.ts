import { describe, expect, it } from 'vitest';
import {
  buildDailyTrendData,
  buildMonthlyTrendData,
  filterTrendAlerts,
  getTrendMonthOptions,
  resolveSelectedTrendMonths,
  toggleTrendMonthFilter,
  type TrendMonthOption,
} from './detailTrendData';

type TestAlert = {
  id: string;
  parsedDate: Date | null;
  monthKey: string | null;
  remarks: string;
};

const alert = (id: string, timestamp: string | null, remarks = 'Fatigue'): TestAlert => {
  const parsedDate = timestamp === null ? null : new Date(timestamp);
  return {
    id,
    parsedDate,
    monthKey: parsedDate && Number.isFinite(parsedDate.getTime())
      ? `${parsedDate.getUTCFullYear()}-${String(parsedDate.getUTCMonth() + 1).padStart(2, '0')}`
      : null,
    remarks,
  };
};

const option = (key: string, label: string): TrendMonthOption => ({
  key,
  label,
  color: '#000000',
});

const consecutiveMonthKeys = (startYear: number, startMonth: number, count: number): string[] =>
  Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(startYear, startMonth - 1 + index, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  });

describe('filterTrendAlerts', () => {
  it('uses the existing normalized, bidirectional remark match semantics', () => {
    const rows = [
      alert('mobile', '2026-07-01T08:00:00Z', ' Mobile Phone '),
      alert('short', '2026-07-02T08:00:00Z', 'Phone'),
      alert('fatigue', '2026-07-03T08:00:00Z', 'Fatigue'),
    ];

    expect(filterTrendAlerts(rows, 'phone').map((row) => row.id)).toEqual([
      'mobile',
      'short',
    ]);
    expect(filterTrendAlerts(rows, 'MOBILE PHONE').map((row) => row.id)).toEqual([
      'mobile',
      'short',
    ]);
    expect(filterTrendAlerts(rows, 'all')).toEqual(rows);
  });
});

describe('buildDailyTrendData', () => {
  it('preserves the existing labels and returns chronological daily counts', () => {
    const rows = [
      alert('late-a', '2026-07-03T20:00:00Z'),
      alert('missing', null),
      alert('early', '2026-07-01T23:59:00Z'),
      alert('late-b', '2026-07-03T01:00:00Z'),
    ];

    expect(buildDailyTrendData(rows)).toEqual([
      { label: '01/07/2026', value: 1 },
      { label: '03/07/2026', value: 2 },
    ]);
  });
});

describe('getTrendMonthOptions', () => {
  it('deduplicates and orders valid in-scope months with deterministic labels', () => {
    const rows = [
      { monthKey: '2026-08' },
      { monthKey: '2026-07' },
      { monthKey: '2026-08' },
      { monthKey: '2026-13' },
      { monthKey: null },
    ];

    const en = getTrendMonthOptions(rows, 'en');
    const th = getTrendMonthOptions(rows, 'th');

    expect(en.map(({ key, label }) => ({ key, label }))).toEqual([
      { key: '2026-07', label: 'Jul 2026' },
      { key: '2026-08', label: 'Aug 2026' },
    ]);
    expect(th.map(({ key, label }) => ({ key, label }))).toEqual([
      { key: '2026-07', label: 'ก.ค. 2026' },
      { key: '2026-08', label: 'ส.ค. 2026' },
    ]);
    expect(th.map((month) => month.color)).toEqual(en.map((month) => month.color));
  });

  it('assigns 24 unique colors to every rolling 24-month window and stays stable', () => {
    const firstWindow = consecutiveMonthKeys(2025, 1, 24);
    const shiftedWindow = consecutiveMonthKeys(2025, 2, 24);
    const first = getTrendMonthOptions(firstWindow.map((monthKey) => ({ monthKey })), 'en');
    const shifted = getTrendMonthOptions(
      shiftedWindow.slice().reverse().map((monthKey) => ({ monthKey })),
      'th',
    );

    expect(new Set(first.map((month) => month.color))).toHaveLength(24);
    expect(new Set(shifted.map((month) => month.color))).toHaveLength(24);

    const firstColors = new Map(first.map((month) => [month.key, month.color]));
    shifted.forEach((month) => {
      if (firstColors.has(month.key)) {
        expect(month.color).toBe(firstColors.get(month.key));
      }
    });
  });
});

describe('month selection helpers', () => {
  const options = [
    option('2026-07', 'Jul 2026'),
    option('2026-08', 'Aug 2026'),
    option('2026-09', 'Sep 2026'),
  ];

  it('preserves option order and falls back to all for empty or stale selections', () => {
    expect(resolveSelectedTrendMonths(options, ['2026-09', '2026-07']).map((item) => item.key))
      .toEqual(['2026-07', '2026-09']);
    expect(resolveSelectedTrendMonths(options, ['stale']).map((item) => item.key))
      .toEqual(['2026-07', '2026-08', '2026-09']);
    expect(resolveSelectedTrendMonths(options, []).map((item) => item.key))
      .toEqual(['2026-07', '2026-08', '2026-09']);
  });

  it('toggles in stable available-month order and uses empty state for all months', () => {
    const keys = options.map((item) => item.key);

    expect(toggleTrendMonthFilter(keys, [], '2026-08')).toEqual(['2026-07', '2026-09']);
    expect(toggleTrendMonthFilter(keys, ['2026-09', '2026-07'], '2026-08')).toEqual([]);
    expect(toggleTrendMonthFilter(keys, ['2026-07'], '2026-07')).toEqual([]);
    expect(toggleTrendMonthFilter(keys, ['2026-09', 'stale'], 'unknown')).toEqual(['2026-09']);
  });
});

describe('buildMonthlyTrendData', () => {
  const months = [
    option('2026-07', 'Jul 2026'),
    option('2026-08', 'Aug 2026'),
  ];

  it('aligns the same day across months, zero-fills gaps, and preserves series order', () => {
    const data = buildMonthlyTrendData([
      alert('jul-1a', '2026-07-01T08:00:00Z'),
      alert('jul-1b', '2026-07-01T09:00:00Z'),
      alert('jul-2', '2026-07-02T08:00:00Z'),
      alert('aug-1', '2026-08-01T08:00:00Z'),
      alert('aug-3', '2026-08-03T08:00:00Z'),
    ], months);

    expect(data).toEqual([
      { label: '01', values: { 'Jul 2026': 2, 'Aug 2026': 1 } },
      { label: '02', values: { 'Jul 2026': 1, 'Aug 2026': 0 } },
      { label: '03', values: { 'Jul 2026': 0, 'Aug 2026': 1 } },
    ]);
    data.forEach((datum) => {
      expect(Object.keys(datum.values)).toEqual(['Jul 2026', 'Aug 2026']);
    });
  });

  it('marks invalid February dates as NaN instead of false zeroes', () => {
    const leapYearMonths = [
      option('2024-02', 'Feb 2024'),
      option('2024-03', 'Mar 2024'),
    ];
    const data = buildMonthlyTrendData([], leapYearMonths, {
      start: '2024-02-01T00:00',
      end: '2024-03-31T23:59',
    });

    expect(data).toHaveLength(31);
    expect(data.find((datum) => datum.label === '29')?.values).toEqual({
      'Feb 2024': 0,
      'Mar 2024': 0,
    });
    expect(data.find((datum) => datum.label === '30')?.values).toEqual({
      'Feb 2024': Number.NaN,
      'Mar 2024': 0,
    });
    expect(data.find((datum) => datum.label === '31')?.values).toEqual({
      'Feb 2024': Number.NaN,
      'Mar 2024': 0,
    });
  });

  it('uses partial-range eligibility, omits all-NaN days, and counts only in-range alerts', () => {
    const partialMonths = [
      option('2026-01', 'Jan 2026'),
      option('2026-02', 'Feb 2026'),
    ];
    const data = buildMonthlyTrendData([
      alert('before-start', '2026-01-15T08:00:00Z'),
      alert('after-start', '2026-01-15T13:00:00Z'),
      alert('on-end', '2026-02-10T10:00:00Z'),
      alert('after-end', '2026-02-10T11:00:00Z'),
    ], partialMonths, {
      start: '2026-01-15T12:00',
      end: '2026-02-10T10:30',
    });

    expect(data.map((datum) => datum.label)).toEqual([
      '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
      '15', '16', '17', '18', '19', '20', '21', '22', '23', '24',
      '25', '26', '27', '28', '29', '30', '31',
    ]);
    expect(data.find((datum) => datum.label === '10')?.values).toEqual({
      'Jan 2026': Number.NaN,
      'Feb 2026': 1,
    });
    expect(data.find((datum) => datum.label === '15')?.values).toEqual({
      'Jan 2026': 1,
      'Feb 2026': Number.NaN,
    });
    expect(data.some((datum) => datum.label === '11')).toBe(false);
    data.forEach((datum) => {
      expect(Object.keys(datum.values)).toEqual(['Jan 2026', 'Feb 2026']);
    });
  });
});

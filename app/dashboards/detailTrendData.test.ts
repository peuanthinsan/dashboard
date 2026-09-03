import { describe, expect, it } from 'vitest';
import {
  buildMonthlyTrendTotals,
  filterTrendAlerts,
  getTrendMonthOptions,
  getTrendMonthOptionsForRange,
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
  });
});

describe('getTrendMonthOptionsForRange', () => {
  it('includes every calendar month touched by the active range, even partial or empty months', () => {
    expect(getTrendMonthOptionsForRange({
      start: '2026-03-31T23:30',
      end: '2026-06-01T00:15',
    }, 'en')).toEqual([
      option('2026-03', 'Mar 2026'),
      option('2026-04', 'Apr 2026'),
      option('2026-05', 'May 2026'),
      option('2026-06', 'Jun 2026'),
    ]);
  });

  it('orders the selected range across year boundaries and localizes labels', () => {
    expect(getTrendMonthOptionsForRange({
      start: '2026-11-10T00:00',
      end: '2027-02-20T23:59',
    }, 'th')).toEqual([
      option('2026-11', 'พ.ย. 2026'),
      option('2026-12', 'ธ.ค. 2026'),
      option('2027-01', 'ม.ค. 2027'),
      option('2027-02', 'ก.พ. 2027'),
    ]);
  });

  it('returns no month options for an incomplete or invalid range', () => {
    expect(getTrendMonthOptionsForRange({ start: '', end: '' }, 'en')).toEqual([]);
    expect(getTrendMonthOptionsForRange({
      start: '2026-06-02T00:00',
      end: '2026-06-01T23:59',
    }, 'en')).toEqual([]);
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

describe('buildMonthlyTrendTotals', () => {
  it('sums all in-scope alerts into one chronological bar per selected month', () => {
    const months = [
      option('2027-01', 'Jan 2027'),
      option('2026-12', 'Dec 2026'),
      option('2026-11', 'Nov 2026'),
    ];

    expect(buildMonthlyTrendTotals([
      alert('dec-early', '2026-12-01T08:00:00Z'),
      alert('dec-late', '2026-12-30T21:00:00Z'),
      alert('jan', '2027-01-14T08:00:00Z'),
      alert('unselected', '2026-10-14T08:00:00Z'),
      alert('missing', null),
      { ...alert('malformed', '2026-12-12T08:00:00Z'), monthKey: '2026-99' },
    ], months)).toEqual([
      { label: 'Nov 2026', value: 0 },
      { label: 'Dec 2026', value: 2 },
      { label: 'Jan 2027', value: 1 },
    ]);
  });

  it('returns no bars when no months are selected', () => {
    expect(buildMonthlyTrendTotals([
      alert('jan', '2027-01-14T08:00:00Z'),
    ], [])).toEqual([]);
  });
});

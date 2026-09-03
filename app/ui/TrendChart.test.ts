import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import TrendChart, { type MultiTrendDatum } from './TrendChart';

describe('TrendChart monthly comparison accessibility', () => {
  it('renders one same-color bar per month with clean ticks and no series legend', () => {
    const totals = [0, 2, 0, 5, 4, 28, 12, 0, 7, 0, 3, 6];
    const labels = [
      'Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026',
      'Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026',
      'Oct 2026', 'Nov 2026', 'Dec 2026', 'Jan 2027',
    ];
    const data = labels.map((label, index) => ({ label, value: totals[index] }));

    const markup = renderToStaticMarkup(createElement(TrendChart, {
      data,
      mode: 'bar',
      colors: ['#EF4444'],
      ariaLabel: 'Monthly alert totals: Feb 2026 through Jan 2027',
      singleSeriesLabel: 'Alerts',
      maxXAxisLabels: labels.length,
      yAxisTickCount: 3,
      wholeNumberYAxis: true,
      barCategoryPadding: 0.24,
      maxBarWidth: 72,
      minCategoryWidth: 96,
      preserveCategoryScale: true,
    }));

    expect(markup.match(/<rect[^>]*fill="#EF4444"/g)).toHaveLength(12);
    labels.forEach((label) => expect(markup).toContain(`>${label}</text>`));
    ['30', '20', '10', '0'].forEach((tick) => expect(markup).toContain(`>${tick}</text>`));
    ['23', '15', '8'].forEach((tick) => expect(markup).not.toContain(`>${tick}</text>`));
    expect(markup).not.toContain('gap-x-5');
    expect(markup).toContain('<th scope="col">Alerts</th>');
    expect(markup).toContain('width:1152px');
  });

  it('keeps low count axes distinct and small month selections readable', () => {
    const oneAlert = renderToStaticMarkup(createElement(TrendChart, {
      data: [{ label: 'Feb 2026', value: 1 }],
      mode: 'bar',
      yAxisTickCount: 3,
      wholeNumberYAxis: true,
      minCategoryWidth: 96,
      preserveCategoryScale: true,
    }));
    const sevenAlerts = renderToStaticMarkup(createElement(TrendChart, {
      data: [{ label: 'Feb 2026', value: 7 }],
      mode: 'bar',
      yAxisTickCount: 3,
      wholeNumberYAxis: true,
      minCategoryWidth: 96,
      preserveCategoryScale: true,
    }));

    expect(oneAlert.match(/>1<\/text>/g)).toHaveLength(1);
    expect(oneAlert.match(/>0<\/text>/g)).toHaveLength(1);
    expect(oneAlert).toContain('viewBox="0 0 360 300"');
    expect(oneAlert).toContain('width:360px');
    ['10', '5', '0'].forEach((tick) => expect(sevenAlerts).toContain(`>${tick}</text>`));
    ['7', '3'].forEach((tick) => expect(sevenAlerts).not.toContain(`>${tick}</text>`));
  });

  it('omits ineligible values from SVG geometry and exposes the data as a table', () => {
    const data: MultiTrendDatum[] = [
      { label: '30', values: { 'Feb 2026': Number.NaN, 'Mar 2026': 4 } },
      { label: '31', values: { 'Feb 2026': Number.NaN, 'Mar 2026': 0 } },
    ];

    const markup = renderToStaticMarkup(createElement(TrendChart, {
      data,
      mode: 'bar',
      ariaLabel: 'Daily alert comparison by month: Feb 2026, Mar 2026',
      colors: ['#457B9D', '#2A9D8F'],
    }));

    expect(markup).not.toContain('NaN');
    expect(markup).toContain('<div class="sr-only"><table>');
    expect(markup).toContain('<caption>Daily alert comparison by month: Feb 2026, Mar 2026</caption>');
    expect(markup).toContain('<th scope="col">Feb 2026</th>');
    expect(markup).toContain('<th scope="row">30</th>');
    expect(markup).toContain('<td>—</td><td>4</td>');
  });
});

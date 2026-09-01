import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import TrendChart, { type MultiTrendDatum } from './TrendChart';

describe('TrendChart monthly comparison accessibility', () => {
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
    expect(markup).toContain('<table class="sr-only">');
    expect(markup).toContain('<caption>Daily alert comparison by month: Feb 2026, Mar 2026</caption>');
    expect(markup).toContain('<th scope="col">Feb 2026</th>');
    expect(markup).toContain('<th scope="row">30</th>');
    expect(markup).toContain('<td>—</td><td>4</td>');
  });
});

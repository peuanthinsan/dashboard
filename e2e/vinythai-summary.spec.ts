import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
import { columns, monthKeys, rows } from './fixtures/vinythai-summary';

function gviz(records: typeof rows) {
  return `google.visualization.Query.setResponse(${JSON.stringify({ table: { cols: columns, rows: records.map((record) => ({ c: columns.map((column) => ({ v: record[column.label] ?? null })) })) } })});`;
}

test('Vinythai summary loads complete fleet data and filters/export reconcile', async ({ page }) => {
  const queries: string[] = [];
  await page.route('**/api/sheets/vinythai-test-sheet/0*', async (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('trackFallback')).toBe('1');
    if (url.searchParams.get('mode') !== 'months') throw new Error('Unexpected recent-window fallback');
    await route.fulfill({ json: { months: monthKeys.map((key) => ({ key, label: key, count: 105 })) } });
  });
  await page.route('https://docs.google.com/spreadsheets/d/vinythai-test-sheet/**', async (route) => {
    const query = new URL(route.request().url()).searchParams.get('tq') ?? '';
    queries.push(query);
    const dates = Array.from(query.matchAll(/date '([^']+)'/g), (match) => match[1]!);
    const records = dates.length ? rows.filter((r) => {
      const day = String(r['Alert Date Time'] || r['Track Time']).slice(0, 10);
      return day >= dates[0]! && day < dates[1]!;
    }) : rows.slice(0, 1);
    await route.fulfill({ contentType: 'application/javascript', body: gviz(records) });
  });
  await page.goto('/e2e-fixtures/vinythai-summary?mode=fetch');
  await expect(page.getByTestId('vinythai-total')).toHaveText('421');
  await expect(page.getByTestId('vinythai-vehicles')).toHaveText('27');
  await expect(page.getByRole('option', { name: 'OUTSIDE', exact: true })).toHaveCount(0);
  expect(queries.some((query) => query.includes('G is null and H >='))).toBe(true);
  expect(queries.some((query) => query.startsWith('select * where'))).toBe(true);

  await page.getByRole('combobox', { name: 'Alert type', exact: true }).selectOption('remark:mobile phone');
  await expect(page.getByTestId('vinythai-total')).toHaveText('281');
  await page.getByRole('combobox', { name: 'Customer', exact: true }).selectOption('Fusion Vinythai');
  await expect(page.getByTestId('vinythai-total')).toHaveText('57');
  await page.getByRole('combobox', { name: 'Month', exact: true }).selectOption('2026-07');
  await expect(page.getByTestId('vinythai-total')).toHaveText('15');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Excel', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Vinythai_Monthly_Summary_2026-07.xlsx');
  const archive = unzipSync(await readFile((await download.path())!));
  const detailXml = strFromU8(archive['xl/worksheets/sheet1.xml']!);
  expect(detailXml.match(/<row\b/g)).toHaveLength(16); // 15 filtered events + header
  expect(detailXml).not.toContain('OUTSIDE');

  await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
  await expect(page.getByTestId('vinythai-total')).toHaveText('421');
  await page.getByRole('button', { name: 'June 2026: 105', exact: true }).click();
  await expect(page.getByTestId('vinythai-total')).toHaveText('105');
  await page.getByRole('button', { name: 'Fusion Vinythai', exact: true }).click();
  await expect(page.getByTestId('vinythai-total')).toHaveText('84');
});

test('Vinythai summary refuses a failed catalog instead of presenting capped recent totals', async ({ page }) => {
  const recentCalls: string[] = [];
  await page.route('**/api/sheets/vinythai-test-sheet/0*', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('mode') !== 'months') recentCalls.push(url.href);
    await route.fulfill({ status: 503, json: { error: 'Catalog unavailable' } });
  });
  await page.goto('/e2e-fixtures/vinythai-summary?mode=fetch');
  await expect(page.getByRole('alert').filter({ hasText: 'Unable to load complete monthly data' })).toBeVisible();
  await expect(page.getByTestId('vinythai-total')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Download Excel' })).toBeDisabled();
  expect(recentCalls).toEqual([]);
});

test('Vinythai summary refuses truncated proxy chunks', async ({ page }) => {
  await page.route('**/api/sheets/vinythai-test-sheet/0*', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({ json: url.searchParams.get('mode') === 'months'
      ? { months: [{ key: '2026-07', label: 'July', count: 40_000 }] }
      : { columns, rows: rows.slice(0, 5), truncated: true } });
  });
  await page.route('https://docs.google.com/spreadsheets/d/vinythai-test-sheet/**', (route) => route.abort());
  await page.goto('/e2e-fixtures/vinythai-summary?mode=fetch');
  await expect(page.getByRole('alert').filter({ hasText: 'truncated' })).toBeVisible();
  await expect(page.getByTestId('vinythai-total')).toHaveCount(0);
});

test('Vinythai summary preview hydrates without rendering errors and fits a mobile viewport', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/e2e-fixtures/vinythai-summary');
  await page.getByRole('combobox', { name: 'ประเภทแจ้งเตือน', exact: true }).selectOption('remark:mobile phone');
  await expect(page.getByTestId('vinythai-total')).toHaveText('281');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'ดาวน์โหลด Excel' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('Vinythai summary refuses HTTP-200 GViz errors and unsuccessful proxy fallback', async ({ page }) => {
  await page.route('**/api/sheets/vinythai-test-sheet/0*', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill(url.searchParams.get('mode') === 'months'
      ? { json: { months: [{ key: '2026-07', label: 'July', count: 105 }] } }
      : { status: 502, json: { error: 'Google query failed' } });
  });
  await page.route('https://docs.google.com/spreadsheets/d/vinythai-test-sheet/**', async (route) => {
    const query = new URL(route.request().url()).searchParams.get('tq') ?? '';
    await route.fulfill({ contentType: 'application/javascript', body: query.includes('limit 1')
      ? gviz(rows.slice(0, 1))
      : 'google.visualization.Query.setResponse({"status":"error","errors":[{"reason":"invalid_query"}]});' });
  });
  await page.goto('/e2e-fixtures/vinythai-summary?mode=fetch');
  await expect(page.getByRole('alert').filter({ hasText: 'Unable to load complete monthly data' })).toBeVisible();
  await expect(page.getByTestId('vinythai-total')).toHaveCount(0);
});

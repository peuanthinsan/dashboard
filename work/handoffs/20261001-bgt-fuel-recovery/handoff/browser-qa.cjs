'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium, expect: baseExpect } = require('/Users/peuan/songdee-dashboard/node_modules/@playwright/test');
const expect = baseExpect.configure({ timeout: 10000 });
const previewUrl = process.env.BGT_QA_URL || 'http://127.0.0.1:3107/e2e-fixtures/bgt-fuel';
const sourcePath = '/private/tmp/bgt-fuel-source.gviz';
const sheetId = '1N75-uh50HSPkaEv4JXItrwRLsCHOkG0qxd9GHkl3XjA';
const sourcePayload = fs.readFileSync(sourcePath, 'utf8');
const source = JSON.parse(sourcePayload.match(/setResponse\(([\s\S]*)\);/)[1]);
assert.equal(source.table.rows.length, 1452, 'Use the reviewed real 1,452-row source snapshot.');
function parseCsv(text) {
  const rows = []; let row = [], field = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted;
    } else if (c === ',' && !quoted) { row.push(field); field = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  assert.equal(quoted, false, 'CSV quoting must balance.');
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => v !== ''));
}
async function exportCsv(page, name) {
  await page.getByRole('button', { name, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Configure CSV export' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Select all', exact: true }).click();
  await dialog.getByLabel('Date & time format', { exact: true }).selectOption('as_is');
  const pending = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download CSV', exact: true }).click();
  const download = await pending;
  assert.match(download.suggestedFilename(), /\.csv$/i);
  assert.equal(await download.failure(), null);
  const stream = await download.createReadStream(); assert.ok(stream);
  const chunks = []; for await (const chunk of stream) chunks.push(chunk);
  await expect(dialog).toBeHidden();
  return parseCsv(Buffer.concat(chunks).toString('utf8'));
}
function checkCsv(rows, count, total, minimum) {
  const [headers, ...records] = rows;
  assert.equal(records.length, count, 'CSV count must respect current filters.');
  const keys = headers.map(v => v.replace(/[^a-z0-9]/gi, '').toLowerCase());
  const get = (row, key) => { const i = keys.indexOf(key.toLowerCase()); assert.notEqual(i, -1, `CSV includes ${key}`); return row[i]; };
  let sum = 0;
  for (const row of records) {
    assert.equal(row.length, headers.length);
    assert.equal(get(row, 'vehicle'), '700-2187');
    assert.equal(get(row, 'units'), 'source units');
    assert.equal(Number(get(row, 'minimumIncrease')), minimum);
    assert.equal(Number(get(row, 'maxGapMinutes')), 10);
    assert.match(get(row, 'classification'), /unconfirmed/);
    const delta = Number(get(row, 'increase'));
    assert.ok(Number.isFinite(delta) && delta >= minimum - 1e-9);
    assert.ok(Math.abs(Number(get(row, 'afterFuel')) - Number(get(row, 'beforeFuel')) - delta) < 1e-9);
    sum += delta;
  }
  assert.equal(Number(sum.toFixed(2)), total, 'CSV sum must match the displayed KPI.');
}
async function run() {
  let browser, page, phase = 'startup', sourceMode = 'snapshot', sourceRequests = 0;
  const errors = [], checks = [];
  const observe = p => {
    p.on('pageerror', e => errors.push({ phase, type: 'pageerror', message: e.message }));
    p.on('console', m => { if (m.type() === 'error') errors.push({ phase, type: 'console', message: m.text() }); });
  };
  try {
    browser = await chromium.launch({ headless: true, args: ['--single-process', '--no-zygote', '--disable-gpu'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
    context.setDefaultTimeout(15000);
    // Intercept only the real configured source; use captured telemetry, not synthetic success data.
    await context.route('https://docs.google.com/spreadsheets/**', async route => {
      try {
        const url = new URL(route.request().url());
        assert.equal(url.pathname, `/spreadsheets/d/${sheetId}/gviz/tq`);
        assert.equal(url.searchParams.get('gid'), '0');
        assert.equal(url.searchParams.get('headers'), '1');
        sourceRequests++;
        await route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8',
          headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
          body: sourceMode === 'snapshot' ? sourcePayload : 'google.visualization.Query.setResponse({"status":"error","errors":[{"reason":"access_denied"}]});' });
      } catch (e) { errors.push({ phase, type: 'source-route', message: e.message }); await route.abort(); }
    });
    page = await context.newPage(); observe(page);
    const input = name => name === 'Vehicle' || name === 'Fuel unit'
      ? page.getByRole('combobox', { name: new RegExp(`^${name}(?:\\s|$)`) })
      : page.getByLabel(name, { exact: true });
    const button = name => page.getByRole('button', { name, exact: true });
    const kpi = async name => {
      const text = await page.getByRole('region', { name, exact: true }).locator('p').nth(1).innerText();
      const match = text.trim().match(/^(—|[\d,.]+)/); assert.ok(match, `${name}: ${text}`);
      return match[1] === '—' ? null : Number(match[1].replaceAll(',', ''));
    };
    const summary = async () => ({ total: await kpi('Detected increase total'), count: await kpi('Detected increases'),
      readings: await kpi('Fuel readings'), stationary: await kpi('Stationary increases'),
      lines: await page.locator('[data-fuel-line]').count(), marks: await page.locator('[data-fuel-increase]').count() });
    const verify = async (name, expected) => { phase = name; await expect.poll(summary, { message: name }).toEqual(expected); checks.push({ name, ...expected }); };
    const baseline = { total: 102.54, count: 13, readings: 1452, stationary: 0, lines: 1, marks: 13 };
    const empty = { total: null, count: null, readings: 0, stationary: null, lines: 0, marks: 0 };
    const reset = async () => {
      await button('Reset filters').click();
      for (const name of ['Vehicle', 'From · Bangkok time', 'To · Bangkok time']) await expect(input(name)).toHaveValue('');
      await expect(input('Minimum increase')).toHaveValue('5');
      await expect(input('Fuel unit')).toHaveValue('source');
    };
    phase = 'initial-load';
    const response = await page.goto(previewUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    assert.equal(response.status(), 200, 'Local preview must be enabled.');
    await page.getByRole('region', { name: 'Fuel readings', exact: true }).waitFor({ timeout: 60000 });
    await verify('default-source-values', baseline);
    assert.ok(sourceRequests > 0, 'Dashboard must use its sheet loader.');
    await expect(page.getByRole('heading', { name: 'BGT fuel dashboard', exact: true })).toBeVisible();
    const paths = await page.locator('[data-fuel-line]').evaluateAll(nodes => nodes.map(n => n.getAttribute('d')));
    assert.ok(paths.every(p => p && !/NaN|Infinity/.test(p)), 'Chart geometry must be finite.');
    await page.screenshot({ path: '/private/tmp/bgt-fuel-desktop.png', fullPage: true, animations: 'disabled' });
    await page.screenshot({ path: '/private/tmp/bgt-fuel-dashboard-preview.png', fullPage: false, animations: 'disabled' });
    phase = 'default-export'; checkCsv(await exportCsv(page, 'Export increases'), 13, 102.54, 5); checks.push({ name: phase, rows: 13 });
    await input('Minimum increase').fill('10');
    await verify('threshold-10', { ...baseline, total: 36.21, count: 3, marks: 3 });
    phase = 'filtered-export'; checkCsv(await exportCsv(page, 'Export increases'), 3, 36.21, 10); checks.push({ name: phase, rows: 3 });
    await input('Minimum increase').fill('20');
    await verify('threshold-20-valid-zero', { ...baseline, total: 0, count: 0, marks: 0 });
    await expect(button('Export increases')).toBeDisabled();
    await reset(); await input('Vehicle').selectOption('700-2187'); await verify('specific-vehicle', baseline);
    await input('Vehicle').selectOption(''); await expect(input('Vehicle')).toHaveValue(''); await verify('all-vehicles-restored', baseline);
    await input('From · Bangkok time').fill('2026-09-24T14:00');
    await verify('from-1400', { total: 78.32, count: 10, readings: 126, stationary: 0, lines: 1, marks: 10 });
    await input('To · Bangkok time').fill('2026-09-24T14:30');
    await verify('1400-to-1430', { total: 71.58, count: 9, readings: 78, stationary: 0, lines: 1, marks: 9 });
    await reset(); await verify('reset-restores-source', baseline);
    phase = 'marker-selection';
    const marker = page.locator('g[role="button"]').first();
    await expect(marker).toHaveAttribute('aria-label', /700-2187.*24\/09\/2026.*13:38:54.*\+6\.53/);
    await marker.press('Enter'); await expect(marker).toHaveAttribute('aria-pressed', 'true');
    await expect(button('Clear selection').locator('..')).toContainText('700-2187 · +6.53 source units');
    await expect(button('Clear selection').locator('..')).toContainText('9.05 → 15.58');
    await button('Clear selection').click(); await expect(marker).toHaveAttribute('aria-pressed', 'false');
    await expect(button('Clear selection')).toHaveCount(0); checks.push({ name: phase, amount: 6.53 });
    phase = 'source-table-and-export';
    const notes = page.getByText('Source readings & calculation notes', { exact: true }); await notes.click();
    const table = page.getByRole('table', { name: 'Source fuel readings', exact: true });
    await expect(table).toBeVisible(); await expect(table.locator('tbody tr')).toHaveCount(15);
    const csv = await exportCsv(page, 'Export filtered readings'); assert.equal(csv.length - 1, 1452); assert.ok(csv[0].includes('Total Fuel'));
    await notes.click(); await expect(table).toBeHidden(); checks.push({ name: phase, exportedReadings: 1452 });
    phase = 'mobile-layout'; await page.setViewportSize({ width: 390, height: 844 });
    const size = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    assert.ok(size.document <= size.viewport + 1, `No page overflow: ${JSON.stringify(size)}`);
    const chartRegion = page.getByRole('region', { name: 'Fuel level over time', exact: true });
    const chart = await chartRegion.evaluate(n => ({ visible: n.clientWidth, content: n.scrollWidth }));
    const svgBox = await chartRegion.locator('svg').boundingBox();
    assert.ok(svgBox && chart.visible > 0 && svgBox.width <= chart.visible + 1, 'Mobile chart must fit its container so late event markers remain visible.');
    const markerBounds = await page.locator('[data-fuel-increase]').evaluateAll(nodes => nodes.map(node => {
      const marker = node.getBoundingClientRect();
      const container = node.closest('[role="region"]').getBoundingClientRect();
      return { x: marker.x, right: marker.right, containerLeft: container.left, containerRight: container.right };
    }));
    assert.equal(markerBounds.length, 13, 'Every default increase is rendered on mobile.');
    assert.ok(markerBounds.every(m => m.x >= m.containerLeft - 1 && m.right <= m.containerRight + 1), 'Every mobile increase marker must fit inside its chart container.');
    await verify('mobile-default-values', baseline);
    await page.screenshot({ path: '/private/tmp/bgt-fuel-mobile.png', fullPage: true, animations: 'disabled' }); checks.push({ name: 'mobile-layout', ...size });
    await input('From · Bangkok time').fill('2026-10-01T00:00'); await verify('empty-period-unavailable', empty);
    await expect(button('Export increases')).toBeDisabled();
    await expect(page.getByText('Not enough consecutive valid readings to calculate increases in this selection.', { exact: true })).toBeVisible();
    await reset(); await input('Minimum increase').fill('');
    await expect(page.locator('#main-content [role="alert"]')).toContainText('Enter a minimum increase greater than zero.');
    await verify('invalid-threshold-unavailable', { ...baseline, total: null, count: null, stationary: null, marks: 0 });
    await reset(); await input('From · Bangkok time').fill('2026-09-24T14:30'); await input('To · Bangkok time').fill('2026-09-24T14:00');
    await expect(page.locator('#main-content [role="alert"]')).toContainText('The end time must be after the start time.'); await verify('invalid-range-unavailable', empty);
    await reset(); await verify('reset-after-errors', baseline);
    phase = 'failed-refresh'; sourceMode = 'permission-error'; await button('Refresh').click();
    await expect(page.locator('#main-content [role="alert"]')).toContainText('Unable to read the fuel sheet. Check sharing access.');
    await expect(page.locator('#main-content [role="alert"]')).toContainText('Showing the last successful snapshot.'); await verify('failed-refresh-keeps-snapshot', baseline);
    sourceMode = 'snapshot'; await button('Refresh').click(); await expect(page.locator('#main-content [role="alert"]')).toHaveCount(0); await verify('refresh-recovers', baseline);
    phase = 'initial-error-recovery'; sourceMode = 'permission-error';
    const errorPage = await context.newPage(); observe(errorPage);
    try {
      await errorPage.goto(previewUrl, { waitUntil: 'domcontentloaded' });
      await expect(errorPage.locator('#main-content [role="alert"]')).toContainText('Unable to read the fuel sheet. Check sharing access.');
      await expect(errorPage.getByRole('region', { name: 'Fuel readings', exact: true })).toHaveCount(0);
      sourceMode = 'snapshot'; await errorPage.getByRole('button', { name: 'Refresh', exact: true }).click();
      await expect(errorPage.getByRole('region', { name: 'Fuel readings', exact: true })).toBeVisible(); await expect(errorPage.locator('#main-content [role="alert"]')).toHaveCount(0);
      checks.push({ name: phase, recovered: true });
    } finally { await errorPage.close(); }
    assert.deepEqual(errors, [], 'No browser console or runtime errors expected.');
    console.log(JSON.stringify({ status: 'passed', previewUrl, sourcePath, sourceRequests, checks, errors,
      screenshots: ['/private/tmp/bgt-fuel-desktop.png', '/private/tmp/bgt-fuel-mobile.png', '/private/tmp/bgt-fuel-dashboard-preview.png'] }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ status: 'failed', phase, completedChecks: checks, browserErrors: errors }, null, 2));
    if (page && !page.isClosed()) await page.screenshot({ path: '/private/tmp/bgt-fuel-failure.png', fullPage: true, animations: 'disabled' }).catch(() => {});
    throw error;
  } finally { if (browser) await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });

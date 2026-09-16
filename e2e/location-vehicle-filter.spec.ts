import { expect, test, type Page } from '@playwright/test';
import { columns, sampleRows } from './fixtures/location-data';

const FIXTURE_PATH = '/e2e-fixtures/location-data-v1';

async function mockVehicleApi(page: Page, { single = false, many = false, history = 0, slowVehicle = '', slowOffset = 0, failOffset = -1 } = {}) {
  const vehicles = single ? ['LOC-0055'] : ['LOC-0055', 'LOC-0099'];
  if (many) vehicles.push(...Array.from({ length: 498 }, (_, i) => `TRUCK-${String(i + 2).padStart(3, '0')}`));
  const requests: Array<{ vehicle: string; offset: number }> = [];
  await page.route('**/api/sheets/e2e-location-data-v1*/0?*', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('mode') === 'location-vehicles') {
      await route.fulfill({ json: { vehicles: vehicles.map((vehicleNo) => ({ vehicleNo, fleets: [] })), hasFleetColumn: false, hasUnidentifiedVehicles: false } });
      return;
    }
    expect(url.searchParams.get('mode')).toBe('location-history');
    const vehicle = url.searchParams.get('vehicle')!;
    expect(vehicles).toContain(vehicle);
    const offset = Number(url.searchParams.get('offset') ?? 0);
    requests.push({ vehicle, offset });
    if (vehicle === slowVehicle && offset >= slowOffset) await new Promise((resolve) => setTimeout(resolve, 600));
    if (offset === failOffset) {
      await route.fulfill({ status: 502, json: { error: 'History temporarily unavailable' } }).catch(() => {});
      return;
    }
    const rows = history
      ? Array.from({ length: history }, (_, i) => ({ ...sampleRows[i % sampleRows.length], 'Vehicle No': vehicle,
        ...(i === history - 1 ? { Location: 'Last history record', Speed: 111 } : {}),
      }))
      : vehicle.startsWith('TRUCK-')
        ? sampleRows.slice(0, 10).map((row) => ({ ...row, 'Vehicle No': vehicle }))
        : sampleRows.filter((row) => row['Vehicle No'] === vehicle);
    await route.fulfill({ json: { columns, rows: rows.slice(offset, offset + 2_000), vehicle, offset, hasMore: rows.length > offset + 2_000, lastUpdated: Date.now() } }).catch(() => {});
  });
  return requests;
}

async function openFixture(page: Page, single = false) {
  const response = await page.goto(`${FIXTURE_PATH}${single ? '?mode=single-vehicle' : ''}`);
  test.skip(response?.status() === 404, 'Start the dev server with ALLOW_E2E_FIXTURES=true.');
  await expect(page.getByRole('heading', { name: 'Location history' })).toBeVisible();
}

function picker(page: Page) { return page.getByRole('region', { name: 'Selected vehicle' }); }

async function expectVehicleRows(page: Page, vehicle: string) {
  const cells = page.getByRole('table', { name: 'Location history' }).locator('tbody tr td:nth-child(2)');
  await expect(cells).toHaveCount(10);
  await expect(cells).toHaveText(Array(10).fill(vehicle));
}

test.describe('Location Data v1 one-vehicle loading', () => {
  test('automatically selects the sole vehicle and cannot clear it to All', async ({ page }) => {
    const requests = await mockVehicleApi(page, { single: true });
    await openFixture(page, true);
    await picker(page).getByRole('button', { name: 'LOC-0055', exact: true }).click();
    await expect(picker(page).getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'false');
    await expect(picker(page).getByRole('option', { name: 'LOC-0055' })).toHaveAttribute('aria-selected', 'true');
    await picker(page).getByRole('option', { name: 'LOC-0055' }).click();
    await expectVehicleRows(page, 'LOC-0055');
    await expect(picker(page).getByRole('button', { name: 'All vehicles' })).toHaveCount(0);
    expect(requests).toEqual([{ vehicle: 'LOC-0055', offset: 0 }]);
    await page.reload();
    await expectVehicleRows(page, 'LOC-0055');
  });

  test('loads only one of 500 vehicles, supports search, and cancels stale switches', async ({ page }) => {
    const requests = await mockVehicleApi(page, { many: true, slowVehicle: 'LOC-0099' });
    await openFixture(page);
    expect(requests).toEqual([{ vehicle: 'LOC-0055', offset: 0 }]);
    await picker(page).getByRole('button', { name: 'LOC-0055', exact: true }).click();
    await expect(picker(page).getByRole('option')).toHaveCount(100);
    await picker(page).getByRole('option', { name: 'LOC-0099' }).click();
    await expect(page.getByRole('table', { name: 'Location history' })).toHaveCount(0);
    await picker(page).getByRole('button', { name: 'LOC-0099', exact: true }).click();
    await picker(page).getByRole('searchbox').fill('TRUCK-499');
    await expect(picker(page).getByRole('option')).toHaveCount(1);
    await picker(page).getByRole('option', { name: 'TRUCK-499' }).click();
    await expectVehicleRows(page, 'TRUCK-499');
    // Let the intentionally slow obsolete request finish; it must not replace this vehicle.
    await page.waitForTimeout(700);
    await expectVehicleRows(page, 'TRUCK-499');
    expect(new Set(requests.map((request) => request.vehicle))).toEqual(new Set(['LOC-0055', 'LOC-0099', 'TRUCK-499']));
    expect(requests.every((request) => request.offset === 0)).toBe(true);
  });

  test('migrates saved multiple vehicles to the first choice and preserves other dropdown behavior', async ({ page }) => {
    const requests = await mockVehicleApi(page);
    await page.addInitScript(() => localStorage.setItem('location-data-v1-e2e-location-data-v1', JSON.stringify({ vehicles: ['LOC-0099', 'LOC-0055'] })));
    await openFixture(page);
    expect(requests).toEqual([{ vehicle: 'LOC-0099', offset: 0 }]);
    await expectVehicleRows(page, 'LOC-0099');
    const filters = page.getByRole('region', { name: 'Location filters' });
    await filters.getByRole('button', { name: 'All ignition states', exact: true }).click();
    await filters.getByRole('option', { name: 'OFF', exact: true }).click();
    await filters.getByRole('option', { name: 'ON', exact: true }).click();
    await expect(filters.getByRole('option', { selected: true })).toHaveCount(2);
    await filters.getByRole('button', { name: 'Done', exact: true }).click();
    await filters.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await expect(picker(page).getByRole('button', { name: 'LOC-0099', exact: true })).toBeVisible();
    await expectVehicleRows(page, 'LOC-0099');
    expect(requests).toHaveLength(1);
  });

  test('loads all history automatically beyond 25,000 and includes the last page in metrics and filters', async ({ page }) => {
    const requests = await mockVehicleApi(page, { history: 26_010 });
    await openFixture(page);
    await expect(page.getByText('26,010 / 26,010 location records', { exact: true })).toBeVisible();
    expect(requests).toEqual(Array.from({ length: 14 }, (_, i) => ({ vehicle: 'LOC-0055', offset: i * 2_000 })));
    await expect(page.getByRole('button', { name: 'Load older history', exact: true })).toHaveCount(0);
    const metrics = page.getByRole('region', { name: 'Location metrics' });
    await expect(metrics.getByText('111', { exact: true })).toBeVisible();
    await expect(metrics.getByText(/1 vehicles/)).toHaveCount(0);
    await page.getByRole('searchbox', { name: 'Search vehicle, driver, or location' }).fill('Last history record');
    await expect(page.getByText('1 / 26,010 location records', { exact: true })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Location history' }).locator('tbody tr')).toHaveCount(1);
  });

  test('hides partial totals and cancels a later page when another vehicle is selected', async ({ page }) => {
    const requests = await mockVehicleApi(page, { history: 2_010, slowVehicle: 'LOC-0055', slowOffset: 2_000 });
    await page.goto(FIXTURE_PATH);
    await expect.poll(() => requests.some((request) => request.vehicle === 'LOC-0055' && request.offset === 2_000)).toBe(true);
    await expect(page.getByRole('region', { name: 'Location metrics' })).toHaveCount(0);
    await expect(page.getByRole('table', { name: 'Location history' })).toHaveCount(0);
    await picker(page).getByRole('button', { name: 'LOC-0055', exact: true }).click();
    await picker(page).getByRole('option', { name: 'LOC-0099', exact: true }).click();
    await expectVehicleRows(page, 'LOC-0099');
    await page.waitForTimeout(700);
    await expectVehicleRows(page, 'LOC-0099');
    await expect(page.getByText('2,010 / 2,010 location records', { exact: true })).toBeVisible();
  });

  test('a failed later page cannot leave partial metrics or exports visible', async ({ page }) => {
    await mockVehicleApi(page, { history: 2_010, failOffset: 2_000 });
    await page.goto(FIXTURE_PATH);
    await expect(page.getByRole('alert').filter({ hasText: 'History temporarily unavailable' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Location metrics' })).toHaveCount(0);
    await expect(page.getByRole('table', { name: 'Location history' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Export CSV', exact: true })).toBeDisabled();
  });
});

import { expect, test, type Locator, type Page } from '@playwright/test';

const FIXTURE_PATH = '/e2e-fixtures/location-data-v1';

async function openFixture(page: Page, path: string) {
  const response = await page.goto(path);
  test.skip(
    response?.status() === 404,
    'Fixture is disabled: restart dev with ALLOW_E2E_FIXTURES=true (Playwright webServer sets this when it starts its own server).',
  );
  await expect(page.getByRole('heading', { name: 'Location history' })).toBeVisible({ timeout: 20_000 });
}

function vehicleFilter(page: Page): Locator {
  return page.getByRole('region', { name: 'Location filters' });
}

async function expectVisibleVehicleCells(page: Page, expectedVehicle: string) {
  const table = page.getByRole('table', { name: 'Location history' });
  const vehicleCells = table.locator('tbody tr td:nth-child(2)');
  await expect(vehicleCells).toHaveCount(10);
  expect(await vehicleCells.allTextContents()).toEqual(Array(10).fill(expectedVehicle));
}

test.describe('Location Data v1 filters', () => {
  test('keeps the only vehicle visibly selected and persists it across reloads', async ({ page }) => {
    await openFixture(page, `${FIXTURE_PATH}?mode=single-vehicle`);

    const filters = vehicleFilter(page);
    const allVehiclesTrigger = filters.getByRole('button', { name: /^All vehicles$/ });
    await expect(allVehiclesTrigger).toBeVisible();
    await allVehiclesTrigger.click();

    const onlyVehicle = filters.getByRole('option', { name: 'LOC-0055' });
    await expect(onlyVehicle).toHaveAttribute('aria-selected', 'false');
    await onlyVehicle.click();
    await expect(onlyVehicle).toHaveAttribute('aria-selected', 'true');

    await filters.getByRole('button', { name: 'Done', exact: true }).click();
    const selectedVehicleTrigger = filters.getByRole('button').filter({ hasText: 'LOC-0055' });
    await expect(selectedVehicleTrigger).toBeVisible();
    await expectVisibleVehicleCells(page, 'LOC-0055');

    await selectedVehicleTrigger.click();
    await expect(filters.getByRole('option', { name: 'LOC-0055' })).toHaveAttribute('aria-selected', 'true');
    await filters.getByRole('button', { name: 'Done', exact: true }).click();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Location history' })).toBeVisible({ timeout: 20_000 });
    const reloadedFilters = vehicleFilter(page);
    const reloadedTrigger = reloadedFilters.getByRole('button').filter({ hasText: 'LOC-0055' });
    await expect(reloadedTrigger).toBeVisible();
    await reloadedTrigger.click();
    await expect(reloadedFilters.getByRole('option', { name: 'LOC-0055' })).toHaveAttribute('aria-selected', 'true');
    await expectVisibleVehicleCells(page, 'LOC-0055');
  });

  test('shows only the selected vehicle in Location history for a multi-vehicle sheet', async ({ page }) => {
    await openFixture(page, FIXTURE_PATH);

    const filters = vehicleFilter(page);
    await filters.getByRole('button', { name: /^All vehicles$/ }).click();
    const selectedVehicle = filters.getByRole('option', { name: 'LOC-0055' });
    await selectedVehicle.click();
    await expect(selectedVehicle).toHaveAttribute('aria-selected', 'true');
    await expect(filters.getByRole('option', { name: 'LOC-0099' })).toHaveAttribute('aria-selected', 'false');
    await filters.getByRole('button', { name: 'Done', exact: true }).click();

    await expect(page.getByText('298 / 596 location records', { exact: true })).toBeVisible();
    await expectVisibleVehicleCells(page, 'LOC-0055');
  });

  test('keeps every explicitly checked option selected across multi-option and sole-option filters', async ({ page }) => {
    await openFixture(page, `${FIXTURE_PATH}?mode=single-vehicle`);

    const filters = vehicleFilter(page);
    await filters.getByRole('button', { name: /^All ignition states$/ }).click();

    const ignitionOff = filters.getByRole('option', { name: 'OFF' });
    const ignitionOn = filters.getByRole('option', { name: 'ON' });
    await ignitionOff.click();
    await expect(ignitionOff).toHaveAttribute('aria-selected', 'true');
    await ignitionOn.click();
    await expect(ignitionOff).toHaveAttribute('aria-selected', 'true');
    await expect(ignitionOn).toHaveAttribute('aria-selected', 'true');

    await filters.getByRole('button', { name: 'Done', exact: true }).click();
    const ignitionTrigger = filters.getByText('2 ignition states', { exact: true }).locator('..');
    await expect(ignitionTrigger).toBeVisible();
    await expect(filters.getByRole('button', { name: /^All ignition states$/ })).toHaveCount(0);

    await ignitionTrigger.click();
    await expect(filters.getByRole('option', { name: 'OFF' })).toHaveAttribute('aria-selected', 'true');
    await expect(filters.getByRole('option', { name: 'ON' })).toHaveAttribute('aria-selected', 'true');
    await filters.getByRole('button', { name: 'Done', exact: true }).click();

    await filters.getByRole('button', { name: /^All GPS statuses$/ }).click();
    const onlyGpsStatus = filters.getByRole('option', { name: 'A' });
    await expect(onlyGpsStatus).toHaveAttribute('aria-selected', 'false');
    await onlyGpsStatus.click();
    await expect(onlyGpsStatus).toHaveAttribute('aria-selected', 'true');
    await filters.getByRole('button', { name: 'Done', exact: true }).click();

    const gpsTrigger = filters.getByText('A', { exact: true }).locator('..');
    await expect(gpsTrigger).toBeVisible();
    await gpsTrigger.click();
    await expect(filters.getByRole('option', { name: 'A' })).toHaveAttribute('aria-selected', 'true');
  });
});

import { test, expect } from '@playwright/test';

test.describe('CSV export fixture', () => {
  test('opens export dialog with column options', async ({ page, request }) => {
    const probe = await request.get('/e2e-fixtures/csv-export');
    test.skip(
      probe.status() === 404,
      'Fixture is disabled: restart dev with ALLOW_E2E_FIXTURES=true (Playwright webServer sets this when it starts its own server).',
    );

    await page.goto('/e2e-fixtures/csv-export');
    await expect(page.getByRole('heading', { name: /e2e csv export fixture/i })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: /^export csv$/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: /configure csv export/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^download csv$/i })).toBeVisible();
  });
});

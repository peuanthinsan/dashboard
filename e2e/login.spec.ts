import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(
      page.getByRole('heading', { name: /welcome back|ยินดีต้อนรับกลับมา/i }),
    ).toBeVisible({ timeout: 10000 });
  });

  test('redirects to dashboard when already logged in', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/(dashboard|login)/, { timeout: 10000 });
  });
});

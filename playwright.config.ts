import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:3000',
    // CI starts a fresh server with ALLOW_E2E_FIXTURES. Locally, reuse `bun run dev` if :3000 is up (see e2e/csv-export skip).
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      ALLOW_E2E_FIXTURES: 'true',
    },
  },
});

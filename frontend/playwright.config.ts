import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for NIRVAPROCURE smoke tests.
 *
 * - `webServer` boots `npm run dev` on :3001 so `npm run e2e` works locally
 *   without any extra steps.
 * - We target chromium-only by default. Firefox/WebKit are added in CI.
 * - Tests rely on the offline mock-data fallback (no backend required).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'PORT=3001 npm run dev',
        url: 'http://localhost:3001',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});

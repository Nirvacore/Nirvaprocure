import { test, expect, type Page } from '@playwright/test';
import { consentCookieValue } from './helpers';

async function stubLogin(page: Page) {
  const { hostname } = new URL(process.env.E2E_BASE_URL ?? 'http://localhost:3001');
  await page.context().addCookies([
    { name: 'nirva.locale', value: 'th', domain: hostname, path: '/' },
    { name: 'nirva.cookie_consent', value: consentCookieValue(), domain: hostname, path: '/' },
  ]);
  await page.route('**/v1/auth/login', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}') as { email: string };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'stub.access',
        refresh_token: 'stub.refresh',
        user: { id: 'u1', email: body.email, full_name: 'สุดา จันทร์', org_id: 'o1' },
      }),
    });
  });
  // Stub inbox so the badge polling doesn't surface a network error in the bar.
  await page.route('**/v1/approvals/inbox', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

test.describe('login flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.addInitScript(() => localStorage.clear());
    await stubLogin(page);
  });

  test('redirects unauthenticated user to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /เข้าระบบ NIRVAPROCURE/ })).toBeVisible();
  });

  test('valid credentials land on home', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('suda@nirva.co.th');
    await page.locator('input[type="password"]').fill('password123');
    await page.getByRole('button', { name: 'เข้าระบบ' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: /วันนี้/ })).toBeVisible();
  });

  test('bad credentials show Thai error', async ({ page }) => {
    await page.route('**/v1/auth/login', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'INVALID', message: 'Invalid credentials' }),
      }));

    await page.goto('/login');
    await page.locator('input[type="email"]').fill('wrong@nirva.co.th');
    await page.locator('input[type="password"]').fill('nope');
    await page.getByRole('button', { name: 'เข้าระบบ' }).click();
    await expect(page.getByText('อีเมลหรือรหัสผ่านไม่ถูกต้อง')).toBeVisible();
  });
});

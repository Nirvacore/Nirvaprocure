import { test, expect } from '@playwright/test';
import { consentCookieValue, dismissCookieConsent } from './helpers';

test.describe('supplier portal', () => {
  test.beforeEach(async ({ page }) => {
    const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3001';
    const { hostname } = new URL(baseURL);
    await page.context().addCookies([
      { name: 'nirva.locale', value: 'th', domain: hostname, path: '/' },
      { name: 'nirva.cookie_consent', value: consentCookieValue(), domain: hostname, path: '/' },
    ]);
  });

  test('shows mock portal lines when backend is offline', async ({ page }) => {
    await page.goto('/portal/demo-token');
    await dismissCookieConsent(page);
    await expect(page.getByRole('heading', { name: 'สวัสดีครับ บริษัท เทค ซัพพลาย จำกัด' })).toBeVisible();
    await expect(page.getByText('เครื่องพิมพ์เลเซอร์ A4')).toBeVisible();
    await expect(page.getByText('PR-2026-0042')).toBeVisible();
  });

  test('acknowledge button marks line as done', async ({ page }) => {
    await page.goto('/portal/demo-token');
    await dismissCookieConsent(page);
    await page.getByRole('button', { name: 'ตอบรับคำสั่งซื้อ' }).click();
    await expect(page.getByText('ตอบรับแล้ว ขอบคุณครับ')).toBeVisible();
  });
});

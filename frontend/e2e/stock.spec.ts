import { test, expect } from '@playwright/test';
import { setupAuthenticatedPage, gotoAuthenticated } from './helpers';

test.describe('stock page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedPage(page);
  });

  test('shows on-hand inventory from mock data', async ({ page }) => {
    await gotoAuthenticated(page, '/stock');
    await expect(page.getByRole('heading', { name: 'สต็อกสินค้า' })).toBeVisible();
    await expect(page.getByText('HP 65A Black Toner Cartridge')).toBeVisible();
    await expect(page.getByText('ถุงมือแล็บ ขนาด M')).toBeVisible();
  });

  test('warehouse filter narrows items', async ({ page }) => {
    await gotoAuthenticated(page, '/stock');
    await page.getByRole('button', { name: /F5 · คลังย่อย ชั้น 5/ }).click();
    await expect(page.getByText('SSD Server 2TB')).toBeVisible();
    await expect(page.getByText('ถุงมือแล็บ ขนาด M')).not.toBeVisible();
  });

  test('low-stock alert badge appears', async ({ page }) => {
    await gotoAuthenticated(page, '/stock');
    await expect(page.getByText('มี 2 รายการต่ำกว่าจุดสั่งซื้อใหม่')).toBeVisible();
  });
});

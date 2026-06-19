import { test, expect } from '@playwright/test';
import { setupAuthenticatedPage, gotoAuthenticated } from './helpers';

test.describe('purchase orders page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedPage(page);
  });

  test('lists mock purchase orders', async ({ page }) => {
    await gotoAuthenticated(page, '/po');
    await expect(page.getByRole('heading', { name: /ใบสั่งซื้อ/ })).toBeVisible();
    await expect(page.getByText('PO-2026-0018')).toBeVisible();
    await expect(page.getByText('บริษัท แม็คโคร จำกัด')).toBeVisible();
  });

  test('search filters by PO number', async ({ page }) => {
    await gotoAuthenticated(page, '/po');
    await page.getByPlaceholder('ค้นหาเลข PO หรือผู้จำหน่าย…').fill('0016');
    await expect(page.getByText('PO-2026-0016')).toBeVisible();
    await expect(page.getByText('PO-2026-0018')).not.toBeVisible();
  });

  test('status filter shows only drafts', async ({ page }) => {
    await gotoAuthenticated(page, '/po');
    await page.getByRole('button', { name: 'ร่าง' }).click();
    await expect(page.getByText('PO-2026-0016')).toBeVisible();
    await expect(page.getByText('PO-2026-0018')).not.toBeVisible();
  });

  test('PO detail shows status actions', async ({ page }) => {
    await gotoAuthenticated(page, '/po/po-3');
    await expect(page.getByText('PO-2026-0019')).toBeVisible();
    await expect(page.getByRole('button', { name: 'ยืนยันรับของ' })).toBeVisible();
  });
});

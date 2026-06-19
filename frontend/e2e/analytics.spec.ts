import { test, expect } from '@playwright/test';
import { setupAuthenticatedPage, gotoAuthenticated } from './helpers';

test.describe('analytics page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedPage(page);
  });

  test('shows monthly summary stats', async ({ page }) => {
    await gotoAuthenticated(page, '/analytics');
    await expect(page.getByRole('heading', { name: 'รายงานเดือนนี้' })).toBeVisible();
    await expect(page.getByText('ใบขอทั้งหมด')).toBeVisible();
    await expect(page.getByText('HP Authorized Store')).toBeVisible();
  });

  test('supplier risk panel expands with localized CoI labels', async ({ page }) => {
    await gotoAuthenticated(page, '/analytics');
    await page.getByRole('button', { name: 'ความเสี่ยงของผู้จำหน่าย' }).click();
    await expect(page.getByText('Global Tech Import Co.')).toBeVisible();
    await page.getByText('Global Tech Import Co.').click();
    await expect(page.getByText('⚠ มี')).toBeVisible();
  });
});

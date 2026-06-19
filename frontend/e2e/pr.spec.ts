import { test, expect } from '@playwright/test';
import { setupAuthenticatedPage, gotoAuthenticated } from './helpers';

test.describe('PR list page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedPage(page);
  });

  test('lists mock purchase requests', async ({ page }) => {
    await gotoAuthenticated(page, '/pr');
    await expect(page.getByRole('heading', { name: 'ใบขอของฉัน' })).toBeVisible();
    await expect(page.getByText('PR-2026-0042')).toBeVisible();
    await expect(page.getByText('หมึกเครื่องพิมพ์ ชั้น 5')).toBeVisible();
  });

  test('status filter narrows visible rows', async ({ page }) => {
    await gotoAuthenticated(page, '/pr');
    await page.getByRole('button', { name: 'ร่าง' }).click();
    await expect(page.getByText('SSD Server x 2')).toBeVisible();
    await expect(page.getByText('PR-2026-0042')).not.toBeVisible();
  });

  test('row navigates to PR detail', async ({ page }) => {
    await gotoAuthenticated(page, '/pr');
    await page.getByText('PR-2026-0042').click();
    await expect(page).toHaveURL(/\/pr\/1/);
    await expect(page.getByRole('heading', { name: /หมึกเครื่องพิมพ์ ชั้น 5/ })).toBeVisible();
  });
});

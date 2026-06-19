import { test, expect } from '@playwright/test';
import { setupAuthenticatedPage, gotoAuthenticated } from './helpers';

test.describe('notifications page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedPage(page);
  });

  test('shows notification list and LINE status', async ({ page }) => {
    await gotoAuthenticated(page, '/notifications');
    await expect(page.getByRole('heading', { name: 'แจ้งเตือน' })).toBeVisible();
    await expect(page.getByText('PR-2026-0042 รออนุมัติ')).toBeVisible();
    await expect(page.getByText('เชื่อมแล้ว')).toBeVisible();
  });

  test('unread filter hides read notifications', async ({ page }) => {
    await gotoAuthenticated(page, '/notifications');
    await page.getByRole('button', { name: 'ยังไม่อ่าน' }).click();
    await expect(page.getByText('PR-2026-0042 รออนุมัติ')).toBeVisible();
    await expect(page.getByText('PR-2026-0041 อนุมัติแล้ว')).not.toBeVisible();
  });

  test('mark all read then unread filter shows empty state', async ({ page }) => {
    await page.route('**/v1/notifications/read-all', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));

    await gotoAuthenticated(page, '/notifications');
    await page.getByRole('button', { name: 'อ่านทั้งหมดแล้ว' }).click();
    await expect(page.getByRole('button', { name: 'อ่านทั้งหมดแล้ว' })).not.toBeVisible();
    await page.getByRole('button', { name: 'ยังไม่อ่าน' }).click();
    await expect(page.getByText('ยังไม่มีการแจ้งเตือน')).toBeVisible();
  });

  test('tapping notification navigates to PR detail', async ({ page }) => {
    await gotoAuthenticated(page, '/notifications');
    await page.getByText('PR-2026-0042 รออนุมัติ').click();
    await expect(page).toHaveURL(/\/pr\/1/);
  });
});

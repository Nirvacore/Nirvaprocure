import { test, expect } from '@playwright/test';
import { setupAuthenticatedPage, gotoAuthenticated } from './helpers';

async function stubLineApis(page: import('@playwright/test').Page) {
  await page.route('**/api/notifications/line/rich-menu/status', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ richMenuId: null }) }));
  await page.route('**/api/notifications/line/status', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ linked: false }) }));
}

test.describe('line page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedPage(page);
    await stubLineApis(page);
  });

  test('shows binding and rich menu sections', async ({ page }) => {
    await gotoAuthenticated(page, '/line');
    await expect(page.getByRole('heading', { name: 'แจ้งเตือนผ่าน LINE' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'เชื่อมต่อบัญชี LINE' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Rich Menu (ปุ่มลัดแชต LINE)' })).toBeVisible();
  });

  test('rich menu preview uses localized button labels', async ({ page }) => {
    await gotoAuthenticated(page, '/line');
    const preview = page.locator('div.select-none.bg-\\[\\#4F46E5\\]');
    await expect(preview.getByText('รออนุมัติ')).toBeVisible();
    await expect(preview.getByText('ใบขอของฉัน')).toBeVisible();
    await expect(preview.getByText('ขอซื้อใหม่')).toBeVisible();
    await expect(preview.getByText('หน้าหลัก')).toBeVisible();
  });
});

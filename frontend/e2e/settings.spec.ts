import { test, expect } from '@playwright/test';
import { setupAuthenticatedPage, gotoAuthenticated } from './helpers';

test.describe('settings page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedPage(page);
  });

  test('shows workflow rules by default', async ({ page }) => {
    await gotoAuthenticated(page, '/settings');
    await expect(page.getByRole('heading', { name: 'ตั้งค่า' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'กฎการอนุมัติ' })).toBeVisible();
    await expect(page.getByText('ใบขอทั่วไป (น้อยกว่า 50,000 ฿)')).toBeVisible();
  });

  test('switches between settings tabs', async ({ page }) => {
    await gotoAuthenticated(page, '/settings');
    await page.getByRole('main').getByRole('button', { name: 'ผู้ใช้', exact: true }).click();
    await expect(page.getByPlaceholder('ค้นหาชื่อหรืออีเมล')).toBeVisible();
    await page.getByRole('main').getByRole('button', { name: 'แผนก', exact: true }).click();
    await expect(page.getByRole('button', { name: 'เพิ่มแผนกใหม่' })).toBeVisible();
  });
});

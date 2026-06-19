import { test, expect } from '@playwright/test';
import { setupAuthenticatedPage, gotoAuthenticated } from './helpers';

test.describe('home page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedPage(page);
  });

  test('shows greeting and quick actions', async ({ page }) => {
    await gotoAuthenticated(page, '/');
    await expect(page.getByRole('heading', { name: 'วันนี้อยากทำอะไรครับ?' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: 'ขอซื้อใหม่' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: 'รออนุมัติ' }).first()).toBeVisible();
  });

  test('monthly summary cards render', async ({ page }) => {
    await gotoAuthenticated(page, '/');
    await expect(page.getByRole('main').getByText('ใบขอทั้งหมด')).toBeVisible();
    await expect(page.getByRole('main').getByText('อนุมัติแล้ว', { exact: true })).toBeVisible();
  });
});

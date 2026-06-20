import { test, expect } from '@playwright/test';
import { setupAuthenticatedPage, gotoAuthenticated } from './helpers';

test.describe('audit page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedPage(page);
  });

  test('shows audit log entries and filters', async ({ page }) => {
    await gotoAuthenticated(page, '/audit');
    await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible();
    await expect(page.getByRole('main').getByText('สุดา จันทร์').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'ทั้งหมด' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ใบขอ' })).toBeVisible();
  });

  test('entity filter narrows visible rows', async ({ page }) => {
    await gotoAuthenticated(page, '/audit');
    await page.getByRole('button', { name: 'กฎอนุมัติ' }).click();
    await expect(page.getByText('workflow.update')).toBeVisible();
    await expect(page.getByText('pr.create')).not.toBeVisible();
  });

  test('load more appends additional audit rows', async ({ page }) => {
    await gotoAuthenticated(page, '/audit');
    await expect(page.getByText('pr.create')).toBeVisible();
    await expect(page.getByText('user.login')).not.toBeVisible();
    await page.getByRole('button', { name: 'โหลดเพิ่ม' }).click();
    await expect(page.getByText('po.create')).toBeVisible();
    await expect(page.getByText('supplier.update')).toBeVisible();
  });
});

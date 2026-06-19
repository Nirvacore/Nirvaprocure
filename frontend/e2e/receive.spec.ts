import { test, expect } from '@playwright/test';
import { setupAuthenticatedPage, gotoAuthenticated } from './helpers';

test.describe('receive goods page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedPage(page);
  });

  test('lists approved PRs ready to receive', async ({ page }) => {
    await gotoAuthenticated(page, '/receive');
    await expect(page.getByRole('heading', { name: 'รับของ' })).toBeVisible();
    await expect(page.getByText('ถุงมือแล็บ x 200 คู่')).toBeVisible();
    await expect(page.getByText('PR-2026-0041')).toBeVisible();
  });

  test('expand PR and confirm receipt', async ({ page }) => {
    await page.route('**/v1/pr/2/receive', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));

    await gotoAuthenticated(page, '/receive');
    await page.getByText('ถุงมือแล็บ x 200 คู่').click();
    await expect(page.getByText('ถุงมือแล็บ ขนาด M')).toBeVisible();

    const card = page.locator('.card.border-green-200').first();
    await card.getByRole('button', { name: 'ยืนยันรับของ' }).click();

    const modal = page.locator('.fixed.inset-0').filter({ hasText: 'ยืนยันรับของ' });
    await modal.getByRole('button', { name: 'ยืนยันรับของ' }).click();

    await expect(page.getByText('ถุงมือแล็บ x 200 คู่')).not.toBeVisible({ timeout: 5_000 });
  });
});

import { test, expect } from '@playwright/test';
import { setupAuthenticatedPage, gotoAuthenticated } from './helpers';

test.describe('global search page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedPage(page);
  });

  test('shows empty state before query', async ({ page }) => {
    await gotoAuthenticated(page, '/search');
    await expect(page.getByText('ค้นหาอะไรก็ได้')).toBeVisible();
    await expect(page.getByText('ใบขอ, ผู้จำหน่าย, รหัสสินค้า')).toBeVisible();
  });

  test('finds suppliers matching query', async ({ page }) => {
    await gotoAuthenticated(page, '/search');
    await page.getByPlaceholder('ค้นหาใบขอ, ผู้จำหน่าย...').fill('แม็คโคร');
    await expect(page.getByText('บริษัท แม็คโคร จำกัด')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('heading', { name: /ผู้จำหน่าย/ })).toBeVisible();
  });

  test('finds PRs matching query', async ({ page }) => {
    await gotoAuthenticated(page, '/search');
    await page.getByPlaceholder('ค้นหาใบขอ, ผู้จำหน่าย...').fill('หมึก');
    await expect(page.getByText('PR-2026-0042')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('หมึกเครื่องพิมพ์ ชั้น 5')).toBeVisible();
  });

  test('shows no-result state for nonsense query', async ({ page }) => {
    await gotoAuthenticated(page, '/search');
    await page.getByPlaceholder('ค้นหาใบขอ, ผู้จำหน่าย...').fill('zzznomatch999');
    await expect(page.getByText('ไม่พบผลลัพธ์')).toBeVisible({ timeout: 5_000 });
  });
});

import { test, expect } from '@playwright/test';
import { setupAuthenticatedPage, gotoAuthenticated } from './helpers';

test.describe('locale switch', () => {
  test('English cookie shows translated suppliers heading', async ({ page }) => {
    await setupAuthenticatedPage(page, 'en');
    await gotoAuthenticated(page, '/suppliers');
    await expect(page.getByRole('heading', { name: 'Suppliers' })).toBeVisible();
    await expect(page.getByPlaceholder('Search name, code, or email…')).toBeVisible();
  });

  test('header language menu switches suppliers page to English', async ({ page }) => {
    await setupAuthenticatedPage(page, 'th');
    await gotoAuthenticated(page, '/suppliers');
    await expect(page.getByRole('heading', { name: 'ผู้จำหน่าย' })).toBeVisible();

    await page.getByRole('button', { name: 'ภาษา' }).click();
    await page.getByRole('menuitem', { name: 'English' }).click();

    await expect(page.getByRole('heading', { name: 'Suppliers' })).toBeVisible();
    await expect(page.getByPlaceholder('Search name, code, or email…')).toBeVisible();
  });
});

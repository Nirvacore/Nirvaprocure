import { test, expect } from '@playwright/test';
import { setupAuthenticatedPage, gotoAuthenticated } from './helpers';

test.describe('locale switch', () => {
  test('English cookie shows translated suppliers heading', async ({ page }) => {
    await setupAuthenticatedPage(page, 'en');
    await gotoAuthenticated(page, '/suppliers');
    await expect(page.getByRole('heading', { name: 'Suppliers' })).toBeVisible();
    await expect(page.getByPlaceholder('Search name, code, or email…')).toBeVisible();
  });

  test('English cookie shows PO, budget, and GoV headings', async ({ page }) => {
    await setupAuthenticatedPage(page, 'en');
    await gotoAuthenticated(page, '/po');
    await expect(page.getByRole('heading', { name: 'Purchase Orders' })).toBeVisible();

    await gotoAuthenticated(page, '/budget');
    await expect(page.getByRole('heading', { name: 'Budget' })).toBeVisible();

    await gotoAuthenticated(page, '/gov/tor');
    await expect(page.getByRole('heading', { name: 'Terms of Reference (ToR)' })).toBeVisible();
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

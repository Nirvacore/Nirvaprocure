import { test, expect } from '@playwright/test';
import { setupAuthenticatedPage, gotoAuthenticated } from './helpers';

test.describe('budget page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedPage(page);
  });

  test('shows department budget summary from mock data', async ({ page }) => {
    await gotoAuthenticated(page, '/budget');
    await expect(page.getByRole('heading', { name: 'งบประมาณ' })).toBeVisible();
    await expect(page.getByText('การเงิน').first()).toBeVisible();
    await expect(page.getByText('งบรวม').first()).toBeVisible();
  });

  test('add modal rejects invalid amount', async ({ page }) => {
    await gotoAuthenticated(page, '/budget');
    await page.getByRole('button', { name: /เพิ่ม\/แก้ไขงบ/ }).click();
    await expect(page.getByRole('heading', { name: /เพิ่ม\/แก้ไขงบ/ })).toBeVisible();
    const modal = page.locator('.fixed.inset-0').filter({ has: page.getByRole('heading', { name: /เพิ่ม\/แก้ไขงบ/ }) });
    await modal.getByRole('button', { name: 'บันทึก' }).click();
    await expect(page.getByText('กรุณากรอกจำนวนเงินที่ถูกต้อง')).toBeVisible();
  });

  test('add modal loads departments in select', async ({ page }) => {
    await gotoAuthenticated(page, '/budget');
    await page.getByRole('button', { name: /เพิ่ม\/แก้ไขงบ/ }).click();
    const deptSelect = page.locator('select').first();
    await expect(deptSelect).toBeVisible();
    // From mockDepartments via NirvaPeople fallback
    await expect(deptSelect.locator('option')).toHaveCount(4);
    await expect(deptSelect.locator('option').first()).toHaveText('การเงิน');
  });
});

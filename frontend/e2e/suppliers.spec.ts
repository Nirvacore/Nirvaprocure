import { test, expect } from '@playwright/test';
import { setupAuthenticatedPage, gotoAuthenticated } from './helpers';

test.describe('suppliers page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedPage(page);
  });

  test('lists mock suppliers when backend is offline', async ({ page }) => {
    await gotoAuthenticated(page, '/suppliers');
    await expect(page.getByRole('heading', { name: 'ผู้จำหน่าย' })).toBeVisible();
    await expect(page.getByText('HP Authorized Store Thailand')).toBeVisible();
    await expect(page.getByText('บริษัท แม็คโคร จำกัด')).toBeVisible();
  });

  test('search filters supplier list', async ({ page }) => {
    await gotoAuthenticated(page, '/suppliers');
    await page.getByPlaceholder('ค้นหาชื่อ รหัส หรืออีเมล…').fill('แม็คโคร');
    // 300ms debounce
    await expect(page.getByText('บริษัท แม็คโคร จำกัด')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('HP Authorized Store Thailand')).not.toBeVisible();
  });

  test('add modal validates required fields', async ({ page }) => {
    await gotoAuthenticated(page, '/suppliers');
    await page.getByRole('button', { name: /เพิ่มผู้จำหน่าย/ }).click();
    await expect(page.getByRole('heading', { name: 'เพิ่มผู้จำหน่ายใหม่' })).toBeVisible();
    const modal = page.locator('.fixed.inset-0').filter({ has: page.getByRole('heading', { name: 'เพิ่มผู้จำหน่ายใหม่' }) });
    await modal.getByRole('button', { name: 'บันทึก' }).click();
    await expect(page.getByText('รหัสและชื่อบริษัทจำเป็นต้องกรอก')).toBeVisible();
  });

  test('add modal creates supplier via API stub', async ({ page }) => {
    let created = false;
    await page.route('**/v1/suppliers', async (route) => {
      if (route.request().method() === 'POST') {
        created = true;
        const body = JSON.parse(route.request().postData() ?? '{}') as { code: string; name: string };
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'sup-new',
            code: body.code,
            name: body.name,
            contact_name: null,
            contact_email: null,
            contact_phone: null,
            category: null,
            tax_id: null,
            is_active: true,
            risk_tier: null,
            total_pr_count: 0,
            total_spent_minor: 0,
            created_at: new Date().toISOString(),
          }),
        });
        return;
      }
      return route.continue();
    });

    await gotoAuthenticated(page, '/suppliers');
    await page.getByRole('button', { name: /เพิ่มผู้จำหน่าย/ }).click();
    const modal = page.locator('.fixed.inset-0').filter({ has: page.getByRole('heading', { name: 'เพิ่มผู้จำหน่ายใหม่' }) });
    await modal.getByPlaceholder('เช่น SUP-001').fill('SUP-099');
    await modal.getByPlaceholder('บริษัท ABC จำกัด').fill('ทดสอบ Supplier E2E');
    await modal.getByRole('button', { name: 'บันทึก' }).click();

    await expect.poll(() => created).toBe(true);
    await expect(page.getByRole('heading', { name: 'เพิ่มผู้จำหน่ายใหม่' })).not.toBeVisible();
  });

  test('supplier detail shows portal link admin panel', async ({ page }) => {
    await gotoAuthenticated(page, '/suppliers/sup-1');
    await expect(page.getByRole('heading', { name: 'ลิงก์พอร์ทัลซัพพลายเออร์' })).toBeVisible();
    await expect(page.getByText('Q3 ราคา')).toBeVisible();
    await page.getByRole('button', { name: 'ออกลิงก์ใหม่' }).click();
    await expect(page.getByText('คัดลอกลิงก์นี้ตอนนี้')).toBeVisible();
  });
});

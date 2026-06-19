import { test, expect } from '@playwright/test';
import { setupAuthenticatedPage, gotoAuthenticated } from './helpers';

test.describe('gov tor list', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedPage(page);
  });

  test('lists mock ToR entries when backend is offline', async ({ page }) => {
    await gotoAuthenticated(page, '/gov/tor');
    await expect(page.getByRole('heading', { name: 'ข้อกำหนดการจัดซื้อ (ToR)' })).toBeVisible();
    await expect(page.getByText('จัดซื้อเครื่องคอมพิวเตอร์ จำนวน 20 เครื่อง')).toBeVisible();
    await expect(page.getByText('จ้างเหมาบำรุงรักษาระบบเครือข่าย')).toBeVisible();
    await expect(page.getByText('ก่อสร้างอาคารคลังสินค้า')).toBeVisible();
    await expect(page.getByText('ร่าง')).toBeVisible();
    await expect(page.getByText('อนุมัติแล้ว')).toBeVisible();
    await expect(page.getByText('เผยแพร่แล้ว')).toBeVisible();
  });

  test('card navigates to stub detail page', async ({ page }) => {
    await gotoAuthenticated(page, '/gov/tor');
    await page.getByRole('link', { name: /จัดซื้อเครื่องคอมพิวเตอร์/ }).click();
    await expect(page).toHaveURL(/\/gov\/tor\/tor-1$/);
    await expect(page.getByRole('heading', { name: 'รายละเอียด ToR' })).toBeVisible();
    await expect(page.getByText('tor-1')).toBeVisible();
    await page.getByRole('link', { name: 'กลับไปรายการ ToR' }).click();
    await expect(page).toHaveURL(/\/gov\/tor$/);
  });

  test('new ToR button opens create form', async ({ page }) => {
    await gotoAuthenticated(page, '/gov/tor');
    await page.getByRole('link', { name: 'สร้าง ToR ใหม่' }).click();
    await expect(page).toHaveURL(/\/gov\/tor\/new$/);
    await expect(page.getByRole('heading', { name: 'ร่างเอกสาร TOR (ขอบเขตของงาน)' })).toBeVisible();
  });

  test('header nav links to ToR list', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await gotoAuthenticated(page, '/');
    await page.getByRole('navigation').getByRole('link', { name: 'ภาครัฐ' }).click();
    await expect(page).toHaveURL(/\/gov\/tor$/);
    await expect(page.getByRole('heading', { name: 'ข้อกำหนดการจัดซื้อ (ToR)' })).toBeVisible();
  });
});

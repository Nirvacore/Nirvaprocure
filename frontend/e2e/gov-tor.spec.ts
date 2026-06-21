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
    await expect(page.getByRole('link', { name: /จัดซื้อเครื่องคอมพิวเตอร์/ }).getByText('ร่าง')).toBeVisible();
    await expect(page.getByRole('link', { name: /จ้างเหมา/ }).getByText('อนุมัติแล้ว')).toBeVisible();
    await expect(page.getByRole('link', { name: /ก่อสร้าง/ }).getByText('เผยแพร่แล้ว')).toBeVisible();
  });

  test('card navigates to stub detail page', async ({ page }) => {
    await gotoAuthenticated(page, '/gov/tor');
    await page.getByRole('link', { name: /จัดซื้อเครื่องคอมพิวเตอร์/ }).click();
    await expect(page).toHaveURL(/\/gov\/tor\/tor-1$/);
    await expect(page.getByRole('heading', { name: 'จัดซื้อเครื่องคอมพิวเตอร์ จำนวน 20 เครื่อง' })).toBeVisible();
    await expect(page.getByText('๑. ความเป็นมา')).toBeVisible();
    await expect(page.getByText('เช็คลิสต์การปฏิบัติ')).toBeVisible();
    await page.getByRole('link', { name: 'กลับไปรายการ ToR' }).click();
    await expect(page).toHaveURL(/\/gov\/tor$/);
  });

  test('new ToR button opens create form', async ({ page }) => {
    await gotoAuthenticated(page, '/gov/tor');
    await page.getByRole('link', { name: 'สร้าง ToR ใหม่' }).click();
    await expect(page).toHaveURL(/\/gov\/tor\/new$/);
    await expect(page.getByRole('heading', { name: 'ร่างเอกสาร TOR (ขอบเขตของงาน)' })).toBeVisible();
  });

  test('template picker loads mock templates', async ({ page }) => {
    await gotoAuthenticated(page, '/gov/tor/new');
    await expect(page.getByLabel('แม่แบบ TOR')).toBeVisible();
    await page.getByLabel('แม่แบบ TOR').selectOption('tpl-goods');
    await expect(page.getByRole('button', { name: 'จัดซื้อครุภัณฑ์' })).toHaveClass(/bg-brand-600/);
  });

  test('creates mock TOR draft and opens detail page', async ({ page }) => {
    await gotoAuthenticated(page, '/gov/tor/new');
    await page.getByPlaceholder('เช่น จัดซื้อเครื่องคอมพิวเตอร์ จำนวน 20 เครื่อง').fill('ทดสอบ E2E TOR');
    await page.getByPlaceholder('อธิบายงานที่ต้องการให้ผู้รับจ้างทำ ระยะเวลา และเงื่อนไขสำคัญ').fill(
      'ขอบเขตงานทดสอบสำหรับการจัดซื้ออุปกรณ์สำนักงานจำนวนมากเพื่อทดสอบระบบอัตโนมัติ',
    );
    await page.getByRole('button', { name: 'ร่างเอกสารด้วย AI' }).click();
    await expect(page).toHaveURL(/\/gov\/tor\/tor-mock-/);
    await expect(page.getByRole('heading', { name: 'ทดสอบ E2E TOR' })).toBeVisible();
    await expect(page.getByText('ขอบเขตงานทดสอบ')).toBeVisible();
  });

  test('created mock TOR appears on list after navigating back', async ({ page }) => {
    await gotoAuthenticated(page, '/gov/tor/new');
    await page.getByPlaceholder('เช่น จัดซื้อเครื่องคอมพิวเตอร์ จำนวน 20 เครื่อง').fill('รายการใหม่จาก E2E');
    await page.getByPlaceholder('อธิบายงานที่ต้องการให้ผู้รับจ้างทำ ระยะเวลา และเงื่อนไขสำคัญ').fill(
      'ขอบเขตงานทดสอบรายการใหม่บนรายการ ToR หลังสร้างสำเร็จในโหมด offline',
    );
    await page.getByRole('button', { name: 'ร่างเอกสารด้วย AI' }).click();
    await expect(page).toHaveURL(/\/gov\/tor\/tor-mock-/);
    await page.getByRole('link', { name: 'กลับไปรายการ ToR' }).click();
    await expect(page.getByText('รายการใหม่จาก E2E')).toBeVisible();
  });

  test('mobile nav links to ToR list', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAuthenticated(page, '/');
    await page.getByRole('link', { name: 'ภาครัฐ' }).click();
    await expect(page).toHaveURL(/\/gov\/tor$/);
    await expect(page.getByRole('heading', { name: 'ข้อกำหนดการจัดซื้อ (ToR)' })).toBeVisible();
  });

  test('header nav links to ToR list', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await gotoAuthenticated(page, '/');
    await page.getByRole('navigation').getByRole('link', { name: 'ภาครัฐ' }).click();
    await expect(page).toHaveURL(/\/gov\/tor$/);
    await expect(page.getByRole('heading', { name: 'ข้อกำหนดการจัดซื้อ (ToR)' })).toBeVisible();
  });

  test('advances draft status on detail page', async ({ page }) => {
    await gotoAuthenticated(page, '/gov/tor/tor-1');
    await expect(page.getByText('ร่าง').first()).toBeVisible();
    await page.getByRole('button', { name: 'ส่งตรวจสอบ' }).click();
    await expect(page.getByText('อัปเดตสถานะแล้ว')).toBeVisible();
    await expect(page.getByText('อยู่ระหว่างตรวจสอบ').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'อนุมัติ' })).toBeVisible();
  });

  test('copy button copies markdown body', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await gotoAuthenticated(page, '/gov/tor/tor-1');
    await page.getByRole('button', { name: 'คัดลอกเนื้อหา' }).click();
    await expect(page.getByText('คัดลอกไปยังคลิปบอร์ดแล้ว')).toBeVisible();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain('๑. ความเป็นมา');
  });

  test('advanced status reflects on list after navigating back', async ({ page }) => {
    await gotoAuthenticated(page, '/gov/tor/tor-1');
    await page.getByRole('button', { name: 'ส่งตรวจสอบ' }).click();
    await expect(page.getByText('อัปเดตสถานะแล้ว')).toBeVisible();
    await page.getByRole('link', { name: 'กลับไปรายการ ToR' }).click();
    await expect(page).toHaveURL(/\/gov\/tor$/);
    const card = page.getByRole('link', { name: /จัดซื้อเครื่องคอมพิวเตอร์/ });
    await expect(card.getByText('อยู่ระหว่างตรวจสอบ')).toBeVisible();
  });

  test('status filter shows only draft ToR entries', async ({ page }) => {
    await gotoAuthenticated(page, '/gov/tor');
    await page.getByRole('button', { name: 'ร่าง', exact: true }).click();
    await expect(page.getByText('จัดซื้อเครื่องคอมพิวเตอร์ จำนวน 20 เครื่อง')).toBeVisible();
    await expect(page.getByText('จ้างเหมาบำรุงรักษาระบบเครือข่าย')).not.toBeVisible();
    await expect(page.getByText('ก่อสร้างอาคารคลังสินค้า')).not.toBeVisible();
  });

  test('download button saves markdown file', async ({ page }) => {
    await gotoAuthenticated(page, '/gov/tor/tor-1');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'ดาวน์โหลด Markdown' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.md$/);
    await expect(page.getByText('ดาวน์โหลดไฟล์แล้ว')).toBeVisible();
  });

  test('search filters ToR list by project title', async ({ page }) => {
    await gotoAuthenticated(page, '/gov/tor');
    await page.getByPlaceholder('ค้นหาชื่อโครงการ ToR…').fill('คลังสินค้า');
    await expect(page.getByText('ก่อสร้างอาคารคลังสินค้า')).toBeVisible();
    await expect(page.getByText('จัดซื้อเครื่องคอมพิวเตอร์ จำนวน 20 เครื่อง')).not.toBeVisible();
    await expect(page.getByText('จ้างเหมาบำรุงรักษาระบบเครือข่าย')).not.toBeVisible();
  });
});

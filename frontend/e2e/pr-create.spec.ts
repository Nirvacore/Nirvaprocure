import { test, expect, type Page } from '@playwright/test';
import { setupAuthenticatedPage } from './helpers';

async function authenticate(page: Page) {
  await setupAuthenticatedPage(page);
  await page.route('**/v1/pr*', (r) => {
    if (r.request().method() === 'GET') {
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: [], next_cursor: null }) });
    }
    return r.continue();
  });
}

test('create PR from Shopee link', async ({ page }) => {
  await authenticate(page);

  await page.route('**/v1/pr/import-link', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        source: 'shopee',
        source_url: 'https://shopee.co.th/-i.1.2',
        description: 'HP 65A Black Toner Cartridge',
        unit_price_minor: 189000,
        currency: 'THB',
        supplier: { name: 'HP Authorized Store', external_ref: '1' },
      }),
    }));

  await page.route('**/v1/pr', (r) =>
    r.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'pr-new', pr_number: 'PR-2026-0099', title: 'หมึก', status: 'draft',
        requester_id: 'u1', department_id: null,
        total: { amount_minor: 189000, currency: 'THB' },
        submitted_at: null, created_at: new Date().toISOString(),
      }),
    }));

  await page.route('**/v1/pr/pr-new/submit', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));

  await page.goto('/pr/new');
  await page.getByRole('dialog', { name: /เกี่ยวกับคุกกี้|About cookies/i })
    .getByRole('button', { name: /^(เฉพาะที่จำเป็น|Essential only)$/ })
    .click({ timeout: 3_000 }).catch(() => {});

  // Paste a Shopee URL → parse → row appears
  await page.getByPlaceholder('https://shopee.co.th/...').fill('https://shopee.co.th/-i.1.2');
  await page.getByRole('button', { name: 'ดึงข้อมูล' }).click();
  // After parse: the line-item description input is filled with the product
  // name. We assert on its current value rather than searching by display
  // text since the field is editable.
  await expect(page.getByPlaceholder('ชื่อสินค้า'))
    .toHaveValue('HP 65A Black Toner Cartridge');

  // Fill title and submit
  await page.getByPlaceholder('เช่น หมึกเครื่องพิมพ์ ชั้น 5').fill('หมึก');
  await page.getByRole('button', { name: /ส่งให้หัวหน้าอนุมัติ/ }).click();

  await expect(page).toHaveURL('/pr');
});

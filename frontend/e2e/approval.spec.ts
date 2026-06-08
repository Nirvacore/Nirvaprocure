import { test, expect, type Page } from '@playwright/test';

async function authenticate(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('nirva.token',   'stub.access');
    localStorage.setItem('nirva.refresh', 'stub.refresh');
    localStorage.setItem('nirva.user', JSON.stringify({
      id: 'u1', email: 'por@nirva.co.th', full_name: 'ปอ นวลรัตน์', org_id: 'o1',
    }));
  });
}

test('approve a PR from inbox', async ({ page }) => {
  await authenticate(page);

  let inboxEmpty = false;
  await page.route('**/v1/approvals/inbox', (r) => {
    if (inboxEmpty) {
      return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    return r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          instance_id: 'ai-1',
          step_no: 1,
          waiting_since: new Date().toISOString(),
          pr: {
            id: 'pr-1',
            pr_number: 'PR-2026-0042',
            title: 'หมึกเครื่องพิมพ์ ชั้น 5',
            status: 'pending',
            requester_id: 'u2',
            department_id: null,
            total: { amount_minor: 808920, currency: 'THB' },
            submitted_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          },
        },
      ]),
    });
  });

  await page.route('**/v1/approvals/ai-1/decision', (r) => {
    inboxEmpty = true;
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/approvals');
  await expect(page.getByText('หมึกเครื่องพิมพ์ ชั้น 5')).toBeVisible();

  await page.getByRole('button', { name: 'อนุมัติ' }).first().click();
  // Optimistic UI: card disappears immediately, undo toast shows
  await expect(page.getByText('หมึกเครื่องพิมพ์ ชั้น 5 · อนุมัติแล้ว')).toBeVisible();

  // Wait past the undo window, empty state should appear
  await expect(page.getByText('เคลียร์หมดแล้ว!')).toBeVisible({ timeout: 10_000 });
});

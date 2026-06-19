import { type Page, expect } from '@playwright/test';

type E2ELocale = 'th' | 'en';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3001';

export function consentCookieValue(): string {
  return encodeURIComponent(JSON.stringify({
    essential: true,
    analytics: false,
    marketing: false,
    decided_at: new Date().toISOString(),
    version: 'v1',
  }));
}

/** Seed localStorage + locale cookie so protected routes render in Thai by default. */
export async function authenticate(page: Page, locale: E2ELocale = 'th') {
  await page.addInitScript((loc: E2ELocale) => {
    localStorage.setItem('nirva.token', 'stub.access');
    localStorage.setItem('nirva.refresh', 'stub.refresh');
    localStorage.setItem('nirva.user', JSON.stringify({
      id: 'u1',
      email: 'suda@nirva.co.th',
      full_name: 'สุดา จันทร์',
      org_id: 'o1',
    }));
    document.documentElement.lang = loc;
  }, locale);

  const { hostname } = new URL(BASE_URL);
  await page.context().addCookies([
    { name: 'nirva.locale', value: locale, domain: hostname, path: '/' },
    { name: 'nirva.cookie_consent', value: consentCookieValue(), domain: hostname, path: '/' },
  ]);
}

/** Silence inbox badge polling — most authenticated pages mount the header. */
export async function stubInboxEmpty(page: Page) {
  await page.route('**/v1/approvals/inbox', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

/** Default auth setup for pages that use mock-data fallback (no live backend). */
export async function setupAuthenticatedPage(page: Page, locale: E2ELocale = 'th') {
  await authenticate(page, locale);
  await stubInboxEmpty(page);
}

/** Dismiss PDPA cookie banner when it appears (blocks clicks underneath). */
export async function dismissCookieConsent(page: Page) {
  const dialog = page.getByRole('dialog', { name: /เกี่ยวกับคุกกี้|About cookies/i });
  if (!await dialog.isVisible({ timeout: 3_000 }).catch(() => false)) return;
  await dialog.getByRole('button', { name: /^(เฉพาะที่จำเป็น|Essential only)$/ }).click();
  await expect(dialog).not.toBeVisible();
}

/** Navigate to an authenticated route and clear blocking overlays. */
export async function gotoAuthenticated(page: Page, path: string) {
  await page.goto(path);
  await dismissCookieConsent(page);
}

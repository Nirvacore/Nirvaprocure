/**
 * Unit tests for AffiliateService URL transformation logic.
 *
 * These test the pure URL-tagging functions without database dependencies
 * by accessing private methods directly via cast. The DB-dependent methods
 * (CRUD, click recording) are covered by integration / e2e tests.
 */
import { AffiliateService } from './affiliate.service';

// Cast to expose private methods for unit testing.
const service = new (AffiliateService as any)({ query: async () => ({ rows: [] }) });

const detectPlatform = (host: string) =>
  (service as any).detectPlatform(host);

const applyTag = (url: string, platform: string, affiliateId: string, subId: string | null) =>
  (service as any).applyTag(url, platform, affiliateId, subId);

// ── Platform detection ─────────────────────────────────────────────────────

describe('AffiliateService.detectPlatform', () => {
  it('detects shopee.co.th', () => {
    expect(detectPlatform('shopee.co.th')).toBe('shopee');
  });

  it('detects www.shopee.co.th', () => {
    expect(detectPlatform('www.shopee.co.th')).toBe('shopee');
  });

  it('detects shopee.com (international)', () => {
    expect(detectPlatform('shopee.com')).toBe('shopee');
  });

  it('detects lazada.co.th', () => {
    expect(detectPlatform('lazada.co.th')).toBe('lazada');
  });

  it('detects lazada.com (regional)', () => {
    expect(detectPlatform('www.lazada.com')).toBe('lazada');
  });

  it('detects makro.pro', () => {
    expect(detectPlatform('www.makro.pro')).toBe('makro');
  });

  it('detects alibaba.com', () => {
    expect(detectPlatform('www.alibaba.com')).toBe('alibaba');
  });

  it('detects aliexpress.com', () => {
    expect(detectPlatform('aliexpress.com')).toBe('alibaba');
  });

  it('returns null for unknown host', () => {
    expect(detectPlatform('amazon.com')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });
});

// ── Shopee URL tagging ──────────────────────────────────────────────────────

describe('AffiliateService.applyTag — Shopee', () => {
  const baseUrl = 'https://shopee.co.th/Apple-iPhone-15-i.123.456789';

  it('appends af_id parameter', () => {
    const result = applyTag(baseUrl, 'shopee', 'PUB123', null);
    const u = new URL(result);
    expect(u.searchParams.get('af_id')).toBe('PUB123');
  });

  it('appends sub_id when provided', () => {
    const result = applyTag(baseUrl, 'shopee', 'PUB123', 'dept-IT');
    const u = new URL(result);
    expect(u.searchParams.get('af_id')).toBe('PUB123');
    expect(u.searchParams.get('sub_id')).toBe('dept-IT');
  });

  it('omits sub_id when null', () => {
    const result = applyTag(baseUrl, 'shopee', 'PUB123', null);
    const u = new URL(result);
    expect(u.searchParams.has('sub_id')).toBe(false);
  });

  it('strips existing tracking params before tagging', () => {
    const urlWithTracking = baseUrl + '?af_id=OLD&utm_source=test';
    const result = applyTag(urlWithTracking, 'shopee', 'NEW_PUB', null);
    const u = new URL(result);
    expect(u.searchParams.get('af_id')).toBe('NEW_PUB');
    expect(u.searchParams.has('utm_source')).toBe(false);
  });

  it('preserves non-tracking query params', () => {
    const urlWithParams = baseUrl + '?sp_atk=abc';
    const result = applyTag(urlWithParams, 'shopee', 'PUB123', null);
    const u = new URL(result);
    expect(u.searchParams.get('sp_atk')).toBe('abc');
    expect(u.searchParams.get('af_id')).toBe('PUB123');
  });
});

// ── Lazada URL tagging ──────────────────────────────────────────────────────

describe('AffiliateService.applyTag — Lazada', () => {
  const baseUrl = 'https://www.lazada.co.th/products/some-product-i123.html';

  it('creates redirect URL with tracking ID', () => {
    const result = applyTag(baseUrl, 'lazada', 'TRACK_ABC', null);
    expect(result).toContain('c.lazada.co.th/t/c.TRACK_ABC');
  });

  it('encodes original URL in url param', () => {
    const result = applyTag(baseUrl, 'lazada', 'TRACK_ABC', null);
    const u = new URL(result);
    expect(u.searchParams.get('url')).toBe(baseUrl);
  });

  it('includes sub param when provided', () => {
    const result = applyTag(baseUrl, 'lazada', 'TRACK_ABC', 'campaign1');
    const u = new URL(result);
    expect(u.searchParams.get('sub')).toBe('campaign1');
  });
});

// ── Alibaba URL tagging ─────────────────────────────────────────────────────

describe('AffiliateService.applyTag — Alibaba', () => {
  const baseUrl = 'https://www.alibaba.com/product-detail/some-widget_12345.html';

  it('appends aff_trace_key', () => {
    const result = applyTag(baseUrl, 'alibaba', 'KEY_XYZ', null);
    const u = new URL(result);
    expect(u.searchParams.get('aff_trace_key')).toBe('KEY_XYZ');
    expect(u.searchParams.get('aff_platform')).toBe('portals');
  });

  it('appends aff_sub when provided', () => {
    const result = applyTag(baseUrl, 'alibaba', 'KEY_XYZ', 'sub99');
    const u = new URL(result);
    expect(u.searchParams.get('aff_sub')).toBe('sub99');
  });
});

// ── Makro passthrough ───────────────────────────────────────────────────────

describe('AffiliateService.applyTag — Makro', () => {
  it('returns original URL unchanged (no affiliate scheme)', () => {
    const url = 'https://www.makro.pro/some-product';
    const result = applyTag(url, 'makro', 'ACCOUNT_1', null);
    expect(result).toBe(url);
  });
});

// ── Invalid input resilience ────────────────────────────────────────────────

describe('AffiliateService.applyTag — edge cases', () => {
  it('returns original for malformed URL', () => {
    const result = applyTag('not-a-url', 'shopee', 'PUB', null);
    expect(result).toBe('not-a-url');
  });
});

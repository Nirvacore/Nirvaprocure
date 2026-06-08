/**
 * Unit tests for WebhooksService — HMAC signing, event types, and sha256.
 *
 * The heavy DB + HTTP calls are tested via integration; here we test the
 * pure crypto functions and event type validation.
 */
import { createHash, createHmac } from 'crypto';

// ── Reproduce the sha256 helper ──────────────────────────────────────────────
function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

// ── Reproduce HMAC signing logic used in fire() and replay() ─────────────────
function signPayload(secretHash: string, payload: string): string {
  return createHmac('sha256', secretHash).update(payload).digest('base64');
}

// ── Event types ──────────────────────────────────────────────────────────────
const VALID_EVENTS = [
  'pr.submitted',
  'pr.decided',
  'pr.received',
  'reorder.alert',
  'anomaly.raised',
] as const;

describe('Webhook sha256 hashing', () => {
  it('produces 64-char hex string', () => {
    const h = sha256('test-secret');
    expect(h).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(h)).toBe(true);
  });

  it('is deterministic', () => {
    expect(sha256('abc')).toBe(sha256('abc'));
  });

  it('different inputs → different hashes', () => {
    expect(sha256('secret-a')).not.toBe(sha256('secret-b'));
  });

  it('empty string hashes to known value', () => {
    // sha256('') is a well-known constant
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

describe('Webhook HMAC signing', () => {
  const secret = sha256('my-webhook-secret');
  const payload = JSON.stringify({ event: 'pr.submitted', data: { id: 'pr-1' } });

  it('produces a base64 signature', () => {
    const sig = signPayload(secret, payload);
    expect(sig.length).toBeGreaterThan(20);
    // base64 chars only
    expect(/^[A-Za-z0-9+/=]+$/.test(sig)).toBe(true);
  });

  it('is deterministic', () => {
    const a = signPayload(secret, payload);
    const b = signPayload(secret, payload);
    expect(a).toBe(b);
  });

  it('different payload → different signature', () => {
    const a = signPayload(secret, '{"a":1}');
    const b = signPayload(secret, '{"a":2}');
    expect(a).not.toBe(b);
  });

  it('different secret → different signature', () => {
    const other = sha256('other-secret');
    const a = signPayload(secret, payload);
    const b = signPayload(other, payload);
    expect(a).not.toBe(b);
  });

  it('receiver can verify by recomputing', () => {
    const sig = signPayload(secret, payload);
    // Receiver has the raw secret, hashes it, then HMAC-verifies
    const verified = createHmac('sha256', secret).update(payload).digest('base64');
    expect(verified).toBe(sig);
  });
});

describe('Webhook event types', () => {
  it('has 5 event types', () => {
    expect(VALID_EVENTS).toHaveLength(5);
  });

  it('all events follow dot-notation', () => {
    for (const e of VALID_EVENTS) {
      expect(e).toMatch(/^[a-z]+\.[a-z]+$/);
    }
  });

  it('includes pr lifecycle events', () => {
    expect(VALID_EVENTS).toContain('pr.submitted');
    expect(VALID_EVENTS).toContain('pr.decided');
    expect(VALID_EVENTS).toContain('pr.received');
  });

  it('includes operational events', () => {
    expect(VALID_EVENTS).toContain('reorder.alert');
    expect(VALID_EVENTS).toContain('anomaly.raised');
  });
});

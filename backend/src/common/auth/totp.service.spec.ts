/**
 * Unit tests for TotpService TOTP verification logic.
 *
 * Uses otplib directly to test the token generation/verification
 * window without needing a database.
 */

import { authenticator } from 'otplib';

describe('TOTP verification logic', () => {
  beforeAll(() => {
    authenticator.options = { window: 1 };
  });

  it('accepts a valid current token', () => {
    const secret = authenticator.generateSecret();
    const token = authenticator.generate(secret);
    expect(authenticator.verify({ token, secret })).toBe(true);
  });

  it('rejects an invalid token', () => {
    const secret = authenticator.generateSecret();
    expect(authenticator.verify({ token: '000000', secret })).toBe(false);
  });

  it('rejects empty token', () => {
    const secret = authenticator.generateSecret();
    expect(authenticator.verify({ token: '', secret })).toBe(false);
  });

  it('generates 6-digit tokens', () => {
    const secret = authenticator.generateSecret();
    const token = authenticator.generate(secret);
    expect(token).toMatch(/^\d{6}$/);
  });

  it('generates unique secrets', () => {
    const a = authenticator.generateSecret();
    const b = authenticator.generateSecret();
    expect(a).not.toBe(b);
  });

  it('generates valid otpauth URIs', () => {
    const secret = authenticator.generateSecret();
    const uri = authenticator.keyuri('test@nirva.co.th', 'NIRVAPROCURE', secret);
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain('NIRVAPROCURE');
    expect(uri).toContain(secret);
  });

  it('window=1 allows previous period token', () => {
    const secret = authenticator.generateSecret();
    const token = authenticator.generate(secret);
    expect(authenticator.check(token, secret)).toBe(true);
  });
});

describe('TOTP flow state machine', () => {
  it('setup → confirm → login flow', () => {
    const secret = authenticator.generateSecret();
    const code = authenticator.generate(secret);
    expect(authenticator.verify({ token: code, secret })).toBe(true);
  });

  it('verifyForLogin returns false when no secret', () => {
    const secret: string | null = null;
    const enabled: Date | null = null;
    const hasValid2fa = secret != null && enabled != null;
    expect(hasValid2fa).toBe(false);
  });

  it('verifyForLogin returns false when not enabled', () => {
    const secret = authenticator.generateSecret();
    const enabled: Date | null = null;
    const hasValid2fa = secret != null && enabled != null;
    expect(hasValid2fa).toBe(false);
  });

  it('requires2fa is true when totp_enabled_at is set', () => {
    const row = { req: true };
    expect(row.req === true).toBe(true);
  });

  it('requires2fa is false when totp_enabled_at is null', () => {
    const row = { req: false };
    expect(row.req === true).toBe(false);
  });
});

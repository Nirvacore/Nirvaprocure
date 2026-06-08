import { Inject, Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { Pool } from 'pg';
import { PG_POOL } from '../db/db.module';
import type { CurrentUser } from './current-user.decorator';

/**
 * TOTP (RFC 6238) two-factor auth.
 *
 * Flow:
 *   1. POST /auth/2fa/setup        → server generates a secret, stores it on
 *                                     the user row BUT does not yet flip
 *                                     `totp_enabled_at`. Returns QR + secret.
 *   2. User scans QR, enters code → POST /auth/2fa/verify { code }
 *                                     verifies; if good, sets totp_enabled_at.
 *   3. Login flow: when totp_enabled_at IS NOT NULL, /auth/login responds
 *      with `requires_2fa: true` + a short-lived challenge token; the client
 *      must call /auth/2fa/login { challenge, code } to get full session.
 *
 * The TOTP secret stays on the user row in plaintext for simplicity here —
 * production should column-encrypt it (pgcrypto + a KMS-managed key).
 */
@Injectable()
export class TotpService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {
    // Default options are RFC-compliant: step 30s, 6 digits, SHA-1, ±1 window.
    authenticator.options = { window: 1 };
  }

  async beginSetup(user: CurrentUser): Promise<{ secret: string; qr_data_url: string }> {
    const secret = authenticator.generateSecret();
    await this.pool.query(
      `UPDATE users SET totp_secret = $1, totp_enabled_at = NULL WHERE id = $2 AND org_id = $3`,
      [secret, user.userId, user.orgId],
    );
    // The otpauth URI is the QR contents. `issuer` shows up in Google
    // Authenticator's account label.
    const otpauth   = authenticator.keyuri(user.email, 'NIRVAPROCURE', secret);
    const qr_data_url = await QRCode.toDataURL(otpauth);
    return { secret, qr_data_url };
  }

  async confirmEnable(user: CurrentUser, code: string): Promise<void> {
    const r = await this.pool.query(
      `SELECT totp_secret FROM users WHERE id = $1`, [user.userId],
    );
    const secret = r.rows[0]?.totp_secret as string | null;
    if (!secret) throw new BadRequestException('No 2FA setup in progress');
    if (!authenticator.verify({ token: code, secret })) {
      throw new UnauthorizedException('Invalid code');
    }
    await this.pool.query(
      `UPDATE users SET totp_enabled_at = now() WHERE id = $1`, [user.userId],
    );
  }

  async disable(user: CurrentUser): Promise<void> {
    await this.pool.query(
      `UPDATE users SET totp_secret = NULL, totp_enabled_at = NULL WHERE id = $1`,
      [user.userId],
    );
  }

  /**
   * Called during login when the account has 2FA enabled. Returns true on a
   * valid code; we keep this as a service method so /auth/login can branch
   * to a "requires_2fa" response without an extra DB round-trip.
   */
  async verifyForLogin(userId: string, code: string): Promise<boolean> {
    const r = await this.pool.query(
      `SELECT totp_secret, totp_enabled_at FROM users WHERE id = $1`, [userId],
    );
    const row = r.rows[0];
    if (!row?.totp_secret || !row.totp_enabled_at) return false;
    return authenticator.verify({ token: code, secret: row.totp_secret });
  }

  /** Helper: true iff this user requires 2FA on login. */
  async requires2fa(userId: string): Promise<boolean> {
    const r = await this.pool.query(
      `SELECT totp_enabled_at IS NOT NULL AS req FROM users WHERE id = $1`,
      [userId],
    );
    return r.rows[0]?.req === true;
  }
}

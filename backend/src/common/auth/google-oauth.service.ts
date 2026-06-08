import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { Pool } from 'pg';
import { PG_POOL } from '../db/db.module';

export interface VerifiedGoogleUser {
  id:        string;
  email:     string;
  full_name: string;
  org_id:    string;
}

/**
 * Google "Sign in with Google" via ID token verification.
 *
 * Flow (frontend handles the popup using Google Identity Services):
 *   1. Frontend opens the GIS popup; user authenticates with Google.
 *   2. Google returns an ID token to the frontend.
 *   3. Frontend POSTs that token to /auth/oauth/google { id_token }.
 *   4. We verify the token against Google's certs, extract `email`, and
 *      LOOK UP a matching user in our DB. We do NOT auto-provision —
 *      a NIRVAPROCURE admin must create the account first. This matches
 *      enterprise expectations and avoids invite-spoofing.
 *
 * The matched account then goes through the normal JWT issuance path.
 */
@Injectable()
export class GoogleOAuthService {
  private client = new OAuth2Client();

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async verifyAndMatch(idToken: string): Promise<VerifiedGoogleUser> {
    const audience = process.env.GOOGLE_OAUTH_CLIENT_ID;
    if (!audience) {
      throw new UnauthorizedException('Google OAuth not configured');
    }
    let payload;
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }
    const email = payload?.email;
    if (!email || !payload?.email_verified) {
      throw new UnauthorizedException('Google email not verified');
    }
    // Optional domain pinning (per-org SSO): allow only emails from specific
    // domains. Useful for "everyone at nirva.co.th can sign in with Google"
    // without per-user provisioning. Comma-separated env value.
    const allowed = (process.env.GOOGLE_OAUTH_ALLOWED_DOMAINS ?? '')
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    if (allowed.length > 0) {
      const domain = email.split('@')[1]?.toLowerCase();
      if (!domain || !allowed.includes(domain)) {
        throw new UnauthorizedException('Email domain not allowed');
      }
    }
    const r = await this.pool.query(
      `SELECT id, org_id, email, full_name, is_active
       FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email],
    );
    if (r.rowCount === 0) throw new UnauthorizedException('Account not found — ask an admin to invite you');
    const u = r.rows[0];
    if (!u.is_active) throw new UnauthorizedException('Account disabled');
    return { id: u.id, email: u.email, full_name: u.full_name, org_id: u.org_id };
  }
}

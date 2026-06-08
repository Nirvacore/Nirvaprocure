import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { Pool } from 'pg';
import { PG_POOL } from '../../common/db/db.module';

export interface PortalContext {
  org_id: string;
  supplier_id: string;
  supplier_name: string;
  expires_at: string;
}

export interface PortalLineRow {
  pr_id: string;
  pr_number: string;
  pr_title: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price_minor: number;
  line_total_minor: number;
  status: string;
}

/**
 * Supplier-side surface: no JWT, no NIRVAPROCURE user account.
 * Auth is via a URL-embedded opaque token; we hash + lookup, validate
 * expiry, return scoped data (only this supplier's PR lines).
 *
 * Tokens never leave the DB in plaintext. The raw value is shown to the
 * admin exactly once when issued; rotate by issuing a new one.
 */
@Injectable()
export class PortalService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Generates a fresh portal token. Caller logs the raw token and emails it. */
  async issueToken(opts: {
    org_id: string;
    supplier_id: string;
    created_by_user_id: string;
    label?: string;
    ttl_days?: number;
  }): Promise<{ token: string; expires_at: string }> {
    const raw = randomBytes(32).toString('base64url');
    const hash = sha256(raw);
    const ttlDays = opts.ttl_days ?? 30;
    const r = await this.pool.query<{ expires_at: string }>(
      `INSERT INTO supplier_portal_tokens
         (org_id, supplier_id, token_hash, label, expires_at, created_by)
       VALUES ($1, $2, $3, $4, now() + ($5 || ' days')::interval, $6)
       RETURNING expires_at`,
      [opts.org_id, opts.supplier_id, hash, opts.label ?? null, String(ttlDays), opts.created_by_user_id],
    );
    return { token: raw, expires_at: r.rows[0].expires_at };
  }

  /** Resolves a token to its supplier context; throws if expired/revoked. */
  async resolve(token: string): Promise<PortalContext> {
    const hash = sha256(token);
    const r = await this.pool.query(
      `SELECT t.org_id, t.supplier_id, t.expires_at, t.revoked_at,
              s.name AS supplier_name
       FROM supplier_portal_tokens t
       JOIN suppliers s ON s.id = t.supplier_id
       WHERE t.token_hash = $1`,
      [hash],
    );
    if (r.rowCount === 0) throw new NotFoundException('Invalid portal link');
    const row = r.rows[0];
    if (row.revoked_at)                     throw new ForbiddenException('Link revoked');
    if (new Date(row.expires_at) < new Date()) throw new ForbiddenException('Link expired');

    // Best-effort last_used bookkeeping; doesn't need to be in a tx.
    void this.pool.query(
      `UPDATE supplier_portal_tokens SET last_used_at = now() WHERE token_hash = $1`,
      [hash],
    );

    return {
      org_id: row.org_id,
      supplier_id: row.supplier_id,
      supplier_name: row.supplier_name,
      expires_at: row.expires_at,
    };
  }

  /** Returns PR lines assigned to this supplier across all open PRs. */
  async listLinesForSupplier(ctx: PortalContext): Promise<PortalLineRow[]> {
    const r = await this.pool.query<PortalLineRow>(
      `SELECT pr.id AS pr_id, pr.pr_number, pr.title AS pr_title,
              pri.description, pri.quantity::float AS quantity, pri.unit,
              pri.unit_price_minor::bigint AS unit_price_minor,
              pri.line_total_minor::bigint AS line_total_minor,
              pr.status
       FROM purchase_request_items pri
       JOIN purchase_requests pr ON pr.id = pri.pr_id
       WHERE pri.supplier_id = $1
         AND pri.org_id = $2
         AND pr.status IN ('approved', 'in_approval', 'completed')
         AND pr.deleted_at IS NULL
       ORDER BY pr.submitted_at DESC NULLS LAST
       LIMIT 100`,
      [ctx.supplier_id, ctx.org_id],
    );
    return r.rows;
  }

  /**
   * Supplier acknowledges receipt of one PR. We don't change the PR status
   * (that belongs to the buyer's flow); instead we drop an audit_log entry
   * the buyer can read.
   */
  async acknowledge(ctx: PortalContext, prId: string, note?: string) {
    const valid = await this.pool.query(
      `SELECT 1 FROM purchase_request_items
       WHERE pr_id = $1 AND supplier_id = $2 AND org_id = $3`,
      [prId, ctx.supplier_id, ctx.org_id],
    );
    if (valid.rowCount === 0) throw new NotFoundException();

    await this.pool.query(
      `INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, diff)
       VALUES ($1, NULL, 'portal.supplier_ack', 'purchase_request', $2, $3)`,
      [ctx.org_id, prId, JSON.stringify({ supplier_id: ctx.supplier_id, note: note ?? null })],
    );
    return { ok: true };
  }
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

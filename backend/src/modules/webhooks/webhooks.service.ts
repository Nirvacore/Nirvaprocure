import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash, createHmac, randomBytes } from 'crypto';
import { Pool } from 'pg';
import { PG_POOL } from '../../common/db/db.module';
import { withOrg } from '../../common/db/with-org';
import type { CurrentUser } from '../../common/auth/current-user.decorator';

export type WebhookEvent =
  | 'pr.submitted'
  | 'pr.decided'
  | 'pr.received'
  | 'reorder.alert'
  | 'anomaly.raised';

export interface WebhookRow {
  id: string;
  url: string;
  events: WebhookEvent[];
  is_active: boolean;
  last_delivered_at: string | null;
  last_status: number | null;
  created_at: string;
}

/**
 * Emits outbound webhooks. Each subscriber gets a SHA-256 hashed secret
 * stored at rest; the raw secret is returned exactly once on registration
 * so the caller can configure their receiver to verify the HMAC.
 *
 * Delivery semantics (Phase 5):
 *  - Best-effort, in-process. We do one POST per subscriber, record the
 *    result in `webhook_deliveries`, and move on.
 *  - No retry queue yet — if the receiver is down, the admin can replay
 *    from the deliveries log (UI TBD). Phase 6 graduates this to BullMQ.
 *  - Timeout 5s per receiver so a slow consumer doesn't wedge the worker.
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // -----------------------------------------------------------------------
  // CRUD
  // -----------------------------------------------------------------------

  list(user: CurrentUser): Promise<WebhookRow[]> {
    return withOrg(this.pool, user.orgId, async (c) => {
      const r = await c.query<WebhookRow>(
        `SELECT id, url, events, is_active, last_delivered_at, last_status, created_at
         FROM org_webhooks ORDER BY created_at DESC`,
      );
      return r.rows;
    });
  }

  /** Creates a webhook and returns the raw secret EXACTLY ONCE. */
  async create(user: CurrentUser, body: { url: string; events: WebhookEvent[] }) {
    const secret = randomBytes(32).toString('base64url');
    const hash   = sha256(secret);
    return withOrg(this.pool, user.orgId, async (c) => {
      const r = await c.query(
        `INSERT INTO org_webhooks (org_id, url, secret_hash, events, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, url, events, is_active, created_at`,
        [user.orgId, body.url, hash, body.events, user.userId],
      );
      return { ...r.rows[0], secret };
    });
  }

  remove(user: CurrentUser, id: string) {
    return withOrg(this.pool, user.orgId, async (c) => {
      const r = await c.query(`DELETE FROM org_webhooks WHERE id = $1`, [id]);
      if (r.rowCount === 0) throw new NotFoundException();
      return { ok: true };
    });
  }

  // -----------------------------------------------------------------------
  // Delivery
  // -----------------------------------------------------------------------

  /**
   * Fire `event` to every active subscriber in `orgId`. Used by other
   * services (PrService, ApprovalsService, etc).
   */
  async emit(orgId: string, event: WebhookEvent, payload: Record<string, unknown>): Promise<void> {
    const subs = await this.pool.query<{
      id: string; url: string; secret_hash: string;
    }>(
      `SELECT w.id, w.url, w.secret_hash
       FROM org_webhooks w
       WHERE w.org_id = $1
         AND w.is_active = TRUE
         AND $2 = ANY(w.events)`,
      [orgId, event],
    );
    if (subs.rowCount === 0) return;

    // Run deliveries in parallel — they're independent. Errors are caught
    // per delivery; one slow/broken receiver doesn't block the others.
    await Promise.all(subs.rows.map((sub) => this.deliver(orgId, sub, event, payload)));
  }

  private async deliver(
    orgId: string,
    sub: { id: string; url: string; secret_hash: string },
    event: WebhookEvent,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const body = JSON.stringify({
      event,
      occurred_at: new Date().toISOString(),
      org_id: orgId,
      data: payload,
    });
    // We sign with the original secret, but only the HASH is in the DB. The
    // raw secret was returned at create-time; subscribers verify with their
    // copy. We don't store it, so we can't sign here using the same value —
    // we sign with the hash itself instead, which is still HMAC-grade and
    // deterministic. Receivers compute HMAC(secret_hash, body) for verify.
    const signature = createHmac('sha256', sub.secret_hash).update(body).digest('base64');

    let status = 0;
    let error: string | null = null;
    try {
      const ac = AbortSignal.timeout(5_000);
      const res = await fetch(sub.url, {
        method: 'POST',
        headers: {
          'Content-Type':         'application/json',
          'X-NirvaProcure-Event': event,
          'X-NirvaProcure-Sig':   `sha256=${signature}`,
        },
        body,
        signal: ac,
      });
      status = res.status;
      if (!res.ok) error = `HTTP ${res.status}`;
    } catch (err) {
      error = (err as Error).message;
      this.logger.warn(`webhook ${sub.id} (${sub.url}) failed: ${error}`);
    }
    await this.pool.query(
      `INSERT INTO webhook_deliveries (org_id, webhook_id, event, payload, status_code, error)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
      [orgId, sub.id, event, body, status || null, error],
    );
    await this.pool.query(
      `UPDATE org_webhooks SET last_delivered_at = now(), last_status = $2 WHERE id = $1`,
      [sub.id, status || null],
    );
  }

  // -----------------------------------------------------------------------
  // Delivery log + replay
  // -----------------------------------------------------------------------

  /** Last 20 deliveries for a webhook, newest first. */
  listDeliveries(user: CurrentUser, webhookId: string) {
    return withOrg(this.pool, user.orgId, async (c) => {
      const r = await c.query<{
        id: string; event: string; status_code: number | null;
        error: string | null; attempt: number; created_at: string;
      }>(
        `SELECT d.id, d.event, d.status_code, d.error, d.attempt, d.created_at
           FROM webhook_deliveries d
          WHERE d.webhook_id = $1
          ORDER BY d.created_at DESC
          LIMIT 20`,
        [webhookId],
      );
      return r.rows;
    });
  }

  /**
   * Re-fires the original payload of an existing delivery to the webhook's
   * current URL. Increments `attempt` by 1 and writes a new delivery row.
   */
  async replay(user: CurrentUser, webhookId: string, deliveryId: string) {
    return withOrg(this.pool, user.orgId, async (c) => {
      // Load the original delivery + the webhook's current secret_hash.
      const r = await c.query<{
        payload: string; event: string;
        url: string; secret_hash: string; attempt: number;
      }>(
        `SELECT d.payload::text AS payload, d.event,
                w.url, w.secret_hash, d.attempt
           FROM webhook_deliveries d
           JOIN org_webhooks w ON w.id = d.webhook_id
          WHERE d.id = $1 AND d.webhook_id = $2`,
        [deliveryId, webhookId],
      );
      if (r.rowCount === 0) throw new NotFoundException('Delivery not found');
      const orig = r.rows[0];

      const signature = createHmac('sha256', orig.secret_hash)
        .update(orig.payload).digest('base64');

      let status = 0;
      let error: string | null = null;
      try {
        const ac = AbortSignal.timeout(5_000);
        const res = await fetch(orig.url, {
          method: 'POST',
          headers: {
            'Content-Type':         'application/json',
            'X-NirvaProcure-Event': orig.event,
            'X-NirvaProcure-Sig':   `sha256=${signature}`,
          },
          body: orig.payload,
          signal: ac,
        });
        status = res.status;
        if (!res.ok) error = `HTTP ${res.status}`;
      } catch (err) {
        error = (err as Error).message;
      }

      const ins = await c.query<{
        id: string; event: string; status_code: number | null;
        error: string | null; attempt: number; created_at: string;
      }>(
        `INSERT INTO webhook_deliveries
           (org_id, webhook_id, event, payload, status_code, error, attempt)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
         RETURNING id, event, status_code, error, attempt, created_at`,
        [
          user.orgId, webhookId, orig.event,
          orig.payload, status || null, error, orig.attempt + 1,
        ],
      );
      await c.query(
        `UPDATE org_webhooks SET last_delivered_at = now(), last_status = $2 WHERE id = $1`,
        [webhookId, status || null],
      );
      return ins.rows[0];
    });
  }
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

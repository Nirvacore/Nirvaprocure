import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Pool } from 'pg';
import { PG_POOL } from '../../common/db/db.module';
import { LineNotifier } from '../notifications/line.notifier';

/**
 * Daily scan that finds items below their reorder point and:
 *   1. Records a NirvaAI suggestion entry per item below threshold (TODO once
 *      `ai_suggestions` table lands — for now we just notify).
 *   2. Sends a single LINE digest to each org's stock manager so they don't
 *      get 30 separate pings on Monday mornings.
 *
 * Throttled per (item, warehouse): we don't re-alert within 24h (tracked via
 * `reorder_rules.last_alerted_at` so the cron stays idempotent).
 *
 * Scope: scans across ALL orgs in one pass. RLS doesn't apply because the
 * job uses the raw pool client — it's a background worker, not a request.
 */
@Injectable()
export class ReorderScanJob {
  private readonly logger = new Logger(ReorderScanJob.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly line: LineNotifier,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM, { timeZone: 'Asia/Bangkok' })
  async scan() {
    this.logger.log('Starting reorder scan');

    const flagged = await this.pool.query<{
      org_id: string; item_id: string; warehouse_id: string;
      sku: string; item_name: string; warehouse_name: string;
      qty: number; reorder_point: number; reorder_qty: number;
    }>(
      `SELECT
         rr.org_id, rr.item_id, rr.warehouse_id,
         i.sku, i.name AS item_name, w.name AS warehouse_name,
         soh.qty, rr.reorder_point, rr.reorder_qty
       FROM reorder_rules rr
       JOIN stock_on_hand soh
         ON soh.item_id = rr.item_id AND soh.warehouse_id = rr.warehouse_id
       JOIN items i      ON i.id = rr.item_id
       JOIN warehouses w ON w.id = rr.warehouse_id
       WHERE soh.qty <= rr.reorder_point
         AND (rr.last_alerted_at IS NULL OR rr.last_alerted_at < now() - interval '24 hours')`,
    );

    if (flagged.rowCount === 0) {
      this.logger.log('No items below reorder point');
      return;
    }

    // Mark them alerted before we send so a transient send failure doesn't
    // cause a re-alert on the next run. Send-failure retries belong to the
    // notification queue, not this cron.
    await this.pool.query(
      `UPDATE reorder_rules SET last_alerted_at = now()
       WHERE (item_id, warehouse_id) IN (
         SELECT unnest($1::uuid[]), unnest($2::uuid[])
       )`,
      [
        flagged.rows.map((r) => r.item_id),
        flagged.rows.map((r) => r.warehouse_id),
      ],
    );

    // Group by org so each org's stock manager gets one digest, not N.
    const byOrg = new Map<string, typeof flagged.rows>();
    for (const row of flagged.rows) {
      const list = byOrg.get(row.org_id) ?? [];
      list.push(row);
      byOrg.set(row.org_id, list);
    }

    for (const [orgId, items] of byOrg) {
      // "Stock manager" for Phase 2 = any user with role name = 'admin'.
      // Production should add a dedicated 'stock_manager' role.
      const mgr = await this.pool.query(
        `SELECT u.id FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r       ON r.id = ur.role_id
         WHERE u.org_id = $1 AND r.name = 'admin' AND u.is_active = TRUE
         LIMIT 1`,
        [orgId],
      );
      if (mgr.rowCount === 0) {
        this.logger.warn(`Org ${orgId} has ${items.length} low-stock items but no admin to notify`);
        continue;
      }
      await this.line.send({
        user_id:  mgr.rows[0].id,
        org_id:   orgId,
        template: 'reorder_digest',
        payload: {
          count: items.length,
          // Top-3 sample so the chat preview is readable.
          sample: items.slice(0, 3).map((r) => ({
            sku: r.sku, name: r.item_name, qty: r.qty, reorder_point: r.reorder_point,
          })),
        },
      });
    }

    this.logger.log(`Reorder scan: ${flagged.rowCount} items flagged across ${byOrg.size} orgs`);
  }
}

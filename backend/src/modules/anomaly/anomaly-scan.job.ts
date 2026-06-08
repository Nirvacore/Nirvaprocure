import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Pool } from 'pg';
import { PG_POOL } from '../../common/db/db.module';
import { AnomalyService } from './anomaly.service';
import { SupplierRiskService } from './supplier-risk.service';
import { LineNotifier } from '../notifications/line.notifier';

/**
 * Detection jobs that don't fit inline in the request path:
 *
 *  - PRICE SPIKE: any approved PR line whose unit price is > 1.5× the
 *    90-day median for the same item description.
 *  - NEW SUPPLIER: PR submitted against a supplier with no prior approved
 *    POs in this org.
 *
 * Runs daily — the 24-hour lag is fine because both anomalies are about
 * patterns, not immediate decisions. CoI alerts fire inline at submit time.
 */
@Injectable()
export class AnomalyScanJob {
  private readonly logger = new Logger(AnomalyScanJob.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly anomaly: AnomalyService,
    private readonly risk: SupplierRiskService,
    private readonly line: LineNotifier,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM, { timeZone: 'Asia/Bangkok' })
  async scan() {
    this.logger.log('Starting anomaly scan');

    // PRICE SPIKE — runs across all orgs in one query, then groups results.
    const spikes = await this.pool.query<{
      org_id: string; pr_id: string; pr_number: string; line_no: number;
      description: string; unit_price_minor: string; median_minor: string; multiplier: string;
    }>(
      `WITH median90 AS (
         SELECT pri.org_id, pri.description,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY pri.unit_price_minor) AS m
         FROM purchase_request_items pri
         JOIN purchase_requests pr ON pr.id = pri.pr_id
         WHERE pr.status IN ('approved','completed')
           AND pr.decided_at >= now() - interval '90 days'
         GROUP BY pri.org_id, pri.description
         HAVING COUNT(*) >= 5             -- need >=5 samples to flag a spike
       )
       SELECT pr.org_id, pr.id AS pr_id, pr.pr_number,
              pri.line_no, pri.description,
              pri.unit_price_minor::text,
              m.m::text                                       AS median_minor,
              (pri.unit_price_minor::numeric / m.m)::text     AS multiplier
       FROM purchase_request_items pri
       JOIN purchase_requests pr ON pr.id = pri.pr_id
       JOIN median90 m           ON m.description = pri.description AND m.org_id = pri.org_id
       WHERE pr.status IN ('approved','completed')
         AND pr.decided_at >= now() - interval '24 hours'
         AND pri.unit_price_minor > (m.m * 1.5)`,
    );

    for (const row of spikes.rows) {
      await this.anomaly.record({
        org_id: row.org_id,
        kind: 'price_spike',
        severity: Number(row.multiplier) > 2.5 ? 'critical' : 'warning',
        subject_type: 'purchase_request',
        subject_id: row.pr_id,
        details: {
          pr_number:   row.pr_number,
          line_no:     row.line_no,
          description: row.description,
          unit_price_minor: Number(row.unit_price_minor),
          median_90d_minor: Number(row.median_minor),
          multiplier:  Number(row.multiplier).toFixed(2),
        },
      });
    }

    // NEW SUPPLIER — first appearance of a supplier on an approved PR in
    // this org's history (excluding the current 24h window where we want to
    // flag).
    const newSuppliers = await this.pool.query<{
      org_id: string; pr_id: string; pr_number: string; supplier_id: string; supplier_name: string;
    }>(
      `SELECT DISTINCT pr.org_id, pr.id AS pr_id, pr.pr_number,
              pri.supplier_id, s.name AS supplier_name
       FROM purchase_request_items pri
       JOIN purchase_requests pr ON pr.id = pri.pr_id
       JOIN suppliers s          ON s.id = pri.supplier_id
       WHERE pr.status IN ('approved','completed')
         AND pr.decided_at >= now() - interval '24 hours'
         AND NOT EXISTS (
           SELECT 1
           FROM purchase_request_items pri2
           JOIN purchase_requests pr2 ON pr2.id = pri2.pr_id
           WHERE pri2.supplier_id = pri.supplier_id
             AND pr2.org_id = pr.org_id
             AND pr2.id != pr.id
             AND pr2.status IN ('approved','completed')
             AND pr2.decided_at < now() - interval '24 hours'
         )`,
    );

    for (const row of newSuppliers.rows) {
      await this.anomaly.record({
        org_id: row.org_id,
        kind: 'new_supplier',
        severity: 'info',
        subject_type: 'purchase_request',
        subject_id: row.pr_id,
        details: {
          pr_number:     row.pr_number,
          supplier_id:   row.supplier_id,
          supplier_name: row.supplier_name,
        },
      });
    }

    // Per-org digest to admin via LINE.
    const orgs = new Set([
      ...spikes.rows.map((r) => r.org_id),
      ...newSuppliers.rows.map((r) => r.org_id),
    ]);
    for (const orgId of orgs) {
      const count =
        spikes.rows.filter((r) => r.org_id === orgId).length +
        newSuppliers.rows.filter((r) => r.org_id === orgId).length;
      if (count === 0) continue;
      const admin = await this.pool.query(
        `SELECT u.id FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r       ON r.id = ur.role_id
         WHERE u.org_id = $1 AND r.name = 'admin' AND u.is_active = TRUE
         LIMIT 1`, [orgId],
      );
      if (admin.rowCount === 0) continue;
      await this.line.send({
        user_id:  admin.rows[0].id,
        org_id:   orgId,
        template: 'reorder_digest',                // reuse the bare-text template
        payload:  { count, kind: 'anomaly' },
      });
    }

    // Supplier risk scores — recompute all orgs after anomaly data is fresh.
    const scored = await this.risk.compute(null);
    this.logger.log(`Anomaly scan: ${spikes.rowCount} spikes, ${newSuppliers.rowCount} new suppliers across ${orgs.size} orgs; ${scored} supplier risk scores updated`);
  }
}

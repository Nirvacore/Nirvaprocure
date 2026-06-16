import { Inject, Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../common/db/db.module';
import { withOrg } from '../../common/db/with-org';
import type { CurrentUser } from '../../common/auth/current-user.decorator';

export type RiskTier = 'low' | 'medium' | 'high' | 'critical';

export interface SupplierRiskRow {
  supplier_id:   string;
  supplier_name: string;
  score:         number;
  tier:          RiskTier;
  factors: {
    spend_minor:      number;
    spend_pct:        number;   // % of org's 90-day approved spend
    price_cov:        number;   // Coefficient of variation (price std / mean) × 100
    rejection_rate:   number;   // % of PRs with this supplier that were rejected
    has_coi:          boolean;
    anomaly_count_90d: number;
  };
  computed_at: string;
}

function scoreToTier(score: number): RiskTier {
  if (score <= 30) return 'low';
  if (score <= 55) return 'medium';
  if (score <= 75) return 'high';
  return 'critical';
}

/**
 * Multi-signal supplier risk scoring.
 *
 * Five factors, each normalised 0–1, weighted to a 0–100 composite score:
 *
 *  | Factor               | Weight | 100% threshold          |
 *  |----------------------|--------|-------------------------|
 *  | Spend concentration  |   30 % | ≥ 50% of org spend      |
 *  | Price volatility     |   20 % | CoV ≥ 30%               |
 *  | Rejection rate       |   20 % | ≥ 20% PRs rejected      |
 *  | Conflict-of-interest |   20 % | any disclosure on file  |
 *  | Anomaly history      |   10 % | ≥ 5 alerts in 90 days   |
 *
 * Scores are computed in a single SQL pass over the last 90 days and upserted
 * into `supplier_risk_scores`. Suppliers with < 2 approved PRs in 90 days are
 * skipped (not enough data to score reliably).
 *
 * Tier:  0–30 = low · 31–55 = medium · 56–75 = high · 76–100 = critical
 */
@Injectable()
export class SupplierRiskService {
  private readonly logger = new Logger(SupplierRiskService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // -------------------------------------------------------------------------
  // Query
  // -------------------------------------------------------------------------

  /** Latest scores for the calling user's org, ordered highest risk first. */
  list(user: CurrentUser): Promise<SupplierRiskRow[]> {
    return withOrg(this.pool, user.orgId, async (c) => {
      const r = await c.query<Omit<SupplierRiskRow, 'factors'> & { factors: string }>(
        `SELECT srs.supplier_id, s.name AS supplier_name,
                srs.score, srs.tier, srs.factors, srs.computed_at
           FROM supplier_risk_scores srs
           JOIN suppliers s ON s.id = srs.supplier_id
          WHERE srs.org_id = $1
          ORDER BY srs.score DESC
          LIMIT 50`,
        [user.orgId],
      );
      return r.rows.map((row) => ({
        ...row,
        score: Number(row.score),
        factors: typeof row.factors === 'string'
          ? JSON.parse(row.factors)
          : row.factors,
      })) as SupplierRiskRow[];
    });
  }

  /** Risk score for a single supplier. Returns null if not yet scored. */
  getForSupplier(user: CurrentUser, supplierId: string): Promise<SupplierRiskRow | null> {
    return withOrg(this.pool, user.orgId, async (c) => {
      const r = await c.query<Omit<SupplierRiskRow, 'factors'> & { factors: string }>(
        `SELECT srs.supplier_id, s.name AS supplier_name,
                srs.score, srs.tier, srs.factors, srs.computed_at
           FROM supplier_risk_scores srs
           JOIN suppliers s ON s.id = srs.supplier_id
          WHERE srs.org_id = $1 AND srs.supplier_id = $2`,
        [user.orgId, supplierId],
      );
      if (r.rowCount === 0) return null;
      const row = r.rows[0];
      return {
        ...row,
        score: Number(row.score),
        factors: typeof row.factors === 'string'
          ? JSON.parse(row.factors)
          : row.factors,
      } as SupplierRiskRow;
    });
  }

  // -------------------------------------------------------------------------
  // Compute
  // -------------------------------------------------------------------------

  /**
   * Compute (or recompute) risk scores for a single org and upsert results.
   * Pass null to recompute ALL orgs (used by the daily cron).
   */
  async compute(orgId: string | null): Promise<number> {
    const orgFilter = orgId ? `AND pr.org_id = '${orgId}'::uuid` : '';
    const orgFilterCoi = orgId ? `AND d.org_id = '${orgId}'::uuid` : '';
    const orgFilterAnomaly = orgId ? `AND a.org_id = '${orgId}'::uuid` : '';

    const scored = await this.pool.query<{
      org_id: string;
      supplier_id: string;
      score: number;
      factors: Record<string, unknown>;
    }>(`
      WITH spend AS (
        SELECT pri.supplier_id, pr.org_id,
               SUM(pri.unit_price_minor::bigint * pri.quantity) AS supplier_spend
          FROM purchase_request_items pri
          JOIN purchase_requests pr ON pr.id = pri.pr_id
         WHERE pr.status IN ('approved', 'completed')
           AND pr.decided_at >= now() - interval '90 days'
           ${orgFilter}
         GROUP BY pri.supplier_id, pr.org_id
      ),
      total_spend AS (
        SELECT org_id, SUM(supplier_spend) AS total
          FROM spend GROUP BY org_id
      ),
      price_stats AS (
        SELECT pri.supplier_id, pr.org_id,
               COALESCE(stddev(pri.unit_price_minor), 0)    AS price_std,
               COALESCE(avg(pri.unit_price_minor), 1)        AS price_mean,
               COUNT(DISTINCT pr.id)                         AS pr_count
          FROM purchase_request_items pri
          JOIN purchase_requests pr ON pr.id = pri.pr_id
         WHERE pr.status IN ('approved', 'completed', 'rejected')
           AND pr.decided_at >= now() - interval '90 days'
           ${orgFilter}
         GROUP BY pri.supplier_id, pr.org_id
        HAVING COUNT(DISTINCT pr.id) >= 2
      ),
      rejections AS (
        SELECT pri.supplier_id, pr.org_id,
               COUNT(*) FILTER (WHERE pr.status = 'rejected') AS rejected,
               COUNT(*)                                        AS total
          FROM purchase_request_items pri
          JOIN purchase_requests pr ON pr.id = pri.pr_id
         WHERE pr.decided_at >= now() - interval '90 days'
           ${orgFilter}
         GROUP BY pri.supplier_id, pr.org_id
      ),
      coi AS (
        SELECT DISTINCT supplier_id, org_id
          FROM user_supplier_disclosures d
         WHERE TRUE ${orgFilterCoi}
      ),
      anomalies AS (
        SELECT (a.details->>'supplier_id')::uuid AS supplier_id, a.org_id,
               COUNT(*) AS cnt
          FROM anomaly_alerts a
         WHERE a.created_at >= now() - interval '90 days'
           AND a.details->>'supplier_id' IS NOT NULL
           ${orgFilterAnomaly}
         GROUP BY 1, 2
      )
      SELECT
        s.org_id,
        s.supplier_id,
        LEAST(100, ROUND(
          30.0 * LEAST(1.0, (s.supplier_spend::float / NULLIF(ts.total, 0)) / 0.5)
        + 20.0 * LEAST(1.0, (ps.price_std::float  / NULLIF(ps.price_mean, 1)) / 0.3)
        + 20.0 * LEAST(1.0, (COALESCE(r.rejected, 0)::float / NULLIF(r.total, 1)) / 0.2)
        + 20.0 * CASE WHEN c.supplier_id IS NOT NULL THEN 1.0 ELSE 0.0 END
        + 10.0 * LEAST(1.0, COALESCE(a.cnt, 0)::float / 5.0)
        )::int) AS score,
        jsonb_build_object(
          'spend_minor',       s.supplier_spend,
          'spend_pct',         ROUND((s.supplier_spend::numeric / NULLIF(ts.total, 0)) * 100, 1),
          'price_cov',         ROUND((ps.price_std::numeric / NULLIF(ps.price_mean, 1)) * 100, 1),
          'rejection_rate',    ROUND((COALESCE(r.rejected, 0)::numeric / NULLIF(r.total, 1)) * 100, 1),
          'has_coi',           (c.supplier_id IS NOT NULL),
          'anomaly_count_90d', COALESCE(a.cnt, 0)
        ) AS factors
      FROM spend s
      JOIN total_spend   ts ON ts.org_id = s.org_id
      JOIN price_stats   ps ON ps.supplier_id = s.supplier_id AND ps.org_id = s.org_id
      LEFT JOIN rejections r ON r.supplier_id = s.supplier_id AND r.org_id = s.org_id
      LEFT JOIN coi          c ON c.supplier_id = s.supplier_id AND c.org_id = s.org_id
      LEFT JOIN anomalies     a ON a.supplier_id = s.supplier_id AND a.org_id = s.org_id
    `);

    if (scored.rowCount === 0) {
      this.logger.log('SupplierRisk: no scoreable suppliers found');
      return 0;
    }

    // Bulk upsert — one round-trip.
    const values = scored.rows.map((r) => ({
      org_id:      r.org_id,
      supplier_id: r.supplier_id,
      score:       Number(r.score),
      tier:        scoreToTier(Number(r.score)),
      factors:     typeof r.factors === 'string' ? r.factors : JSON.stringify(r.factors),
    }));

    // Build parameterised multi-row upsert.
    const params: unknown[] = [];
    const rows = values.map((v, i) => {
      const base = i * 5;
      params.push(v.org_id, v.supplier_id, v.score, v.tier, v.factors);
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}::jsonb, now())`;
    }).join(', ');

    await this.pool.query(
      `INSERT INTO supplier_risk_scores (org_id, supplier_id, score, tier, factors, computed_at)
       VALUES ${rows}
       ON CONFLICT (org_id, supplier_id) DO UPDATE
         SET score = EXCLUDED.score,
             tier  = EXCLUDED.tier,
             factors     = EXCLUDED.factors,
             computed_at = EXCLUDED.computed_at`,
      params,
    );

    this.logger.log(`SupplierRisk: scored ${values.length} suppliers (orgId=${orgId ?? 'all'})`);
    return values.length;
  }
}

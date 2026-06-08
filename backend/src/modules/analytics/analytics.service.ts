import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../common/db/db.module';
import { withOrg } from '../../common/db/with-org';
import type { CurrentUser } from '../../common/auth/current-user.decorator';

export interface AnalyticsSummary {
  /** Month boundary (ISO date) the rollups are scoped to. */
  month_start: string;
  /** Counts of PRs by status, MTD. */
  pr_counts: Record<string, number>;
  /** Total approved spend in minor units, MTD. */
  approved_spend_minor: number;
  /** Average hours from submission → final decision, MTD. */
  avg_approval_hours: number | null;
  /** Top suppliers by spend, MTD. */
  top_suppliers: { name: string; spend_minor: number; po_count: number }[];
  /**
   * Spend per department, MTD. Sorted by spend desc.
   * `department` is null when the PR has no department; the frontend renders
   * a localized "Unspecified" label in the viewer's language.
   */
  by_department: { department: string | null; spend_minor: number; pr_count: number }[];
}

/**
 * Month-to-date rollup over PRs. All queries are scoped through `withOrg`
 * so RLS enforces tenant isolation. The window is the current calendar
 * month in Asia/Bangkok — Phase 4 will expose configurable ranges.
 */
@Injectable()
export class AnalyticsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  summary(user: CurrentUser): Promise<AnalyticsSummary> {
    return withOrg(this.pool, user.orgId, async (c) => {
      // Compute month_start ourselves so we can return it to the client.
      const ms = await c.query<{ month_start: string }>(
        `SELECT date_trunc('month', now() AT TIME ZONE 'Asia/Bangkok')::date::text AS month_start`,
      );
      const monthStart = ms.rows[0].month_start;

      const countsP = c.query<{ status: string; n: string }>(
        `SELECT status, COUNT(*)::text AS n
         FROM purchase_requests
         WHERE deleted_at IS NULL AND created_at >= date_trunc('month', now())
         GROUP BY status`,
      );

      const spendP = c.query<{ total: string }>(
        `SELECT COALESCE(SUM(total_minor), 0)::text AS total
         FROM purchase_requests
         WHERE status IN ('approved', 'completed')
           AND deleted_at IS NULL
           AND created_at >= date_trunc('month', now())`,
      );

      const slaP = c.query<{ avg_hours: string | null }>(
        `SELECT EXTRACT(EPOCH FROM AVG(decided_at - submitted_at))::numeric / 3600 AS avg_hours
         FROM purchase_requests
         WHERE status IN ('approved', 'rejected')
           AND decided_at  IS NOT NULL
           AND submitted_at IS NOT NULL
           AND created_at >= date_trunc('month', now())`,
      );

      const suppliersP = c.query<{ name: string; spend_minor: string; po_count: string }>(
        `SELECT s.name,
                COALESCE(SUM(pri.unit_price_minor * pri.quantity), 0)::bigint::text AS spend_minor,
                COUNT(DISTINCT pri.pr_id)::text AS po_count
         FROM purchase_request_items pri
         JOIN suppliers s ON s.id = pri.supplier_id
         JOIN purchase_requests pr ON pr.id = pri.pr_id
         WHERE pr.status IN ('approved', 'completed')
           AND pr.created_at >= date_trunc('month', now())
         GROUP BY s.name
         ORDER BY spend_minor DESC
         LIMIT 5`,
      );

      // The "no department" group used to use a Thai literal here; we now
      // return NULL and let the frontend render a locale-aware label, so
      // analytics speak the viewer's language rather than always Thai.
      const byDeptP = c.query<{ department: string | null; spend_minor: string; pr_count: string }>(
        `SELECT d.name AS department,
                COALESCE(SUM(pr.total_minor), 0)::bigint::text AS spend_minor,
                COUNT(*)::text AS pr_count
         FROM purchase_requests pr
         LEFT JOIN departments d ON d.id = pr.department_id
         WHERE pr.status IN ('approved', 'completed')
           AND pr.created_at >= date_trunc('month', now())
         GROUP BY d.name
         ORDER BY spend_minor DESC`,
      );

      const [counts, spend, sla, suppliers, byDept] = await Promise.all([
        countsP, spendP, slaP, suppliersP, byDeptP,
      ]);

      const pr_counts: Record<string, number> = {};
      for (const row of counts.rows) pr_counts[row.status] = Number(row.n);

      return {
        month_start: monthStart,
        pr_counts,
        approved_spend_minor: Number(spend.rows[0].total),
        avg_approval_hours: sla.rows[0]?.avg_hours == null
          ? null
          : Number(sla.rows[0].avg_hours),
        top_suppliers: suppliers.rows.map((r) => ({
          name: r.name,
          spend_minor: Number(r.spend_minor),
          po_count: Number(r.po_count),
        })),
        by_department: byDept.rows.map((r) => ({
          department: r.department,
          spend_minor: Number(r.spend_minor),
          pr_count: Number(r.pr_count),
        })),
      };
    });
  }
}

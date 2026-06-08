import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Pool } from 'pg';
import { PG_POOL } from '../../common/db/db.module';
import { withOrg } from '../../common/db/with-org';
import type { CurrentUser } from '../../common/auth/current-user.decorator';

export interface LeaderboardRow {
  user_id: string;
  full_name: string;
  total_savings_minor: number;
  pr_count: number;
  rank: number;
  badges: string[];
}

/**
 * Computes per-line savings vs the 90-day median price for the same item
 * description, then aggregates per user. Runs as a daily cron AND on demand
 * (e.g. when admin opens the leaderboard).
 *
 * Why median vs lowest historical: lowest is brittle (a single fluke buy
 * makes future "savings" impossible). Median is the right anchor for
 * "you did better than typical".
 *
 * Anti-gaming: we cap savings at 50% of baseline per line to prevent a
 * buyer from inflating their score by intentionally over-paying once then
 * "saving" 90% the next time.
 */
@Injectable()
export class SavingsService {
  private readonly logger = new Logger(SavingsService.name);
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Cron entry — sweep newly-approved PRs and record savings rows.
   * Runs hourly so the leaderboard feels fresh; the SQL is cheap enough.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async recomputeAllOrgs() {
    const orgs = await this.pool.query<{ id: string }>(`SELECT id FROM organizations WHERE deleted_at IS NULL`);
    for (const { id } of orgs.rows) {
      try {
        await this.recompute(id);
      } catch (err) {
        this.logger.error(`savings recompute failed for org ${id}: ${(err as Error).message}`);
      }
    }
  }

  /**
   * One-org recompute. Idempotent — the INSERT … ON CONFLICT (pr_id, line_no)
   * makes re-running safe; we skip rows that have already been logged.
   */
  async recompute(orgId: string): Promise<{ rows_logged: number }> {
    return withOrg(this.pool, orgId, async (c) => {
      // For each (item description, approved PR within last 30 days),
      // compute the median 90-day price and persist the delta.
      const r = await c.query(
        `WITH median90 AS (
           SELECT pri.description,
                  percentile_cont(0.5) WITHIN GROUP (ORDER BY pri.unit_price_minor) AS median_minor
           FROM purchase_request_items pri
           JOIN purchase_requests pr ON pr.id = pri.pr_id
           WHERE pr.status IN ('approved','completed')
             AND pr.decided_at >= now() - interval '90 days'
           GROUP BY pri.description
           HAVING COUNT(*) >= 3                            -- need >=3 samples for a stable median
         )
         INSERT INTO user_savings_log
           (org_id, user_id, pr_id, line_no, baseline_minor, actual_minor, savings_minor, method)
         SELECT
           pr.org_id,
           pr.requester_id,
           pr.id,
           pri.line_no,
           m.median_minor::bigint,
           pri.unit_price_minor,
           LEAST(
             GREATEST(m.median_minor - pri.unit_price_minor, 0)::bigint,
             (m.median_minor * 0.5)::bigint     -- cap at 50% of baseline
           ),
           'median_90d'
         FROM purchase_request_items pri
         JOIN purchase_requests pr  ON pr.id = pri.pr_id
         JOIN median90 m            ON m.description = pri.description
         WHERE pr.status IN ('approved','completed')
           AND pr.decided_at >= now() - interval '30 days'
           AND pri.unit_price_minor < m.median_minor
         ON CONFLICT (pr_id, line_no) DO NOTHING`,
      );
      return { rows_logged: r.rowCount ?? 0 };
    });
  }

  /**
   * Top N users by savings in the current calendar month.
   */
  leaderboard(user: CurrentUser, limit = 10): Promise<LeaderboardRow[]> {
    return withOrg(this.pool, user.orgId, async (c) => {
      const r = await c.query<{
        user_id: string; full_name: string; total: string; pr_count: string; badges: string[];
      }>(
        `SELECT
           u.id   AS user_id,
           u.full_name,
           COALESCE(SUM(s.savings_minor), 0)::text AS total,
           COUNT(DISTINCT s.pr_id)::text           AS pr_count,
           COALESCE(ARRAY_AGG(DISTINCT b.badge_key) FILTER (WHERE b.badge_key IS NOT NULL), '{}') AS badges
         FROM users u
         LEFT JOIN user_savings_log s
           ON s.user_id = u.id AND s.computed_at >= date_trunc('month', now())
         LEFT JOIN user_badges b ON b.user_id = u.id
         WHERE u.deleted_at IS NULL AND u.is_active
         GROUP BY u.id, u.full_name
         HAVING COALESCE(SUM(s.savings_minor), 0) > 0
         ORDER BY SUM(s.savings_minor) DESC NULLS LAST
         LIMIT $1`,
        [limit],
      );
      return r.rows.map((row, i) => ({
        user_id: row.user_id,
        full_name: row.full_name,
        total_savings_minor: Number(row.total),
        pr_count: Number(row.pr_count),
        rank: i + 1,
        badges: row.badges ?? [],
      }));
    });
  }

  /**
   * Personal savings card for the home page — month-to-date totals for the
   * caller themselves. Fast, single-row query.
   */
  selfSummary(user: CurrentUser): Promise<{ savings_minor: number; pr_count: number; rank: number | null }> {
    return withOrg(this.pool, user.orgId, async (c) => {
      const totals = await c.query(
        `SELECT COALESCE(SUM(savings_minor), 0)::text AS total,
                COUNT(DISTINCT pr_id)::text           AS pr_count
         FROM user_savings_log
         WHERE user_id = $1 AND computed_at >= date_trunc('month', now())`,
        [user.userId],
      );
      // Rank by total this month.
      const rank = await c.query(
        `WITH t AS (
           SELECT user_id, SUM(savings_minor) AS s
           FROM user_savings_log
           WHERE computed_at >= date_trunc('month', now())
           GROUP BY user_id
         )
         SELECT rank FROM (
           SELECT user_id, RANK() OVER (ORDER BY s DESC) AS rank FROM t
         ) r WHERE user_id = $1`,
        [user.userId],
      );
      return {
        savings_minor: Number(totals.rows[0]?.total ?? 0),
        pr_count:      Number(totals.rows[0]?.pr_count ?? 0),
        rank:          rank.rows[0]?.rank ? Number(rank.rows[0].rank) : null,
      };
    });
  }
}

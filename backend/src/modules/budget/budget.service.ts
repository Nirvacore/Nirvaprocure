import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../common/db/db.module';
import { withOrg } from '../../common/db/with-org';
import type { CurrentUser } from '../../common/auth/current-user.decorator';

export interface BudgetRow {
  id: string;
  department_id: string;
  department_name: string;
  month_start: string;
  amount_minor: number;
  spent_minor: number;
  remaining_minor: number;
  pct_used: number;            // 0–100 (or > 100 when over)
  soft_block: boolean;
}

/**
 * Department-budget queries + the predicate PrService uses at submit time.
 *
 * Design:
 *  - We surface a "soft block" flag. The system NEVER outright refuses a PR
 *    that's over budget — exec sometimes needs to overspend. But submit-time
 *    we emit an anomaly + warn the requester in the response so it's
 *    impossible to hit it accidentally.
 */
@Injectable()
export class BudgetService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  list(user: CurrentUser, monthStart?: string): Promise<BudgetRow[]> {
    return withOrg(this.pool, user.orgId, async (c) => {
      const month = monthStart ?? new Date().toISOString().slice(0, 7) + '-01';
      const r = await c.query<BudgetRow & { amount_minor: string; spent_minor: string }>(
        `SELECT b.id,
                b.department_id,
                d.name              AS department_name,
                b.month_start::text AS month_start,
                b.amount_minor::text,
                b.spent_minor::text,
                b.soft_block
         FROM department_budgets b
         JOIN departments d ON d.id = b.department_id
         WHERE b.month_start = $1
         ORDER BY d.name`,
        [month],
      );
      return r.rows.map((row) => {
        const amount = Number(row.amount_minor);
        const spent  = Number(row.spent_minor);
        return {
          id: row.id,
          department_id: row.department_id,
          department_name: row.department_name,
          month_start: row.month_start,
          amount_minor: amount,
          spent_minor:  spent,
          remaining_minor: amount - spent,
          pct_used: amount === 0 ? 0 : Math.round((spent / amount) * 100),
          soft_block: row.soft_block,
        };
      });
    });
  }

  /** Admin sets/updates the monthly cap. month_start defaults to current month. */
  upsert(user: CurrentUser, body: {
    department_id: string;
    amount_minor: number;
    month_start?: string;
    soft_block?: boolean;
  }) {
    return withOrg(this.pool, user.orgId, async (c) => {
      const month = body.month_start ?? new Date().toISOString().slice(0, 7) + '-01';
      const r = await c.query(
        `INSERT INTO department_budgets
           (org_id, department_id, month_start, amount_minor, soft_block)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (department_id, month_start) DO UPDATE
           SET amount_minor = EXCLUDED.amount_minor,
               soft_block   = EXCLUDED.soft_block,
               updated_at   = now()
         RETURNING id, amount_minor, spent_minor, month_start::text`,
        [user.orgId, body.department_id, month, body.amount_minor, body.soft_block ?? false],
      );
      return r.rows[0];
    });
  }

  /**
   * Predicate used by PrService.submit. Returns `null` when no budget is
   * configured (the policy choice is "don't gate on missing budgets — let
   * admins opt in"). Returns context when one IS set so the caller can
   * decide whether to emit an anomaly or surface a warning to the buyer.
   */
  async checkPrAgainstBudget(orgId: string, departmentId: string | null, prTotalMinor: number): Promise<{
    would_be_pct: number;
    amount_minor: number;
    spent_minor: number;
    over: boolean;
    soft_block: boolean;
  } | null> {
    if (!departmentId) return null;
    const month = new Date().toISOString().slice(0, 7) + '-01';
    const r = await this.pool.query<{
      amount_minor: string; spent_minor: string; soft_block: boolean;
    }>(
      `SELECT amount_minor::text, spent_minor::text, soft_block
       FROM department_budgets
       WHERE org_id = $1 AND department_id = $2 AND month_start = $3`,
      [orgId, departmentId, month],
    );
    if (r.rowCount === 0) return null;
    const amount = Number(r.rows[0].amount_minor);
    const spent  = Number(r.rows[0].spent_minor);
    const proj   = spent + prTotalMinor;
    return {
      would_be_pct: amount === 0 ? 0 : Math.round((proj / amount) * 100),
      amount_minor: amount,
      spent_minor:  spent,
      over:         proj > amount,
      soft_block:   r.rows[0].soft_block,
    };
  }
}

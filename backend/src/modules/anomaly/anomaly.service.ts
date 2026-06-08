import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../common/db/db.module';
import { withOrg } from '../../common/db/with-org';
import type { CurrentUser } from '../../common/auth/current-user.decorator';

export type AnomalyKind =
  | 'price_spike'
  | 'new_supplier'
  | 'coi_match'
  | 'self_approve_attempt'
  | 'rapid_resubmit';

export type AnomalySeverity = 'info' | 'warning' | 'critical';

export interface AnomalyAlert {
  id: string;
  kind: AnomalyKind;
  severity: AnomalySeverity;
  subject_type: string;
  subject_id: string;
  details: Record<string, unknown>;
  created_at: string;
  acknowledged_at: string | null;
}

/**
 * Service that other modules call to RECORD an anomaly (e.g. PrService
 * notices a price spike at submit time), plus admin endpoints to LIST
 * + acknowledge.
 *
 * Keep this surface small: detection logic lives in the calling module or
 * in AnomalyScanJob (the cron). Anything that calls `record()` should
 * already have the org-scoped context.
 */
@Injectable()
export class AnomalyService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Direct insertion — used by the cron and by inline callers (PrService,
   * ApprovalsService). Uses the raw pool because callers from background
   * jobs don't carry a CurrentUser.
   */
  async record(opts: {
    org_id: string;
    kind: AnomalyKind;
    severity?: AnomalySeverity;
    subject_type: string;
    subject_id: string;
    details?: Record<string, unknown>;
    target_user_id?: string;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO anomaly_alerts
         (org_id, kind, severity, subject_type, subject_id, details, target_user_id)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
      [
        opts.org_id,
        opts.kind,
        opts.severity ?? 'warning',
        opts.subject_type,
        opts.subject_id,
        JSON.stringify(opts.details ?? {}),
        opts.target_user_id ?? null,
      ],
    );
  }

  list(user: CurrentUser, opts: { acknowledged?: boolean } = {}): Promise<AnomalyAlert[]> {
    return withOrg(this.pool, user.orgId, async (c) => {
      const where = opts.acknowledged === undefined
        ? ''
        : opts.acknowledged ? 'AND acknowledged_at IS NOT NULL'
                            : 'AND acknowledged_at IS NULL';
      const r = await c.query<AnomalyAlert>(
        `SELECT id, kind, severity, subject_type, subject_id, details,
                created_at, acknowledged_at
         FROM anomaly_alerts
         WHERE org_id = $1 ${where}
         ORDER BY created_at DESC
         LIMIT 200`,
        [user.orgId],
      );
      return r.rows;
    });
  }

  acknowledge(user: CurrentUser, id: string) {
    return withOrg(this.pool, user.orgId, async (c) => {
      await c.query(
        `UPDATE anomaly_alerts
         SET acknowledged_at = now(), acknowledged_by = $2
         WHERE id = $1 AND acknowledged_at IS NULL`,
        [id, user.userId],
      );
      return { ok: true };
    });
  }

  // -----------------------------------------------------------------------
  // Conflict-of-interest disclosures (CRUD)
  // -----------------------------------------------------------------------

  listDisclosures(user: CurrentUser) {
    return withOrg(this.pool, user.orgId, async (c) => {
      const r = await c.query(
        `SELECT d.id, d.user_id, u.full_name AS user_name,
                d.supplier_id, s.name AS supplier_name,
                d.relationship, d.note, d.declared_at
         FROM user_supplier_disclosures d
         JOIN users u     ON u.id = d.user_id
         JOIN suppliers s ON s.id = d.supplier_id
         ORDER BY d.declared_at DESC`,
      );
      return r.rows;
    });
  }

  declare(user: CurrentUser, body: { supplier_id: string; relationship: string; note?: string }) {
    return withOrg(this.pool, user.orgId, async (c) => {
      const r = await c.query(
        `INSERT INTO user_supplier_disclosures
           (org_id, user_id, supplier_id, relationship, note)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, supplier_id) DO UPDATE
           SET relationship = EXCLUDED.relationship,
               note         = EXCLUDED.note,
               declared_at  = now()
         RETURNING id, declared_at`,
        [user.orgId, user.userId, body.supplier_id, body.relationship, body.note ?? null],
      );
      return r.rows[0];
    });
  }

  /**
   * Used by PrService.submit: returns true if the requester has a declared
   * relationship to any of the PR's line-item suppliers. The caller decides
   * what to do (inject extra approval step, force compliance review, etc).
   */
  async prHasCoi(orgId: string, prId: string, requesterId: string): Promise<boolean> {
    const r = await this.pool.query(
      `SELECT 1
       FROM purchase_request_items pri
       JOIN user_supplier_disclosures d
         ON d.supplier_id = pri.supplier_id AND d.user_id = $2
       WHERE pri.pr_id = $1 AND pri.org_id = $3
       LIMIT 1`,
      [prId, requesterId, orgId],
    );
    return (r.rowCount ?? 0) > 0;
  }
}

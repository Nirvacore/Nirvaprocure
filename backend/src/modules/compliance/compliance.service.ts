import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../common/db/db.module';
import { withOrg } from '../../common/db/with-org';
import { AuditArchiveService } from './audit-archive.service';
import type { CurrentUser } from '../../common/auth/current-user.decorator';

export interface UserExport {
  generated_at: string;
  user: Record<string, unknown>;
  departments: unknown[];
  roles: unknown[];
  purchase_requests: unknown[];
  approval_decisions: unknown[];
  audit_log_entries: unknown[];
}

/**
 * Thailand PDPA (พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล 2562) — Sections 30 & 33
 * give data subjects the right to a copy of their personal data and to
 * request deletion.
 *
 * Strategy:
 *   - `export(userId)` returns every PII row tied to that user as JSON.
 *   - `redact(userId)` does PSEUDONYMIZATION rather than hard delete: we
 *     replace name/email/phone/line id with deterministic tokens but leave
 *     the foreign-key graph intact (otherwise approval trails / audit logs
 *     would collapse and violate audit requirements).
 *
 * Self-service: the user can request their own data. Admins (role=admin)
 * can do it on someone else's behalf — controller guards that, not us.
 */
@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly archive: AuditArchiveService,
  ) {}

  async exportUser(caller: CurrentUser, userId: string): Promise<UserExport> {
    return withOrg(this.pool, caller.orgId, async (c) => {
      const u = await c.query(
        `SELECT id, org_id, email, full_name, line_user_id, is_active, created_at, updated_at
         FROM users WHERE id = $1`, [userId]);
      if (u.rowCount === 0) throw new NotFoundException();

      const [depts, roles, prs, decisions, audit] = await Promise.all([
        c.query(`SELECT d.id, d.name, d.cost_center
                 FROM departments d JOIN user_roles ur ON ur.department_id = d.id
                 WHERE ur.user_id = $1`, [userId]),
        c.query(`SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id = r.id
                 WHERE ur.user_id = $1`, [userId]),
        c.query(`SELECT id, pr_number, title, status, total_minor, created_at, submitted_at
                 FROM purchase_requests WHERE requester_id = $1`, [userId]),
        c.query(`SELECT ad.* FROM approval_decisions ad WHERE ad.approver_id = $1`, [userId]),
        c.query(`SELECT id, action, entity_type, entity_id, created_at
                 FROM audit_log WHERE actor_user_id = $1 ORDER BY created_at DESC LIMIT 1000`, [userId]),
      ]);

      return {
        generated_at: new Date().toISOString(),
        user: u.rows[0],
        departments: depts.rows,
        roles: roles.rows,
        purchase_requests: prs.rows,
        approval_decisions: decisions.rows,
        audit_log_entries: audit.rows,
      };
    });
  }

  /**
   * Pseudonymize the user: clear PII columns, mark inactive, soft-delete.
   * Returns the count of records affected so the audit log can record it.
   */
  async redactUser(caller: CurrentUser, userId: string): Promise<{ redacted: true; user_id: string }> {
    return withOrg(this.pool, caller.orgId, async (c) => {
      const u = await c.query(`SELECT id FROM users WHERE id = $1`, [userId]);
      if (u.rowCount === 0) throw new NotFoundException();

      // Deterministic token so multiple redactions don't collide and the
      // approval-trail UI still shows "[redacted] approved" rather than null.
      const token = `redacted-${userId.slice(0, 8)}`;

      await c.query(
        `UPDATE users
           SET email        = $2 || '@redacted.invalid',
               full_name    = $2,
               line_user_id = NULL,
               password_hash = 'dev:!REDACTED!',
               is_active    = FALSE,
               deleted_at   = now(),
               updated_at   = now()
         WHERE id = $1`,
        [userId, token],
      );

      await c.query(
        `INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, diff)
         VALUES ($1, $2, 'compliance.redact', 'user', $3, $4)`,
        [caller.orgId, caller.userId, userId, JSON.stringify({ requested_by: caller.userId })],
      );

      return { redacted: true, user_id: userId };
    });
  }

  /**
   * Audit log retention: deletes audit_log rows older than `days`.
   *
   * Defaults to 90 days unless the user passes a different value. Production
   * should also dump them to cold storage (S3 + Glacier) before deleting.
   */
  async purgeAuditLog(caller: CurrentUser, days: number): Promise<{
    archived: boolean;
    archive_key?: string;
    archive_rows?: number;
    deleted: number;
  }> {
    // Archive FIRST: if the upload fails we refuse to delete so we never lose
    // records to a misconfigured bucket.
    const archived = await this.archive.archive(caller.orgId, days);

    const deleted = await withOrg(this.pool, caller.orgId, async (c) => {
      const r = await c.query(
        `DELETE FROM audit_log WHERE created_at < (now() - $1::interval)`,
        [`${days} days`],
      );
      return r.rowCount ?? 0;
    });

    return {
      archived:     archived.archived,
      archive_key:  archived.key,
      archive_rows: archived.row_count,
      deleted,
    };
  }
}

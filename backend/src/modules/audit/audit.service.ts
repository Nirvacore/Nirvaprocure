import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../common/db/db.module';
import { withOrg } from '../../common/db/with-org';
import type { CurrentUser } from '../../common/auth/current-user.decorator';

export interface AuditRow {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string;
  actor_user_id: string | null;
  actor_name: string | null;
  created_at: string;
  diff: unknown;
}

/**
 * Read-only browsing of the audit_log. Cursor pagination on (created_at, id)
 * because timestamps can collide on a busy minute.
 */
@Injectable()
export class AuditService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  list(user: CurrentUser, opts: {
    entityType?: string;
    actorId?: string;
    cursor?: string;          // base64 of "<ts>|<id>" returned from last page
    limit: number;
  }): Promise<{ data: AuditRow[]; next_cursor: string | null }> {
    return withOrg(this.pool, user.orgId, async (c) => {
      const where: string[] = [];
      const params: unknown[] = [];
      if (opts.entityType) {
        params.push(opts.entityType);
        where.push(`a.entity_type = $${params.length}`);
      }
      if (opts.actorId) {
        params.push(opts.actorId);
        where.push(`a.actor_user_id = $${params.length}`);
      }
      if (opts.cursor) {
        const decoded = Buffer.from(opts.cursor, 'base64').toString('utf8');
        const [ts, id] = decoded.split('|');
        if (ts && id) {
          params.push(ts);
          params.push(id);
          // Strict tuple comparison keeps the cursor monotonic.
          where.push(`(a.created_at, a.id) < ($${params.length - 1}::timestamptz, $${params.length}::bigint)`);
        }
      }
      params.push(opts.limit + 1);
      const r = await c.query<AuditRow & { created_at: string }>(
        `SELECT a.id, a.action, a.entity_type, a.entity_id,
                a.actor_user_id, u.full_name AS actor_name,
                a.created_at, a.diff
         FROM audit_log a
         LEFT JOIN users u ON u.id = a.actor_user_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY a.created_at DESC, a.id DESC
         LIMIT $${params.length}`,
        params,
      );
      const hasMore = r.rows.length > opts.limit;
      const slice   = hasMore ? r.rows.slice(0, opts.limit) : r.rows;
      const last    = slice[slice.length - 1];
      const next_cursor = hasMore && last
        ? Buffer.from(`${last.created_at}|${last.id}`).toString('base64')
        : null;
      return { data: slice, next_cursor };
    });
  }
}

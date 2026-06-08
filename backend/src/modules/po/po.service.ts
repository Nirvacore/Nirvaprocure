import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../common/db/db.module';
import { withOrg } from '../../common/db/with-org';
import type { CurrentUser } from '../../common/auth/current-user.decorator';

export interface PoRow {
  id: string;
  po_number: string;
  pr_id: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  status: string;
  total_minor: number;
  currency: string;
  notes: string | null;
  issued_by: string;
  issued_at: string | null;
  created_at: string;
}

/**
 * NirvaPO — Purchase Order management.
 *
 * Flow: approved PR → create PO (auto-copies items) → send to supplier → receive.
 * A PO can also be created standalone (without a PR) for direct purchases.
 */
@Injectable()
export class PoService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  list(user: CurrentUser, opts?: { status?: string }): Promise<PoRow[]> {
    return withOrg(this.pool, user.orgId, async (c) => {
      const params: unknown[] = [];
      const where = ['po.deleted_at IS NULL'];
      if (opts?.status) {
        params.push(opts.status);
        where.push(`po.status = $${params.length}`);
      }
      const r = await c.query(
        `SELECT po.id, po.po_number, po.pr_id, po.supplier_id,
                s.name AS supplier_name,
                po.status, po.total_minor, po.currency, po.notes,
                po.issued_by, po.issued_at, po.created_at
         FROM purchase_orders po
         LEFT JOIN suppliers s ON s.id = po.supplier_id
         WHERE ${where.join(' AND ')}
         ORDER BY po.created_at DESC`,
        params,
      );
      return r.rows;
    });
  }

  getOne(user: CurrentUser, id: string): Promise<PoRow & { items: unknown[] }> {
    return withOrg(this.pool, user.orgId, async (c) => {
      const po = await c.query(
        `SELECT po.*, s.name AS supplier_name
         FROM purchase_orders po
         LEFT JOIN suppliers s ON s.id = po.supplier_id
         WHERE po.id = $1 AND po.deleted_at IS NULL`,
        [id],
      );
      if (po.rowCount === 0) throw new NotFoundException();
      const items = await c.query(
        `SELECT * FROM po_items WHERE po_id = $1 ORDER BY line_no`,
        [id],
      );
      return { ...po.rows[0], items: items.rows };
    });
  }

  /**
   * Create a PO from an approved PR. Copies all line items.
   */
  createFromPr(user: CurrentUser, prId: string, supplierId?: string): Promise<PoRow> {
    return withOrg(this.pool, user.orgId, async (c) => {
      // Verify PR is approved
      const pr = await c.query(
        `SELECT id, pr_number, total_minor, status FROM purchase_requests
         WHERE id = $1 AND deleted_at IS NULL`,
        [prId],
      );
      if (pr.rowCount === 0) throw new NotFoundException('PR not found');
      if (pr.rows[0].status !== 'approved') {
        throw new ConflictException('PR must be approved to create PO');
      }

      // Check no PO already exists for this PR
      const existing = await c.query(
        `SELECT id FROM purchase_orders WHERE pr_id = $1 AND deleted_at IS NULL`,
        [prId],
      );
      if ((existing.rowCount ?? 0) > 0) {
        throw new ConflictException('PO already exists for this PR');
      }

      const poNumber = await this.nextPoNumber(c, user.orgId);

      const ins = await c.query(
        `INSERT INTO purchase_orders
           (org_id, po_number, pr_id, supplier_id, status, total_minor, issued_by, issued_at)
         VALUES ($1, $2, $3, $4, 'draft', $5, $6, now())
         RETURNING *`,
        [user.orgId, poNumber, prId, supplierId ?? null, pr.rows[0].total_minor, user.userId],
      );
      const poId = ins.rows[0].id;

      // Copy items from PR
      const prItems = await c.query(
        `SELECT id, line_no, description, quantity, unit, unit_price_minor
         FROM purchase_request_items
         WHERE pr_id = $1 ORDER BY line_no`,
        [prId],
      );
      for (const item of prItems.rows) {
        await c.query(
          `INSERT INTO po_items
             (org_id, po_id, line_no, description, quantity, unit,
              unit_price_minor, line_total_minor, pr_item_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [user.orgId, poId, item.line_no, item.description,
           item.quantity, item.unit, item.unit_price_minor,
           Math.round(item.quantity * item.unit_price_minor),
           item.id],
        );
      }

      // Audit
      await c.query(
        `INSERT INTO audit_log (org_id, actor_id, entity_type, entity_id, action)
         VALUES ($1, $2, 'purchase_order', $3, 'po.create')`,
        [user.orgId, user.userId, poId],
      );

      return this.getOne(user, poId);
    });
  }

  /**
   * Update PO status (send, cancel, complete).
   */
  updateStatus(user: CurrentUser, id: string, status: string): Promise<PoRow> {
    return withOrg(this.pool, user.orgId, async (c) => {
      const r = await c.query(
        `UPDATE purchase_orders SET status = $2, updated_at = now()
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING *`,
        [id, status],
      );
      if (r.rowCount === 0) throw new NotFoundException();

      await c.query(
        `INSERT INTO audit_log (org_id, actor_id, entity_type, entity_id, action, diff)
         VALUES ($1, $2, 'purchase_order', $3, 'po.status_change', $4::jsonb)`,
        [user.orgId, user.userId, id, JSON.stringify({ status })],
      );

      return r.rows[0];
    });
  }

  private async nextPoNumber(client: any, orgId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PO-${year}-`;
    const res = await client.query(
      `SELECT po_number FROM purchase_orders
       WHERE org_id = $1 AND po_number LIKE $2
       ORDER BY po_number DESC LIMIT 1`,
      [orgId, `${prefix}%`],
    );
    const next = res.rowCount === 0
      ? 1
      : parseInt(res.rows[0].po_number.slice(prefix.length), 10) + 1;
    return `${prefix}${String(next).padStart(4, '0')}`;
  }
}

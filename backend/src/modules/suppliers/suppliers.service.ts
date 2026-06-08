import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../common/db/db.module';
import { withOrg } from '../../common/db/with-org';
import type { CurrentUser } from '../../common/auth/current-user.decorator';

export interface SupplierRow {
  id: string;
  code: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  category: string | null;
  tax_id: string | null;
  is_active: boolean;
  risk_tier: string | null;
  total_pr_count: number;
  total_spent_minor: number;
  created_at: string;
}

/**
 * Supplier catalog CRUD + risk summary enrichment.
 *
 * Design choices:
 *  - Supplier codes (e.g. SUP-001) are org-scoped and must be unique within org.
 *  - Risk tier comes from anomaly.supplier_risk_scores (LEFT JOIN).
 *  - PR count & spend come from a subquery against pr_items for the org.
 *  - Soft-delete via is_active = false (never hard-delete a supplier that has PRs).
 */
@Injectable()
export class SuppliersService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  list(user: CurrentUser, search?: string): Promise<SupplierRow[]> {
    return withOrg(this.pool, user.orgId, async (c) => {
      const where = search
        ? `AND (s.name ILIKE $1 OR s.code ILIKE $1 OR s.contact_email ILIKE $1)`
        : '';
      const params = search ? [`%${search}%`] : [];

      const r = await c.query<SupplierRow>(
        `SELECT s.id, s.code, s.name,
                s.contact_name, s.contact_email, s.contact_phone,
                s.category, s.tax_id, s.is_active,
                rs.tier AS risk_tier,
                COALESCE(agg.pr_count, 0)::int    AS total_pr_count,
                COALESCE(agg.spent, 0)::int        AS total_spent_minor,
                s.created_at::text
         FROM suppliers s
         LEFT JOIN supplier_risk_scores rs ON rs.supplier_id = s.id
         LEFT JOIN LATERAL (
           SELECT COUNT(DISTINCT pi.pr_id) AS pr_count,
                  SUM(pi.unit_price_minor * pi.quantity) AS spent
           FROM pr_items pi
           WHERE pi.supplier_id = s.id
         ) agg ON true
         WHERE s.deleted_at IS NULL ${where}
         ORDER BY s.name`,
        params,
      );
      return r.rows;
    });
  }

  get(user: CurrentUser, id: string): Promise<SupplierRow> {
    return withOrg(this.pool, user.orgId, async (c) => {
      const r = await c.query<SupplierRow>(
        `SELECT s.id, s.code, s.name,
                s.contact_name, s.contact_email, s.contact_phone,
                s.category, s.tax_id, s.is_active,
                rs.tier AS risk_tier,
                COALESCE(agg.pr_count, 0)::int    AS total_pr_count,
                COALESCE(agg.spent, 0)::int        AS total_spent_minor,
                s.created_at::text
         FROM suppliers s
         LEFT JOIN supplier_risk_scores rs ON rs.supplier_id = s.id
         LEFT JOIN LATERAL (
           SELECT COUNT(DISTINCT pi.pr_id) AS pr_count,
                  SUM(pi.unit_price_minor * pi.quantity) AS spent
           FROM pr_items pi
           WHERE pi.supplier_id = s.id
         ) agg ON true
         WHERE s.id = $1 AND s.deleted_at IS NULL`,
        [id],
      );
      if (r.rowCount === 0) throw new NotFoundException('Supplier not found');
      return r.rows[0];
    });
  }

  create(user: CurrentUser, body: {
    code: string;
    name: string;
    contact_name?: string;
    contact_email?: string;
    contact_phone?: string;
    category?: string;
    tax_id?: string;
  }) {
    return withOrg(this.pool, user.orgId, async (c) => {
      const r = await c.query(
        `INSERT INTO suppliers
           (org_id, code, name, contact_name, contact_email, contact_phone, category, tax_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, code, name, contact_name, contact_email, contact_phone,
                   category, tax_id, is_active, created_at::text`,
        [
          user.orgId, body.code, body.name,
          body.contact_name ?? null,
          body.contact_email ?? null,
          body.contact_phone ?? null,
          body.category ?? null,
          body.tax_id ?? null,
        ],
      );
      return r.rows[0];
    });
  }

  update(user: CurrentUser, id: string, body: {
    name?: string;
    contact_name?: string;
    contact_email?: string;
    contact_phone?: string;
    category?: string;
    tax_id?: string;
    is_active?: boolean;
  }) {
    return withOrg(this.pool, user.orgId, async (c) => {
      const sets: string[] = [];
      const params: unknown[] = [id];
      let idx = 2;

      if (body.name !== undefined)          { sets.push(`name = $${idx++}`);          params.push(body.name); }
      if (body.contact_name !== undefined)  { sets.push(`contact_name = $${idx++}`);  params.push(body.contact_name); }
      if (body.contact_email !== undefined) { sets.push(`contact_email = $${idx++}`); params.push(body.contact_email); }
      if (body.contact_phone !== undefined) { sets.push(`contact_phone = $${idx++}`); params.push(body.contact_phone); }
      if (body.category !== undefined)      { sets.push(`category = $${idx++}`);      params.push(body.category); }
      if (body.tax_id !== undefined)        { sets.push(`tax_id = $${idx++}`);        params.push(body.tax_id); }
      if (body.is_active !== undefined)     { sets.push(`is_active = $${idx++}`);     params.push(body.is_active); }

      if (sets.length === 0) throw new Error('Nothing to update');
      sets.push('updated_at = now()');

      const r = await c.query(
        `UPDATE suppliers SET ${sets.join(', ')} WHERE id = $1 AND deleted_at IS NULL
         RETURNING id, code, name, contact_name, contact_email, contact_phone,
                   category, tax_id, is_active, created_at::text`,
        params,
      );
      if (r.rowCount === 0) throw new NotFoundException('Supplier not found');
      return r.rows[0];
    });
  }

  /** Soft-delete — keeps the row for audit trail + FK references. */
  archive(user: CurrentUser, id: string) {
    return withOrg(this.pool, user.orgId, async (c) => {
      const r = await c.query(
        `UPDATE suppliers SET deleted_at = now(), is_active = false WHERE id = $1 AND deleted_at IS NULL`,
        [id],
      );
      if (r.rowCount === 0) throw new NotFoundException('Supplier not found');
      return { ok: true };
    });
  }
}

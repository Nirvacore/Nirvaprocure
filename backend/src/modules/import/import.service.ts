import { Inject, Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../common/db/db.module';
import { withOrg } from '../../common/db/with-org';
import type { CurrentUser } from '../../common/auth/current-user.decorator';

export type ImportKind = 'items' | 'suppliers' | 'departments';

export interface ImportResult {
  kind: ImportKind;
  inserted: number;
  updated:  number;
  failed:   { row: number; reason: string }[];
}

/**
 * CSV bulk import for onboarding. Rows come in as parsed JSON (frontend or
 * a CSV parser ahead of this layer handles CSV → array of objects). Each row
 * is upserted by its "natural key" (SKU for items, name for suppliers/depts)
 * so re-importing the same file is idempotent.
 *
 * Per-row failures don't abort the batch — we collect them and return the
 * report so the user can fix and re-upload only the bad rows.
 */
@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async run(user: CurrentUser, kind: ImportKind, rows: Record<string, unknown>[]): Promise<ImportResult> {
    const result: ImportResult = { kind, inserted: 0, updated: 0, failed: [] };
    if (!Array.isArray(rows) || rows.length === 0) return result;

    return withOrg(this.pool, user.orgId, async (c) => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const outcome = await this.upsertOne(c, user.orgId, kind, row);
          if (outcome === 'inserted') result.inserted++;
          else if (outcome === 'updated') result.updated++;
        } catch (err) {
          result.failed.push({ row: i + 1, reason: (err as Error).message });
        }
      }

      // Audit log of the entire batch — one row, not one per upsert. Avoids
      // flooding the audit table on a 10k-row import.
      await c.query(
        `INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, diff)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [user.orgId, user.userId, `import.${kind}`, kind, user.orgId,
         JSON.stringify({ inserted: result.inserted, updated: result.updated, failed: result.failed.length })],
      );

      return result;
    });
  }

  private async upsertOne(
    c: any, orgId: string, kind: ImportKind, row: Record<string, unknown>,
  ): Promise<'inserted' | 'updated'> {
    if (kind === 'items') {
      const sku  = required(row, 'sku', 'string');
      const name = required(row, 'name', 'string');
      const unit = (row.unit as string | undefined) ?? 'unit';
      const r = await c.query(
        `INSERT INTO items (org_id, sku, name, unit, barcode, category)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (org_id, sku) DO UPDATE
           SET name = EXCLUDED.name, unit = EXCLUDED.unit,
               barcode = EXCLUDED.barcode, category = EXCLUDED.category
         RETURNING (xmax = 0) AS inserted`,
        [orgId, sku, name, unit, row.barcode ?? null, row.category ?? null],
      );
      return r.rows[0].inserted ? 'inserted' : 'updated';
    }
    if (kind === 'suppliers') {
      const name = required(row, 'name', 'string');
      const r = await c.query(
        `INSERT INTO suppliers (org_id, name, tax_id, contact_email, contact_phone)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [orgId, name, row.tax_id ?? null, row.contact_email ?? null, row.contact_phone ?? null],
      );
      if (r.rowCount !== 0) return 'inserted';
      await c.query(
        `UPDATE suppliers SET
           tax_id        = COALESCE($3, tax_id),
           contact_email = COALESCE($4, contact_email),
           contact_phone = COALESCE($5, contact_phone),
           updated_at    = now()
         WHERE org_id = $1 AND name = $2`,
        [orgId, name, row.tax_id ?? null, row.contact_email ?? null, row.contact_phone ?? null],
      );
      return 'updated';
    }
    if (kind === 'departments') {
      const name = required(row, 'name', 'string');
      const r = await c.query(
        `INSERT INTO departments (org_id, name, cost_center)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [orgId, name, row.cost_center ?? null],
      );
      if (r.rowCount !== 0) return 'inserted';
      await c.query(
        `UPDATE departments SET cost_center = COALESCE($3, cost_center), updated_at = now()
         WHERE org_id = $1 AND name = $2`,
        [orgId, name, row.cost_center ?? null],
      );
      return 'updated';
    }
    throw new Error(`Unknown import kind: ${kind}`);
  }
}

function required(row: Record<string, unknown>, key: string, type: 'string'): string {
  const v = row[key];
  if (v == null || typeof v !== type || (type === 'string' && (v as string).trim() === '')) {
    throw new Error(`Missing required field "${key}"`);
  }
  return (v as string).trim();
}

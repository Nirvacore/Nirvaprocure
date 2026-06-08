import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../common/db/db.module';
import { withOrg } from '../../common/db/with-org';
import type { CurrentUser } from '../../common/auth/current-user.decorator';

export type StockMoveType = 'receive' | 'issue' | 'adjust_in' | 'adjust_out' | 'transfer_in' | 'transfer_out' | 'opening';

export interface StockOnHandRow {
  item_id: string;
  sku: string;
  name: string;
  unit: string;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  qty: number;
  reorder_point: number | null;
  below_reorder: boolean;
}

export interface MovementInput {
  item_id: string;
  warehouse_id: string;
  type: StockMoveType;
  qty: number;        // always positive in the input; sign is applied per type
  note?: string;
  reference_type?: string;
  reference_id?: string;
}

/**
 * Reads current stock on hand and records movements.
 *
 * Sign convention: callers always pass `qty` as a positive number describing
 * the magnitude. We map type → sign here so the caller doesn't have to
 * remember which type is positive/negative.
 */
@Injectable()
export class StockService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // -----------------------------------------------------------------------
  // Reads
  // -----------------------------------------------------------------------

  listWarehouses(user: CurrentUser) {
    return withOrg(this.pool, user.orgId, async (c) => {
      const r = await c.query(
        `SELECT id, name, code, address, is_active
         FROM warehouses WHERE is_active = TRUE
         ORDER BY name`,
      );
      return r.rows;
    });
  }

  /**
   * Stock-on-hand view, joined to items + warehouses + reorder rules so the
   * UI can render everything it needs in one query.
   */
  onHand(user: CurrentUser, warehouseId?: string): Promise<StockOnHandRow[]> {
    return withOrg(this.pool, user.orgId, async (c) => {
      const params: unknown[] = [];
      let filter = '';
      if (warehouseId) {
        params.push(warehouseId);
        filter = `WHERE soh.warehouse_id = $${params.length}`;
      }
      const r = await c.query(
        `SELECT
           i.id   AS item_id, i.sku, i.name, i.unit,
           w.id   AS warehouse_id, w.code AS warehouse_code, w.name AS warehouse_name,
           soh.qty,
           rr.reorder_point,
           (rr.reorder_point IS NOT NULL AND soh.qty <= rr.reorder_point) AS below_reorder
         FROM stock_on_hand soh
         JOIN items i      ON i.id = soh.item_id
         JOIN warehouses w ON w.id = soh.warehouse_id
         LEFT JOIN reorder_rules rr
           ON rr.item_id = soh.item_id AND rr.warehouse_id = soh.warehouse_id
         ${filter}
         ORDER BY below_reorder DESC, i.name`,
        params,
      );
      return r.rows;
    });
  }

  // -----------------------------------------------------------------------
  // Writes
  // -----------------------------------------------------------------------

  recordMovement(user: CurrentUser, input: MovementInput) {
    return withOrg(this.pool, user.orgId, async (c) => {
      const item = await c.query(`SELECT id FROM items WHERE id = $1`, [input.item_id]);
      if (item.rowCount === 0) throw new NotFoundException('Item not found');
      const wh = await c.query(`SELECT id, is_active FROM warehouses WHERE id = $1`, [input.warehouse_id]);
      if (wh.rowCount === 0) throw new NotFoundException('Warehouse not found');
      if (!wh.rows[0].is_active) throw new ConflictException('Warehouse is inactive');

      const sign = SIGN[input.type];
      if (sign == null) throw new ConflictException(`Unknown movement type: ${input.type}`);
      if (input.qty <= 0) throw new ConflictException('Quantity must be positive');

      const qty_delta = sign * input.qty;

      const r = await c.query(
        `INSERT INTO stock_movements
           (org_id, item_id, warehouse_id, type, qty_delta, reference_type, reference_id, note, actor_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, created_at`,
        [
          user.orgId, input.item_id, input.warehouse_id, input.type, qty_delta,
          input.reference_type ?? null, input.reference_id ?? null,
          input.note ?? null, user.userId,
        ],
      );
      return r.rows[0];
    });
  }
}

const SIGN: Record<StockMoveType, number> = {
  receive:        +1,
  issue:          -1,
  adjust_in:      +1,
  adjust_out:     -1,
  transfer_in:    +1,
  transfer_out:   -1,
  opening:        +1,
};

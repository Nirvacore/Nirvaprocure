-- NIRVAPROCURE Phase 2 — NirvaStock inventory schema
-- Apply AFTER phase1_schema.sql.
--
-- Design:
--   - `warehouses` is the org's physical/logical location list.
--   - `items` is the master catalog (independent of POs — items can be
--     stocked even if never bought via NirvaProcure).
--   - `stock_movements` is an APPEND-ONLY ledger; current on-hand is
--     computed from SUM(qty_delta) per (item, warehouse). We materialize
--     it for read speed in `stock_on_hand` and refresh via trigger.
--   - `reorder_rules` stores per-item per-warehouse low-stock thresholds
--     so NirvaAI can suggest a PR when on-hand dips below the trigger.

BEGIN;

CREATE TABLE IF NOT EXISTS warehouses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    name            TEXT NOT NULL,
    code            TEXT NOT NULL,
    address         TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, code)
);

CREATE TABLE IF NOT EXISTS items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    sku             TEXT NOT NULL,
    name            TEXT NOT NULL,
    unit            TEXT NOT NULL DEFAULT 'unit',
    barcode         TEXT,
    category        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (org_id, sku)
);

CREATE TYPE stock_move_type AS ENUM (
    'receive',          -- PO receipt
    'issue',            -- internal issue / consumption
    'adjust_in',        -- positive adjustment (count gain)
    'adjust_out',       -- negative adjustment (count loss)
    'transfer_in',      -- arrival side of transfer
    'transfer_out',     -- departure side of transfer
    'opening'           -- initial seed when warehouse first onboarded
);

CREATE TABLE IF NOT EXISTS stock_movements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    item_id         UUID NOT NULL REFERENCES items(id),
    warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
    type            stock_move_type NOT NULL,
    qty_delta       NUMERIC(14,4) NOT NULL,   -- positive or negative
    reference_type  TEXT,                      -- e.g. 'purchase_request'
    reference_id    UUID,
    note            TEXT,
    actor_user_id   UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item_warehouse
    ON stock_movements (item_id, warehouse_id, created_at);

-- Current on-hand: materialized for read speed. Maintained by trigger below.
CREATE TABLE IF NOT EXISTS stock_on_hand (
    org_id          UUID NOT NULL REFERENCES organizations(id),
    item_id         UUID NOT NULL REFERENCES items(id),
    warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
    qty             NUMERIC(14,4) NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (item_id, warehouse_id)
);

CREATE OR REPLACE FUNCTION apply_stock_movement() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO stock_on_hand (org_id, item_id, warehouse_id, qty, updated_at)
    VALUES (NEW.org_id, NEW.item_id, NEW.warehouse_id, NEW.qty_delta, now())
    ON CONFLICT (item_id, warehouse_id)
    DO UPDATE SET
        qty        = stock_on_hand.qty + EXCLUDED.qty,
        updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_apply_stock_movement ON stock_movements;
CREATE TRIGGER trg_apply_stock_movement
    AFTER INSERT ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION apply_stock_movement();

CREATE TABLE IF NOT EXISTS reorder_rules (
    org_id          UUID NOT NULL REFERENCES organizations(id),
    item_id         UUID NOT NULL REFERENCES items(id),
    warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
    reorder_point   NUMERIC(14,4) NOT NULL,    -- trigger when qty <= this
    reorder_qty     NUMERIC(14,4) NOT NULL,    -- suggest ordering this much
    last_alerted_at TIMESTAMPTZ,
    PRIMARY KEY (item_id, warehouse_id)
);

-- RLS for the new tables
DO $$
DECLARE t TEXT;
BEGIN
    FOR t IN
        SELECT unnest(ARRAY['warehouses','items','stock_movements','stock_on_hand','reorder_rules'])
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
        EXECUTE format($p$
            CREATE POLICY %I_org_isolation ON %I
            USING (org_id = current_setting('app.current_org')::uuid);
        $p$, t, t);
    END LOOP;
END$$;

COMMIT;

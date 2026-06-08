-- Phase 7: Purchase Orders (PO) — created from approved PRs.
-- PR → approved → PO generated → sent to supplier → goods received.

CREATE TABLE IF NOT EXISTS purchase_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id),
  po_number       TEXT NOT NULL,
  pr_id           UUID REFERENCES purchase_requests(id),
  supplier_id     UUID REFERENCES suppliers(id),
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','sent','acknowledged','partially_received','completed','cancelled')),
  total_minor     INTEGER NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'THB',
  notes           TEXT,
  issued_by       UUID NOT NULL REFERENCES users(id),
  issued_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS po_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id),
  po_id           UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  line_no         INTEGER NOT NULL,
  description     TEXT NOT NULL,
  quantity        NUMERIC NOT NULL,
  unit            TEXT NOT NULL DEFAULT 'unit',
  unit_price_minor INTEGER NOT NULL,
  line_total_minor INTEGER NOT NULL,
  pr_item_id      UUID,                 -- link back to the original PR line item
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_po_number_org ON purchase_orders(org_id, po_number);
CREATE INDEX IF NOT EXISTS idx_po_pr ON purchase_orders(pr_id);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON po_items(po_id);

-- RLS
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS po_org ON purchase_orders;
CREATE POLICY po_org ON purchase_orders
  USING (org_id::text = current_setting('app.current_org', true));

ALTER TABLE po_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS po_items_org ON po_items;
CREATE POLICY po_items_org ON po_items
  USING (org_id::text = current_setting('app.current_org', true));

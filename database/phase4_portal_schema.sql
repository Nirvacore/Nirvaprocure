-- NIRVAPROCURE Phase 4 — Supplier portal tokens
-- Apply AFTER phase1_schema.sql.
--
-- Suppliers don't have NIRVAPROCURE user accounts. Instead, we send them a
-- one-off URL with a long random token. The token row maps to a supplier and
-- carries an expiry. Server hashes the token (SHA-256) at rest so a DB leak
-- doesn't compromise live links.

BEGIN;

CREATE TABLE IF NOT EXISTS supplier_portal_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    supplier_id     UUID NOT NULL REFERENCES suppliers(id),
    -- SHA-256 hex of the raw token. The raw token is shown to the supplier
    -- exactly once at creation time and never stored.
    token_hash      TEXT NOT NULL UNIQUE,
    label           TEXT,                                  -- e.g. "Q3 RFQ batch"
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    last_used_at    TIMESTAMPTZ,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_spt_supplier ON supplier_portal_tokens (supplier_id) WHERE revoked_at IS NULL;

ALTER TABLE supplier_portal_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY spt_org_isolation ON supplier_portal_tokens
  USING (org_id = current_setting('app.current_org', true)::uuid);

COMMIT;

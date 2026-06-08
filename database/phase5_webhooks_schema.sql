-- NIRVAPROCURE Phase 5 — Outbound webhooks
-- Apply AFTER phase1_schema.sql.

BEGIN;

-- Subscribers register a URL + a per-subscription secret (we hash for storage)
-- and the events they want. Events are emitted as JSON POSTs signed with
-- HMAC-SHA256 over the raw body.
CREATE TABLE IF NOT EXISTS org_webhooks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    url             TEXT NOT NULL,
    secret_hash     TEXT NOT NULL,                   -- SHA-256 of the shared secret; raw is shown once
    events          TEXT[] NOT NULL DEFAULT '{}',    -- e.g. {'pr.submitted','pr.decided'}
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_delivered_at TIMESTAMPTZ,
    last_status     INT,                              -- HTTP status of the most recent delivery
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_webhooks_org_active
    ON org_webhooks (org_id) WHERE is_active = TRUE;

-- Append-only delivery log — useful for the admin UI ("did the webhook fire?")
-- and for redelivery (Phase 5 follow-up: replay button).
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    webhook_id      UUID NOT NULL REFERENCES org_webhooks(id) ON DELETE CASCADE,
    event           TEXT NOT NULL,
    payload         JSONB NOT NULL,
    status_code     INT,
    error           TEXT,
    attempt         INT NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deliveries_webhook ON webhook_deliveries (webhook_id, created_at DESC);

ALTER TABLE org_webhooks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY ow_iso ON org_webhooks
  USING (org_id = current_setting('app.current_org', true)::uuid);
CREATE POLICY wd_iso ON webhook_deliveries
  USING (org_id = current_setting('app.current_org', true)::uuid);

COMMIT;

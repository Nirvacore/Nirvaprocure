-- NIRVAPROCURE Phase 5 — Anomaly detection + Conflict of Interest schema
-- Apply AFTER phase1_schema.sql.

BEGIN;

-- ---------------------------------------------------------------------------
-- Conflict of Interest disclosures.
-- Users self-declare relationships to suppliers; PRs that involve a
-- declared-relation supplier get an extra approval step injected.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_supplier_disclosures (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    user_id         UUID NOT NULL REFERENCES users(id),
    supplier_id     UUID NOT NULL REFERENCES suppliers(id),
    relationship    TEXT NOT NULL,                  -- 'family' | 'former_employer' | 'investor' | 'other'
    note            TEXT,
    declared_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, supplier_id)
);

ALTER TABLE user_supplier_disclosures ENABLE ROW LEVEL SECURITY;
CREATE POLICY usd_org_iso ON user_supplier_disclosures
  USING (org_id = current_setting('app.current_org', true)::uuid);

-- ---------------------------------------------------------------------------
-- Anomaly alerts: one row per detection event, addressed to a target user
-- (typically the org admin / compliance officer).
-- ---------------------------------------------------------------------------
CREATE TYPE anomaly_severity AS ENUM ('info', 'warning', 'critical');

CREATE TABLE IF NOT EXISTS anomaly_alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    kind            TEXT NOT NULL,                  -- 'price_spike' | 'new_supplier' | 'coi_match' | 'self_approve_attempt' | ...
    severity        anomaly_severity NOT NULL DEFAULT 'warning',
    -- The "subject" of the alert — what the alert is ABOUT (a PR, a user, a supplier, ...)
    subject_type    TEXT NOT NULL,
    subject_id      UUID NOT NULL,
    -- Free-form details: the AI's reasoning, computed ratios, prior median.
    details         JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Who needs to look at this. NULL = "any admin"; specific user id when
    -- it's their own self-approve attempt or a direct report's anomaly.
    target_user_id  UUID REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_anomaly_unacked
    ON anomaly_alerts (org_id, created_at DESC)
    WHERE acknowledged_at IS NULL;

ALTER TABLE anomaly_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY aa_org_iso ON anomaly_alerts
  USING (org_id = current_setting('app.current_org', true)::uuid);

COMMIT;

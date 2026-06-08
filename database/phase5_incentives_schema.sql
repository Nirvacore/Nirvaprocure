-- NIRVAPROCURE Phase 5 — Incentive & anti-fraud schema
-- Apply AFTER phase1_schema.sql.

BEGIN;

-- ---------------------------------------------------------------------------
-- Savings ledger: one row per PR-item that beat its baseline price.
-- Computed by a cron job; idempotent on (pr_id, line_no).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_savings_log (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id           UUID NOT NULL REFERENCES organizations(id),
    user_id          UUID NOT NULL REFERENCES users(id),
    pr_id            UUID NOT NULL REFERENCES purchase_requests(id),
    line_no          INT NOT NULL,
    -- Baseline = median unit_price for the same SKU/item description from
    -- approved POs in the previous 90 days, in satang.
    baseline_minor   BIGINT NOT NULL,
    actual_minor     BIGINT NOT NULL,
    savings_minor    BIGINT NOT NULL,                  -- baseline - actual, capped at >= 0
    method           TEXT NOT NULL,                    -- 'median_90d' | 'historical_low' | 'ai_suggestion'
    computed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (pr_id, line_no)
);
CREATE INDEX IF NOT EXISTS idx_savings_user_month
  ON user_savings_log (org_id, user_id, computed_at);

ALTER TABLE user_savings_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY usl_org_iso ON user_savings_log
  USING (org_id = current_setting('app.current_org', true)::uuid);

-- ---------------------------------------------------------------------------
-- Badges: derived per user from savings_log + behavior rules. We persist
-- so that a "Smart Buyer Q1 2026" stays visible even after the underlying
-- POs age out of the median window.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_badges (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES organizations(id),
    user_id     UUID NOT NULL REFERENCES users(id),
    badge_key   TEXT NOT NULL,                          -- 'smart_buyer' | 'sla_streak_14' | ...
    earned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    context     JSONB,                                  -- e.g. {"period": "2026-Q1", "savings_minor": 152000}
    UNIQUE (user_id, badge_key, (context->>'period'))
);

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY ub_org_iso ON user_badges
  USING (org_id = current_setting('app.current_org', true)::uuid);

COMMIT;

-- Phase 6 — Supplier risk scores
--
-- Stores the latest per-supplier composite risk score for each org.
-- Computed by AnomalyScanJob daily; admin can trigger on-demand via
-- POST /anomaly/supplier-risks/refresh.
--
-- Score 0–100 (higher = riskier). Tier is derived from score:
--   0–30  → low
--   31–55 → medium
--   56–75 → high
--   76–100 → critical
--
-- factors JSONB carries the raw inputs so the UI can explain the score.

BEGIN;

CREATE TABLE IF NOT EXISTS supplier_risk_scores (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id UUID        NOT NULL REFERENCES suppliers(id)     ON DELETE CASCADE,
  score       SMALLINT    NOT NULL CHECK (score BETWEEN 0 AND 100),
  tier        TEXT        NOT NULL CHECK (tier IN ('low', 'medium', 'high', 'critical')),
  factors     JSONB       NOT NULL DEFAULT '{}',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_risk_org_score
  ON supplier_risk_scores (org_id, score DESC);

ALTER TABLE supplier_risk_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY srs_iso ON supplier_risk_scores
  USING (org_id = current_setting('app.current_org', true)::uuid);

COMMIT;

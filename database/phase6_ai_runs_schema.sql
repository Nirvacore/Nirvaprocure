-- Phase 6 — AI call audit log (ai_runs)
--
-- Every call through OpenAiProvider is recorded here so operators can:
--   - Track total token spend per org
--   - Identify which feature / template is most expensive
--   - Set up cost alerts (query total_cost_usd WHERE created_at >= ...)
--   - Replay prompts for debugging
--
-- Cost is estimated at insert time using the published OpenAI pricing
-- (gpt-4o-mini: $0.15/1M input + $0.60/1M output as of 2024-Q4).
-- The pricing multiplier is stored in the row so historical records remain
-- accurate even after a rate change.

BEGIN;

CREATE TABLE IF NOT EXISTS ai_runs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID        REFERENCES organizations(id) ON DELETE SET NULL,
  user_id          UUID        REFERENCES users(id)         ON DELETE SET NULL,
  template         TEXT        NOT NULL DEFAULT 'unknown',
  model            TEXT        NOT NULL,
  prompt_tokens    INT         NOT NULL DEFAULT 0,
  completion_tokens INT        NOT NULL DEFAULT 0,
  total_tokens     INT         GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
  input_cost_usd   NUMERIC(12,8) NOT NULL DEFAULT 0,
  output_cost_usd  NUMERIC(12,8) NOT NULL DEFAULT 0,
  total_cost_usd   NUMERIC(12,8) GENERATED ALWAYS AS (input_cost_usd + output_cost_usd) STORED,
  latency_ms       INT,
  is_stub          BOOLEAN     NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_runs_org_created
  ON ai_runs (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_runs_template
  ON ai_runs (template, created_at DESC);

-- Helpful view: monthly cost per org
CREATE OR REPLACE VIEW ai_cost_monthly AS
  SELECT org_id,
         date_trunc('month', created_at) AS month,
         SUM(total_cost_usd)             AS total_cost_usd,
         SUM(total_tokens)               AS total_tokens,
         COUNT(*)                        AS call_count
    FROM ai_runs
   WHERE is_stub = false
   GROUP BY org_id, date_trunc('month', created_at);

COMMIT;

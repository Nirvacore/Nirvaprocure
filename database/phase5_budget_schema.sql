-- NIRVAPROCURE Phase 5 — Department budget tracking
-- Apply AFTER phase1_schema.sql.
--
-- Budgets are set per (department, calendar month). `spent_minor` is the
-- denormalized rollup, refreshed by trigger every time a PR transitions
-- to status='approved' or 'completed' inside that month. The trigger
-- approach keeps the read path (UI) a single-row SELECT.

BEGIN;

CREATE TABLE IF NOT EXISTS department_budgets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    department_id   UUID NOT NULL REFERENCES departments(id),
    month_start     DATE NOT NULL,                     -- first day of month (UTC)
    amount_minor    BIGINT NOT NULL CHECK (amount_minor >= 0),
    spent_minor     BIGINT NOT NULL DEFAULT 0 CHECK (spent_minor >= 0),
    soft_block      BOOLEAN NOT NULL DEFAULT FALSE,    -- true → warn at submit; never block
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (department_id, month_start)
);

ALTER TABLE department_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY db_org_iso ON department_budgets
  USING (org_id = current_setting('app.current_org', true)::uuid);

CREATE OR REPLACE FUNCTION recompute_department_budget_spent() RETURNS TRIGGER AS $$
DECLARE
    target_month DATE;
BEGIN
    -- We re-derive spent_minor from scratch because the trigger may fire on
    -- INSERT, UPDATE (status change), or DELETE — easier to recompute than
    -- to track deltas.
    IF NEW.department_id IS NULL THEN RETURN NEW; END IF;
    target_month := date_trunc('month', COALESCE(NEW.submitted_at, NEW.created_at))::date;

    UPDATE department_budgets
       SET spent_minor = (
         SELECT COALESCE(SUM(total_minor), 0)
         FROM purchase_requests
         WHERE department_id = NEW.department_id
           AND status IN ('approved', 'completed')
           AND date_trunc('month', COALESCE(submitted_at, created_at))::date = target_month
       ),
       updated_at = now()
     WHERE department_id = NEW.department_id
       AND month_start = target_month;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recompute_budget ON purchase_requests;
CREATE TRIGGER trg_recompute_budget
    AFTER UPDATE OF status ON purchase_requests
    FOR EACH ROW
    WHEN (NEW.status IN ('approved', 'completed') OR OLD.status IN ('approved', 'completed'))
    EXECUTE FUNCTION recompute_department_budget_spent();

COMMIT;

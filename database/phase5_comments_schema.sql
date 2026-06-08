-- NIRVAPROCURE Phase 5 — PR comments thread
-- Apply AFTER phase1_schema.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS pr_comments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES organizations(id),
    pr_id       UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
    author_id   UUID NOT NULL REFERENCES users(id),
    body        TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ                                  -- soft-delete keeps audit trail intact
);
CREATE INDEX IF NOT EXISTS idx_pr_comments_pr ON pr_comments (pr_id, created_at);

ALTER TABLE pr_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY prc_org_iso ON pr_comments
  USING (org_id = current_setting('app.current_org', true)::uuid);

COMMIT;

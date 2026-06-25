-- NIRVAPROCURE — link approved TOR drafts to generated purchase requests
-- Apply AFTER phase2_gov_schema.sql.

BEGIN;

ALTER TABLE tor_drafts
  ADD COLUMN IF NOT EXISTS linked_pr_id UUID REFERENCES purchase_requests(id);

CREATE INDEX IF NOT EXISTS idx_tor_drafts_linked_pr ON tor_drafts (linked_pr_id);

COMMIT;

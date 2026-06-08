-- Phase 6 — PDPA §22 (privacy notice) + §23 (consent) record-keeping.
--
-- The privacy notice text is versioned: when we materially change it, we
-- bump `notice_version` in the app config and require the user to re-accept
-- on next login. The columns record WHEN and WHICH VERSION they accepted,
-- which is the evidence an auditor (or DPA) will ask for.
--
-- Cookie consent for analytics/non-essential cookies is tracked the same way
-- — the cookie banner persists state to `cookie_consent` for logged-in users
-- so reading + writing the choice is consistent across devices.
--
-- Idempotent — safe to re-apply.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pdpa_consent_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pdpa_consent_version TEXT,
  ADD COLUMN IF NOT EXISTS cookie_consent       JSONB;
  -- cookie_consent shape:
  --   { "essential": true, "analytics": false, "marketing": false,
  --     "decided_at": "2026-05-23T07:14:00Z", "version": "v1" }

COMMENT ON COLUMN users.pdpa_consent_at IS
  'When the user accepted the current privacy notice; NULL = never seen the notice.';
COMMENT ON COLUMN users.pdpa_consent_version IS
  'Version string of the notice they accepted (e.g. ''v1'', ''v2'').';
COMMENT ON COLUMN users.cookie_consent IS
  'JSON map of cookie categories the user has opted in/out of, with decided_at + version.';

-- A partial index for the "users who haven't consented to the latest version
-- yet" query that the login flow runs on each sign-in.
CREATE INDEX IF NOT EXISTS users_pdpa_consent_pending_idx
  ON users (org_id, id) WHERE pdpa_consent_at IS NULL;

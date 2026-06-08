-- NIRVAPROCURE Phase 4 — 2FA columns
-- Apply AFTER phase1_schema.sql.

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS totp_secret      TEXT,
  ADD COLUMN IF NOT EXISTS totp_enabled_at  TIMESTAMPTZ;

-- Optional: backup recovery codes (stored as bcrypt hashes, single-use).
CREATE TABLE IF NOT EXISTS user_recovery_codes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash       TEXT NOT NULL,
    used_at         TIMESTAMPTZ
);

ALTER TABLE user_recovery_codes ENABLE ROW LEVEL SECURITY;
-- Caller must have the user's org set via app.current_org.
CREATE POLICY urc_iso ON user_recovery_codes
  USING (user_id IN (SELECT id FROM users WHERE org_id = current_setting('app.current_org', true)::uuid));

COMMIT;

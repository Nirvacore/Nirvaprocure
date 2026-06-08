-- Phase 6 — Per-user LINE account binding
--
-- Adds two transient columns to `users`:
--   line_binding_code        — 6-digit numeric code the user sends to the LINE bot
--   line_binding_expires_at  — TTL (10 minutes from issue time)
--
-- The code is cleared once successfully claimed (line_user_id is populated)
-- or when a new code is generated (overwriting the previous one).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS line_binding_code        TEXT,
  ADD COLUMN IF NOT EXISTS line_binding_expires_at  TIMESTAMPTZ;

-- Index so the webhook lookup is O(log n) instead of a full scan.
CREATE INDEX IF NOT EXISTS idx_users_line_binding_code
  ON users (line_binding_code)
  WHERE line_binding_code IS NOT NULL;

COMMENT ON COLUMN users.line_binding_code IS
  '6-digit one-time code for self-service LINE account linking. NULL when not in flight.';
COMMENT ON COLUMN users.line_binding_expires_at IS
  'UTC expiry for line_binding_code. Code is invalid after this timestamp.';

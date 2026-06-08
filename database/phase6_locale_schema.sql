-- Phase 6 — per-user locale preference.
--
-- The web app picks a language from the dropdown, but server-emitted
-- messages (LINE pushes, emails, PDF labels) don't see that choice unless
-- it's persisted. This adds `preferred_locale` to the users table so the
-- LINE notifier (and friends) can render in the recipient's own language
-- rather than always defaulting to Thai.
--
-- Idempotent — safe to re-apply.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferred_locale TEXT
    CHECK (preferred_locale IS NULL OR preferred_locale IN ('th','en','zh','ja','vi','id','my','km'));

-- A small index for the notifier hot path. The query is a simple key lookup
-- by user id, so we mostly rely on the pk index; this is just a hint for the
-- planner if we ever add bulk pushes scoped by locale.
CREATE INDEX IF NOT EXISTS users_preferred_locale_idx
  ON users (preferred_locale) WHERE preferred_locale IS NOT NULL;

COMMENT ON COLUMN users.preferred_locale IS
  'ISO-639-1 locale code; NULL means fall back to org default (currently ''th'').';

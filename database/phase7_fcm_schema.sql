-- Phase 7: FCM device token registry for push notifications.
-- Each user can have multiple tokens (phone + tablet, etc).

CREATE TABLE IF NOT EXISTS fcm_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  platform    TEXT NOT NULL DEFAULT 'android' CHECK (platform IN ('android','ios','web')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fcm_user ON fcm_tokens(user_id);

-- Phase 6 — Affiliate link configuration
--
-- Each org stores their affiliate IDs per marketplace.
-- When a buyer pastes a product URL, the import-link endpoint rewrites it
-- to an affiliate-tagged version before returning the draft line item.
-- Commissions flow directly to the org's affiliate account on each platform.
--
-- Supported platforms & typical commission rates (as of 2024):
--   shopee   1–5% (Shopee Affiliate Program)
--   lazada   3–7% (Lazada Affiliate Program via Impact/Partnerize)
--   makro    custom (Makro does not have a public affiliate API; URL passthrough)
--   alibaba  2–8% (Alibaba Alliance)

BEGIN;

CREATE TABLE IF NOT EXISTS org_affiliate_config (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform    TEXT    NOT NULL CHECK (platform IN ('shopee', 'lazada', 'makro', 'alibaba')),
  affiliate_id TEXT   NOT NULL,          -- the tracker/publisher ID issued by the platform
  sub_id      TEXT,                      -- optional sub-tracking tag (campaign / dept)
  is_active   BOOLEAN NOT NULL DEFAULT true,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_affiliate_org ON org_affiliate_config (org_id);

ALTER TABLE org_affiliate_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY aff_iso ON org_affiliate_config
  USING (org_id = current_setting('app.current_org', true)::uuid);

-- Track how many affiliate URLs were generated (for analytics).
CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform    TEXT        NOT NULL,
  pr_id       UUID,                      -- set once the PR is created
  original_url TEXT       NOT NULL,
  affiliate_url TEXT      NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aff_clicks_org ON affiliate_clicks (org_id, created_at DESC);

COMMIT;

-- Phase 7: File attachments for purchase requests
-- Supports images, PDFs, quotes, invoices attached to PRs.

CREATE TABLE IF NOT EXISTS pr_attachments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id),
  pr_id         UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  file_name     TEXT NOT NULL,
  file_type     TEXT NOT NULL,          -- MIME type: image/jpeg, application/pdf, etc.
  file_size     INTEGER NOT NULL,       -- bytes
  storage_key   TEXT NOT NULL,          -- S3/GCS key or local path
  uploaded_by   UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pr_attachments_pr ON pr_attachments(pr_id);

-- RLS
ALTER TABLE pr_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pr_attachments_org ON pr_attachments;
CREATE POLICY pr_attachments_org ON pr_attachments
  USING (org_id::text = current_setting('app.current_org', true));

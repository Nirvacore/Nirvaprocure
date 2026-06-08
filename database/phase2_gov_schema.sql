-- NIRVAPROCURE Phase 2 — NirvaGov TOR schema
-- Apply AFTER phase1_schema.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS tor_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    name            TEXT NOT NULL,                     -- e.g. "จัดซื้อครุภัณฑ์ทั่วไป"
    procurement_kind TEXT NOT NULL,                    -- e.g. 'goods' | 'services' | 'construction'
    -- Body uses {{placeholders}}; renderer fills them at draft time.
    body_markdown   TEXT NOT NULL,
    is_official     BOOLEAN NOT NULL DEFAULT FALSE,    -- ผ่านการรีวิวจาก legal แล้วหรือยัง
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE TYPE tor_status AS ENUM ('draft', 'review', 'approved', 'archived');

CREATE TABLE IF NOT EXISTS tor_drafts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    template_id     UUID REFERENCES tor_templates(id),
    title           TEXT NOT NULL,
    status          tor_status NOT NULL DEFAULT 'draft',
    -- Free-form structured brief that drives the AI draft. Schema is left
    -- loose because government TOR formats vary per agency.
    brief_json      JSONB NOT NULL,
    body_markdown   TEXT,                              -- AI-generated draft text
    compliance_checklist JSONB,                        -- {key: 'passed' | 'failed' | 'na', ...}
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tor_drafts_status ON tor_drafts (org_id, status);

DO $$
DECLARE t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY['tor_templates','tor_drafts']) LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
        EXECUTE format($p$
            CREATE POLICY %I_org_isolation ON %I
            USING (org_id = current_setting('app.current_org')::uuid);
        $p$, t, t);
    END LOOP;
END$$;

COMMIT;

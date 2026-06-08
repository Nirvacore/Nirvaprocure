-- NIRVAPROCURE Phase 1 Database Schema
-- PostgreSQL 15+. Multi-tenant via org_id with row-level security.
-- All monetary values stored in minor units (satang) as BIGINT to avoid float errors.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Reference: tenant root
-- ---------------------------------------------------------------------------
CREATE TABLE organizations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    country_code    CHAR(2) NOT NULL DEFAULT 'TH',
    base_currency   CHAR(3) NOT NULL DEFAULT 'THB',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- Identity (NirvaPeople)
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    email           CITEXT NOT NULL,
    full_name       TEXT NOT NULL,
    line_user_id    TEXT,
    password_hash   TEXT NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (org_id, email)
);
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE departments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    name            TEXT NOT NULL,
    cost_center     TEXT,
    parent_id       UUID REFERENCES departments(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE TABLE roles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    name            TEXT NOT NULL,                 -- e.g. 'requester', 'manager', 'finance', 'admin'
    permissions     JSONB NOT NULL DEFAULT '[]',
    UNIQUE (org_id, name)
);

CREATE TABLE user_roles (
    user_id         UUID NOT NULL REFERENCES users(id),
    role_id         UUID NOT NULL REFERENCES roles(id),
    department_id   UUID REFERENCES departments(id),
    PRIMARY KEY (user_id, role_id, department_id)
);

-- ---------------------------------------------------------------------------
-- Suppliers (NirvaBuy)
-- ---------------------------------------------------------------------------
CREATE TABLE suppliers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    name            TEXT NOT NULL,
    tax_id          TEXT,
    source          TEXT NOT NULL DEFAULT 'manual', -- manual | shopee | lazada | alibaba | makro
    external_ref    TEXT,                            -- shop id from marketplace
    contact_email   TEXT,
    contact_phone   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- Purchase Requests
-- ---------------------------------------------------------------------------
CREATE TYPE pr_status AS ENUM (
    'draft', 'submitted', 'in_approval', 'approved', 'rejected', 'cancelled', 'completed'
);

CREATE TABLE purchase_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES organizations(id),
    pr_number           TEXT NOT NULL,             -- human-readable, e.g. PR-2026-0001
    requester_id        UUID NOT NULL REFERENCES users(id),
    department_id       UUID REFERENCES departments(id),
    title               TEXT NOT NULL,
    justification       TEXT,
    status              pr_status NOT NULL DEFAULT 'draft',
    currency            CHAR(3) NOT NULL DEFAULT 'THB',
    total_minor         BIGINT NOT NULL DEFAULT 0, -- sum of items, in satang
    submitted_at        TIMESTAMPTZ,
    decided_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    UNIQUE (org_id, pr_number)
);

CREATE TABLE purchase_request_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES organizations(id),
    pr_id               UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
    line_no             INT NOT NULL,
    description         TEXT NOT NULL,
    quantity            NUMERIC(14,4) NOT NULL,
    unit                TEXT NOT NULL DEFAULT 'unit',
    unit_price_minor    BIGINT NOT NULL,
    line_total_minor    BIGINT GENERATED ALWAYS AS ((quantity * unit_price_minor)::BIGINT) STORED,
    supplier_id         UUID REFERENCES suppliers(id),
    -- Marketplace provenance for Shopee/Lazada/etc. imports
    source              TEXT,                       -- shopee | lazada | alibaba | makro | manual
    source_url          TEXT,
    source_metadata     JSONB,                      -- raw parsed payload
    UNIQUE (pr_id, line_no)
);

-- ---------------------------------------------------------------------------
-- Approval workflows (NirvaFlow)
-- ---------------------------------------------------------------------------
CREATE TABLE approval_workflows (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    name            TEXT NOT NULL,
    -- A rule predicate evaluated when a PR is submitted; first matching workflow wins.
    -- Example: { "min_amount_minor": 100000, "department_id": "..." }
    match_rules     JSONB NOT NULL DEFAULT '{}',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE approval_steps (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id     UUID NOT NULL REFERENCES approval_workflows(id) ON DELETE CASCADE,
    step_no         INT NOT NULL,                   -- 1-based; same step_no = parallel approvers
    approver_kind   TEXT NOT NULL,                  -- user | role | manager_of_requester
    approver_ref    TEXT NOT NULL,                  -- user_id | role name | 'manager'
    sla_hours       INT,
    UNIQUE (workflow_id, step_no, approver_kind, approver_ref)
);

CREATE TABLE approval_instances (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    pr_id           UUID NOT NULL REFERENCES purchase_requests(id),
    workflow_id     UUID NOT NULL REFERENCES approval_workflows(id),
    current_step    INT NOT NULL DEFAULT 1,
    status          TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | cancelled
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ
);

CREATE TABLE approval_decisions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id     UUID NOT NULL REFERENCES approval_instances(id) ON DELETE CASCADE,
    step_no         INT NOT NULL,
    approver_id     UUID NOT NULL REFERENCES users(id),
    decision        TEXT NOT NULL,                  -- approved | rejected
    comment         TEXT,
    decided_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Attachments
-- ---------------------------------------------------------------------------
CREATE TABLE attachments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    entity_type     TEXT NOT NULL,                  -- 'purchase_request' | 'supplier' | ...
    entity_id       UUID NOT NULL,
    filename        TEXT NOT NULL,
    mime_type       TEXT NOT NULL,
    size_bytes      BIGINT NOT NULL,
    storage_key     TEXT NOT NULL,                  -- S3 key
    uploaded_by     UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Notifications (LINE / email / in-app)
-- ---------------------------------------------------------------------------
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    user_id         UUID NOT NULL REFERENCES users(id),
    channel         TEXT NOT NULL,                  -- line | email | inapp
    template        TEXT NOT NULL,                  -- e.g. 'pr_submitted', 'approval_requested'
    payload         JSONB NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',-- pending | sent | failed
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Audit log (append-only, immutable)
-- ---------------------------------------------------------------------------
CREATE TABLE audit_log (
    id              BIGSERIAL PRIMARY KEY,
    org_id          UUID NOT NULL REFERENCES organizations(id),
    actor_user_id   UUID REFERENCES users(id),
    action          TEXT NOT NULL,                  -- e.g. 'pr.submit', 'pr.approve'
    entity_type     TEXT NOT NULL,
    entity_id       UUID NOT NULL,
    diff            JSONB,                          -- before/after where relevant
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX ON users (org_id) WHERE deleted_at IS NULL;
CREATE INDEX ON purchase_requests (org_id, status);
CREATE INDEX ON purchase_requests (org_id, requester_id);
CREATE INDEX ON purchase_request_items (pr_id);
CREATE INDEX ON approval_instances (org_id, pr_id);
CREATE INDEX ON approval_decisions (instance_id);
CREATE INDEX ON attachments (org_id, entity_type, entity_id);
CREATE INDEX ON notifications (org_id, user_id, status);
CREATE INDEX ON audit_log (org_id, entity_type, entity_id, created_at);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
-- Application sets `SET LOCAL app.current_org = '<uuid>'` per request.
-- Policies restrict every row to the current org.
DO $$
DECLARE t TEXT;
BEGIN
    FOR t IN
        SELECT unnest(ARRAY[
            'users','departments','roles','suppliers',
            'purchase_requests','purchase_request_items',
            'approval_workflows','approval_instances','approval_decisions',
            'attachments','notifications','audit_log'
        ])
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
        EXECUTE format($p$
            CREATE POLICY %I_org_isolation ON %I
            USING (org_id = current_setting('app.current_org')::uuid);
        $p$, t, t);
    END LOOP;
END$$;

COMMIT;

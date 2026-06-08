# Database

Schema design, ER diagrams, and migration plan.

## Conventions

- All tables carry `org_id UUID NOT NULL` for multi-tenancy.
- Row-level security policies enforce `org_id` isolation.
- Soft-delete columns: `deleted_at TIMESTAMPTZ NULL` (no hard deletes for audit-relevant tables).
- Timestamps: `created_at`, `updated_at`, both `TIMESTAMPTZ NOT NULL DEFAULT now()`.

## Phase 1 core tables

- `organizations`
- `users`, `roles`, `user_roles`
- `departments`
- `suppliers`
- `purchase_requests`, `purchase_request_items`
- `approval_workflows`, `approval_steps`
- `approval_instances`, `approval_decisions`
- `attachments`
- `notifications`
- `audit_log` (append-only)

## AI-related tables (Phase 2+)

- `embeddings` (pgvector)
- `ai_runs` — every AI call, cost, latency, prompt template id
- `price_observations` — historical prices per SKU/marketplace

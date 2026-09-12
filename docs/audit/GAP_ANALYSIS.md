---
title: Gap Analysis
repository: Nirvacore/Nirvaprocure
audited_at: 2026-08-19
audited_commit: a3e596dc40fc3b3f0af8419b40d189004341b51c
status: phase-0-review
---

# Gap Analysis — Nirvaprocure

| Priority | Gap | Phase 0 response |
|---|---|---|
| P0 | Procurement ownership overlaps extensively with nirvacore-v1. | Document, assign an owner, define evidence and migration gate; no automatic implementation. |
| P0 | Uses an independent PostgreSQL schema, identity model, approvals, and audit records. | Document, assign an owner, define evidence and migration gate; no automatic implementation. |
| P1 | Feature/data parity has not been proven record-by-record. | Document, assign an owner, define evidence and migration gate; no automatic implementation. |
| P1 | AI capabilities are product-local and not governed by shared prompt/model/eval controls. | Document, assign an owner, define evidence and migration gate; no automatic implementation. |

## Exit gates before migration

1. Source-backed feature and data parity is reviewed.
2. Canonical owner and entity mapping is approved.
3. Security, tenant isolation, audit, and approval controls are tested.
4. Backfill/reconciliation and rollback are rehearsed.
5. Consumers are migrated through compatibility adapters.
6. Production cutover and retirement receive explicit human approval.

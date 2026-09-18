---
title: Canonical Entity Map
repository: Nirvacore/Nirvaprocure
audited_at: 2026-08-19
audited_commit: a3e596dc40fc3b3f0af8419b40d189004341b51c
status: phase-0-review
---

# Canonical Entity Map — Nirvaprocure

| Concept | Current representation | Canonical owner | Decision |
|---|---|---|---|
| Purchase request/order | SQL procurement tables | platform | Compare with platform PurchaseRequest/PurchaseOrder and migrate only missing behavior/data. |
| Supplier | supplier and portal tables | platform | Reconcile with platform Supplier/Vendor. |
| Approval | approval workflow tables | platform | Adopt canonical platform approval records. |
| AI run/suggestion | phase6_ai_runs_schema.sql and backend AI modules | intelligence | Move orchestration/evals; retain deterministic procurement rules in platform. |

## Cross-cutting rule

Platform owns deterministic business truth. Intelligence owns derived knowledge, model/prompt configuration, agent/tool governance, citations, evaluations, and AI-run evidence. Infrastructure owns runtime services and operational controls. Product repositories may own experience-specific aggregates but should reference canonical identity, tenant, business, and audit records.

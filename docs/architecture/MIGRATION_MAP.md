---
title: Migration Map
repository: Nirvacore/Nirvaprocure
audited_at: 2026-08-19
audited_commit: a3e596dc40fc3b3f0af8419b40d189004341b51c
status: phase-0-review
---

# Migration Map — Nirvaprocure

**Decision:** `COMPARE_MERGE_MISSING_ARCHIVE`  
**Target role:** legacy procurement product to reconcile into platform

1. Create feature and data parity report against nirvacore-v1 procurement modules.
2. Declare platform entities canonical before any data movement.
3. Bridge missing capabilities through APIs/adapters.
4. Migrate only validated gaps and historical records with reconciliation.
5. Archive this repo after cutover, rollback window, and owner approval.

## Strangler controls

- Keep current APIs and schemas stable while introducing adapters.
- Compare behavior and data before choosing a canonical path.
- Dual-read or shadow-compare before write cutover where risk warrants it.
- Reconcile counts, identifiers, totals, approvals, evidence, and audit trails.
- Archive only after consumer cutover, rollback window, and explicit approval.

---
title: Current State Audit
repository: Nirvacore/Nirvaprocure
audited_at: 2026-08-19
audited_commit: a3e596dc40fc3b3f0af8419b40d189004341b51c
status: phase-0-review
---

# Current State — Nirvaprocure

## Audit rule

Only executable source, schemas, manifests, tests, workflows, and deployment definitions at commit `a3e596dc40fc3b3f0af8419b40d189004341b51c` are treated as implementation evidence. Roadmaps and READMEs describe intent unless corroborated by source. No business code, schema, secret, or production configuration is changed by this audit.

## Repository snapshot

| Field | Value |
|---|---|
| Repository | Nirvacore/Nirvaprocure |
| Audited source branch | main |
| Documentation branch | agent/phase-0-source-audit-20260819 |
| Audited commit | a3e596dc40fc3b3f0af8419b40d189004341b51c |
| Package manager | npm + Flutter pub |
| Repository shape | backend/frontend/mobile multi-application repository |
| Strategic role | legacy procurement product to reconcile into platform |
| Classification | COMPARE_MERGE_MISSING_ARCHIVE |
| Stack | NestJS 10, PostgreSQL, Next.js 14, Flutter, Docker, GitHub Actions |

Standalone procurement system with NestJS/PostgreSQL backend, Next.js frontend, Flutter mobile application, SQL migrations, OpenAPI, tests, and deployment assets.

## Evidence-backed capability status

| Capability | Status | Evidence conclusion |
|---|---|---|
| Procurement workflow | implemented | PR, PO, suppliers, receiving, stock, approval, portal, risk, budget, and audit source exists. |
| Mobile client | implemented | Flutter source and CI exist. |
| AI augmentation | partial | AI-run/anomaly/suggestion code exists; central governance is absent. |
| Events | partial | Webhooks and notifications exist; no transactional outbox/event bus was found. |

## Primary source evidence

| Path | Finding |
|---|---|
| `backend/src` | 28 NestJS modules and 27 controllers. |
| `database` | 40 CREATE TABLE statements across versioned SQL files. |
| `frontend/app` | 25 Next.js pages. |
| `mobile` | Flutter application source. |
| `api/openapi.yaml` | API contract. |
| `.github/workflows` | Web/backend and mobile CI definitions. |

## Boundaries

- This document records current state; it does not authorize migration.
- Preserve the current code and use strangler migration.
- Do not migrate schemas, delete code, rotate secrets, or change production configuration in Phase 0.
- A filename or roadmap statement is not proof that a feature is operational.

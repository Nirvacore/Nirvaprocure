---
title: Event Architecture
repository: Nirvacore/Nirvaprocure
audited_at: 2026-08-19
audited_commit: a3e596dc40fc3b3f0af8419b40d189004341b51c
status: phase-0-review
---

# Event Architecture — Nirvaprocure

## Verified current state

Webhooks, push/notification behavior, and workflow records exist, but no durable outbox or common Nirva event envelope was found. Use canonical procurement events from platform rather than introducing another product-local bus.

## Target contract

```text
Business transaction (platform)
  -> same-database transactional outbox
  -> broker operated by nirva-infrastructure
  -> idempotent platform/product/intelligence consumers
  -> trace, audit, retry, dead-letter, and replay controls
```

Every canonical event should include `event_id`, `event_type`, `schema_version`, `occurred_at`, `producer`, `tenant_id`, `organization_id`, `actor_id`, `correlation_id`, `causation_id`, `data_classification`, and a minimal payload. Events are facts, not remote commands. Sensitive payloads should use references or encrypted storage rather than broad replication.

## Phase 0 decision

Document existing transports and proposed contracts only. Do not introduce a broker, migrate state, or change production routing in this phase.

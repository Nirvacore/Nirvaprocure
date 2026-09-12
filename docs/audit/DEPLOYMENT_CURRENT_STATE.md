---
title: Deployment Current State
repository: Nirvacore/Nirvaprocure
audited_at: 2026-08-19
audited_commit: a3e596dc40fc3b3f0af8419b40d189004341b51c
status: phase-0-review
---

# Deployment Current State — Nirvaprocure

Docker Compose, Fly.io definitions, VPS scripts, backup/smoke scripts, and CI exist. Preserve them until platform parity and cutover are verified.

## Ownership direction

- Application-specific Dockerfiles and runtime requirements stay with the application.
- Reusable Compose modules, Terraform, future Kubernetes, broker, observability, secret-management, backup, and disaster-recovery infrastructure converge toward `nirva-infrastructure`.
- Release governance and manifests currently found in `nirva-ops` are inputs to that convergence.
- Deployment product behavior in `nirvadeploy` remains distinct from shared infrastructure definitions.

## Safety boundary

This audit does not deploy, restart, reconfigure, rotate, or delete anything. File presence proves a versioned definition exists; it does not prove the target is live, healthy, secure, backed up, or current.

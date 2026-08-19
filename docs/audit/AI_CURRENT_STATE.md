---
title: AI Current State Audit
repository: Nirvacore/Nirvaprocure
audited_at: 2026-08-19
audited_commit: a3e596dc40fc3b3f0af8419b40d189004341b51c
status: phase-0-review
---

# AI Current State — Nirvaprocure

Procurement suggestions, anomaly detection, risk analysis, and AI-run records are partial local capabilities. Deterministic procurement rules stay in platform; procurement audit/risk agents, RAG, MCP, prompts, citations, and evals move to intelligence.

## Strategic ownership rule

| Concern | Canonical owner |
|---|---|
| Finance/Legal deterministic calculations, ledgers, records, workflows, approvals, policies, evidence, audit | nirva-platform (evolving from nirvacore-v1) |
| Finance/Legal agents, RAG, MCP tools, prompt/model registries, citations, hallucination tests, red-team tests, evaluations | nirva-intelligence (evolving from nirva-AI) |
| Model/runtime infrastructure, Qdrant, LiteLLM, telemetry, secrets, backup | nirva-infrastructure |

## Governance minimum before production AI

- Platform-issued user, organization, tenant, role, policy, and correlation context.
- Tool registry with owner, version, risk, read/write class, permission, scope, approval, rate limit, timeout, data classification, and audit level.
- Versioned prompt/model/knowledge inputs with source provenance and citations.
- Offline and release evaluations, hallucination tests, red-team tests, and promotion approval.
- Immutable AI run, tool, approval, evidence, cost, and outcome audit records.

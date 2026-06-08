# Risk Register

**Owner:** CTO · **Reviewed:** quarterly + after any SEV-1
**Standards:** ISO 27001 6.1.2 (info-sec risk assessment), ISO 31000

Likelihood × Impact = Score (1–5 each, 25 max). Treatments are tracked to
explicit owners. This register is the single source of truth — don't
maintain risk lists in slide decks or spreadsheets outside this file.

## Scoring scale

| Score | Likelihood | Impact |
|---|---|---|
| 1 | Once per 5+ years | Negligible — internal annoyance only |
| 2 | Once per 1–2 years | Minor — minutes of one tenant's downtime |
| 3 | Once per quarter | Moderate — hours of partial outage |
| 4 | Once per month | Major — full-day outage or material data loss |
| 5 | Once per week or more | Critical — multi-day, regulator-reportable breach |

## Risk register

| # | Risk | L | I | Score | Owner | Treatment | Status |
|---|---|---|---|---|---|---|---|
| **R-01** | Leaked JWT signing key | 2 | 5 | 10 | CTO | Secret rotation runbook (IR §3); 12-month rotation cron; `token_version` invalidation | ✅ mitigated |
| **R-02** | RLS bypass via missing `withOrg` wrapper | 2 | 5 | 10 | Eng Lead | Helper-only pattern; CI rule (TODO); regression test per cross-tenant access | ◑ partial |
| **R-03** | Supply-chain CVE in npm dep | 4 | 4 | 16 | Eng Lead | Dependabot weekly + security alerts daily; SBOM (TODO) | ✅ mitigated |
| **R-04** | LINE chat postback spoofed | 2 | 4 | 8 | CTO | HMAC-SHA256 signature verify on every webhook; constant-time compare; raw-body capture | ✅ mitigated |
| **R-05** | Approver-self-approves bypass | 1 | 5 | 5 | Eng Lead | Hard guard in `ApprovalsService.decide`; spec coverage | ✅ mitigated |
| **R-06** | Data subject request (PDPA §30) unfulfilled within 30 days | 3 | 3 | 9 | DPO | `/compliance/export/me` endpoint; runbook in COMPLIANCE.md; weekly DPO inbox review | ✅ mitigated |
| **R-07** | Breach notification (PDPA §39) misses 72h deadline | 2 | 5 | 10 | DPO | IR runbook §4; on-call paging tree; quarterly drill | ◑ partial — drill not yet run |
| **R-08** | Fly.io Singapore region outage | 3 | 5 | 15 | CTO | Daily backups to S3; BCP Scenario B/C; multi-region not yet (cost) | ◑ partial — no multi-region |
| **R-09** | Backup restore fails silently | 2 | 5 | 10 | CTO | Monthly restore drill; row-count + audit_log checksum compared | ◑ partial — drill not yet run |
| **R-10** | Dependency on OpenAI/Anthropic — API down or pricing change | 3 | 2 | 6 | CTO | NirvaAI has stub mode; rule-based fallback for price-compare; second provider (Claude) as failover | ✅ mitigated |
| **R-11** | Single point-of-knowledge for ops (bus factor 1) | 4 | 3 | 12 | CEO | Runbooks under `docs/` (DEPLOY, BCP, IR); shadow on-call rotation | ◑ partial |
| **R-12** | PII leak via AI prompt | 3 | 4 | 12 | Eng Lead | NirvaAI redacts PII before send; AI prompt review in code review; data-class label on outbound payload (TODO) | ◑ partial |
| **R-13** | Insider data exfiltration via SQL access | 2 | 5 | 10 | CTO | Production DB access via Fly.io proxy + audit; psql session logging (TODO); 2FA + role gates | ◑ partial |
| **R-14** | Outdated TLS cert / cert expiry | 1 | 4 | 4 | CTO | Fly.io edge handles auto-renew; monitoring on expiry (TODO) | ✅ mitigated |
| **R-15** | DDoS on `/auth/login` | 3 | 3 | 9 | Eng Lead | Throttler middleware (5 req/min/IP); Fly.io edge rate limits | ✅ mitigated |
| **R-16** | Audit log tampering | 2 | 5 | 10 | Eng Lead | Append-only INSERT permission only; daily checksum to S3 with object lock; Postgres `audit_log` has no UPDATE/DELETE permission grants | ✅ mitigated |
| **R-17** | Anomaly cron silently fails (alerts not raised) | 3 | 3 | 9 | Eng Lead | Cron heartbeat into `audit_log`; Sentry alert on missed beat (TODO) | ✗ gap |
| **R-18** | LINE rate limit at customer scale | 3 | 2 | 6 | CTO | Per-org daily push budget tracked in `notifications` table; falls back to in-app inbox | ◑ partial |
| **R-19** | Pseudonymization reversed via correlation | 2 | 4 | 8 | DPO | `pseudo_id` derived from `pepper + user_id`; pepper rotated annually; documented in COMPLIANCE.md | ✅ mitigated |
| **R-20** | Customer churns and demands full data export + delete | 4 | 2 | 8 | DPO | `/compliance/export/me` and `/compliance/redact/:id` exist; documented; 30-day SLA | ✅ mitigated |

## Treatment tracker

| Risk # | Action | Due | Status |
|---|---|---|---|
| R-02 | CI rule: any new `pool.query` outside `withOrg` blocks PR | 2026-06-30 | open |
| R-03 | Generate + publish SBOM via CycloneDX in CI | 2026-06-30 | open |
| R-07 | First quarterly PDPA breach drill | 2026-06-15 | scheduled |
| R-08 | Spike: cost of multi-region (Tokyo / Mumbai readonly replica) | 2026-07-31 | open |
| R-09 | First monthly backup restore drill | 2026-06-15 | scheduled |
| R-11 | Document an on-call rotation in `STATUS.md` Owners table | 2026-06-30 | open |
| R-12 | Data classification label on every AI outbound payload | 2026-08-31 | open |
| R-13 | psql session logging via `log_statement = all` + ship to S3 | 2026-09-30 | open |
| R-14 | Monitor cert expiry via cert-monitoring service | 2026-07-31 | open |
| R-17 | Sentry cron alert on missed `AnomalyScanJob` heartbeat | 2026-06-30 | open |

## Review log

| Date | Reviewer | Notes |
|---|---|---|
| 2026-05-23 | CTO | Initial register created |
| TBD | TBD | Next quarterly review |

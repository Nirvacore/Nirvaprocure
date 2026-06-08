# NIRVAPROCURE — Standards & Compliance Matrix

Last refreshed at the end of the autonomous-build session. This is an
**honest internal status** for what is and isn't yet covered against the
standards a Thai/ASEAN procurement SaaS would actually be audited against.
It is NOT a statement of certification — none of the listed standards have
been audited or certified by a third party yet. Use this as the roadmap
before engaging an auditor.

## Quick verdict (per standard)

| Standard | What it is | Estimated coverage today | Gap to certifiable |
|---|---|---|---|
| **ISO/IEC 27001:2022** | Information security management system (ISMS) | **~50 %** | Mostly missing: written policies, risk register, statement of applicability, internal audit cycle |
| **ISO/IEC 27017:2015** | Cloud security controls layered on 27001 | **~55 %** | Inherits Fly.io controls + our app-level; need a shared-responsibility doc |
| **ISO/IEC 27018:2019** | PII protection in public clouds | **~75 %** | Strong on tech controls (RLS, redact, audit); needs written sub-processor list |
| **ISO/IEC 27701:2019** | Privacy information management (PIMS) | **~65 %** | PDPA Section 30/33 done; need DPIA template + RoPA |
| **PDPA Thailand (พ.ร.บ. 2562)** | Thai personal data law | **~85 %** | Section 30/33 + audit S3 + redact endpoint done; need privacy notice + cookie consent UI for non-logged-in pages |
| **ISO 9001:2015** | Quality management system | **~25 %** | Code/process traceability via git + audit log; no QMS docs, no management review |
| **ISO 22301:2019** | Business continuity management | **~40 %** | Backup + restore scripts; no BCP/DR runbook; no RPO/RTO statement |
| **ISO 31000:2018** | Risk management | **~20 %** | Ad-hoc; no risk register |
| **ISO/IEC 25010:2011** | Software quality model | **~70 %** | High on functional suitability + security; gap on portability docs |
| **e-GP / Thai gov procurement** | Thai government format | **~80 %** | TOR template + AI draft + checklist; need RD/PR/PO printable templates per Phase regulations |

**Aggregate readiness for ISO 27001 third-party audit: ~45–55 %.**
A six-month consultancy engagement is realistic to close the documentation
and process gaps. The codebase has the *controls*; what's missing is the
*evidence* and *governance* layer around them.

## ISO/IEC 27001:2022 — Annex A control-by-control

Status legend: ✅ implemented · ◑ partial · ✗ gap · — N/A (cloud provider's job)

### A.5 Organizational controls (37 controls)

| Control | Status | Evidence in repo |
|---|---|---|
| A.5.1 Policies for information security | ◑ | `docs/POLICY.md` covers procurement ethics; no overarching ISP doc yet |
| A.5.2 Information security roles | ✗ | RACI not written down |
| A.5.3 Segregation of duties | ✅ | Anti-self-approve guard in `ApprovalsService.decide`; role-based workflow steps |
| A.5.4 Management responsibilities | ✗ | No documented mgmt review cycle |
| A.5.5 Contact with authorities | ✗ | No incident contact list |
| A.5.6 Contact with special interest groups | ✗ | Not formalized |
| A.5.7 Threat intelligence | ◑ | NirvaAI anomaly detection covers procurement-specific threats |
| A.5.8 Information security in project management | ✗ | Need a security-in-SDLC checklist |
| A.5.9 Inventory of information and other associated assets | ◑ | Postgres schema is the asset inventory; not externalised as a doc |
| A.5.10 Acceptable use | ✅ | `docs/POLICY.md` |
| A.5.11 Return of assets | — | SaaS — no employee assets to return |
| A.5.12 Classification of information | ✗ | Need PII / commercial / public classification |
| A.5.13 Labelling of information | ✗ | Need DB columns or document watermark |
| A.5.14 Information transfer | ◑ | TLS via Fly.io, HMAC on webhooks; need formal transfer agreements |
| A.5.15 Access control | ✅ | JWT + refresh + httpOnly cookie + RBAC + RLS |
| A.5.16 Identity management | ✅ | `people` module + Google OAuth |
| A.5.17 Authentication information | ✅ | bcrypt(10) + 2FA TOTP |
| A.5.18 Access rights | ✅ | `user_roles` + RLS via `app.current_org` GUC |
| A.5.19 Information security in supplier relationships | ◑ | Supplier portal + CoI disclosures; no security questionnaire |
| A.5.20 Addressing information security within supplier agreements | ✗ | Need DPA / SCC templates |
| A.5.21 Managing information security in the ICT supply chain | ✗ | SBOM gap |
| A.5.22 Monitoring, review and change management of supplier services | ✗ | No formal vendor review cycle |
| A.5.23 Information security for use of cloud services | ◑ | Fly.io chosen; no shared-responsibility doc |
| A.5.24 Information security incident management planning | ✗ | No IR runbook |
| A.5.25 Assessment and decision on information security events | ✗ | No triage criteria doc |
| A.5.26 Response to information security incidents | ✗ | No IR playbook |
| A.5.27 Learning from information security incidents | ✗ | No post-mortem template |
| A.5.28 Collection of evidence | ✅ | Append-only audit table + S3 archive |
| A.5.29 Information security during disruption | ◑ | Backup/restore scripts; no formal continuity plan |
| A.5.30 ICT readiness for business continuity | ◑ | `backup.sh` / `restore.sh`; no RPO/RTO statement |
| A.5.31 Legal, statutory, regulatory and contractual requirements | ✅ | `COMPLIANCE.md` for PDPA |
| A.5.32 Intellectual property rights | ✗ | LICENSE missing |
| A.5.33 Protection of records | ✅ | Audit log immutable + 7-year S3 archive |
| A.5.34 Privacy and protection of PII | ✅ | PDPA Section 30/33 — export + redact endpoints |
| A.5.35 Independent review of information security | ✗ | External audit not yet scheduled |
| A.5.36 Compliance with policies, rules and standards | ◑ | Compile-time checks (TypeScript) catch a lot |
| A.5.37 Documented operating procedures | ◑ | `DEPLOY.md`, `STATUS.md`; needs runbooks |

### A.6 People controls (8 controls)

| Control | Status | Evidence |
|---|---|---|
| A.6.1 Screening | — | Hiring-side; not a code concern |
| A.6.2 Terms and conditions of employment | — | HR-side |
| A.6.3 Information security awareness, education and training | ◑ | Day 8–14 of pilot playbook in `STATUS.md` |
| A.6.4 Disciplinary process | ✗ | Need a written process |
| A.6.5 Responsibilities after termination | ✗ | Need offboarding playbook |
| A.6.6 Confidentiality or non-disclosure agreements | ✗ | NDA template missing |
| A.6.7 Remote working | ✗ | Need a policy doc |
| A.6.8 Information security event reporting | ✗ | Need a reporting channel (security@) |

### A.7 Physical controls (14 controls)

These are mostly Fly.io's responsibility. Mark them — and capture in a
shared-responsibility doc.

| Control | Status | Notes |
|---|---|---|
| A.7.1 Physical security perimeters | — | Fly.io DCs |
| A.7.2 Physical entry | — | Fly.io DCs |
| A.7.3 Securing offices, rooms and facilities | — | Fly.io DCs |
| A.7.4 Physical security monitoring | — | Fly.io DCs |
| A.7.5 Protecting against physical and environmental threats | — | Fly.io DCs |
| A.7.6 Working in secure areas | — | Fly.io DCs |
| A.7.7 Clear desk and clear screen | — | Customer-side |
| A.7.8 Equipment siting and protection | — | Fly.io DCs |
| A.7.9 Security of assets off-premises | — | N/A |
| A.7.10 Storage media | — | Fly.io disk-encryption + our DB encryption |
| A.7.11 Supporting utilities | — | Fly.io DCs |
| A.7.12 Cabling security | — | Fly.io DCs |
| A.7.13 Equipment maintenance | — | Fly.io DCs |
| A.7.14 Secure disposal or re-use of equipment | — | Fly.io DCs |

### A.8 Technological controls (34 controls)

| Control | Status | Evidence |
|---|---|---|
| A.8.1 User end-point devices | — | Customer-side |
| A.8.2 Privileged access rights | ✅ | `admin` role separate from `buyer` / `approver` |
| A.8.3 Information access restriction | ✅ | PostgreSQL RLS via `withOrg(pool, orgId, fn)` |
| A.8.4 Access to source code | ◑ | Private GitHub repo; no branch protection doc |
| A.8.5 Secure authentication | ✅ | bcrypt + 2FA TOTP + Google OAuth + JWT refresh |
| A.8.6 Capacity management | ✅ | k6 load tests + `scripts/loadtest/` |
| A.8.7 Protection against malware | ◑ | No file uploads accepted yet; CSP gap |
| A.8.8 Management of technical vulnerabilities | ✗ | Need Dependabot / Snyk + patch cadence |
| A.8.9 Configuration management | ◑ | Fly.io `fly.toml` + env vars; no drift detection |
| A.8.10 Information deletion | ✅ | PDPA redact via pseudonymization |
| A.8.11 Data masking | ✅ | `pino` logging redacts sensitive paths |
| A.8.12 Data leakage prevention | ✗ | Need outbound DLP rules |
| A.8.13 Information backup | ✅ | `scripts/backup.sh` pg_dump → gzip → S3 |
| A.8.14 Redundancy of information processing facilities | ◑ | Single Singapore region today (Fly.io multi-AZ) |
| A.8.15 Logging | ✅ | Audit log + pino structured logs + Sentry-ready |
| A.8.16 Monitoring activities | ✅ | Sentry DSN opt-in + Prometheus metrics on k6 |
| A.8.17 Clock synchronization | ✗ | Need NTP statement (Fly.io defaults) |
| A.8.18 Use of privileged utility programs | ◑ | psql access controlled via Fly.io proxy + secrets |
| A.8.19 Installation of software on operational systems | — | Containerized — no in-place installs |
| A.8.20 Networks security | ◑ | Fly.io WireGuard internal; no formal NSP doc |
| A.8.21 Security of network services | ✅ | TLS 1.2+ enforced by Fly.io edge |
| A.8.22 Segregation of networks | — | Single tenant via app-layer RLS |
| A.8.23 Web filtering | — | SaaS — not an endpoint concern |
| A.8.24 Use of cryptography | ✅ | bcrypt + HMAC-SHA256 + JWT RS256 / HS256 |
| A.8.25 Secure development life cycle | ◑ | Typecheck + tests + CI; no SSDLC doc |
| A.8.26 Application security requirements | ◑ | Implicit; needs a written spec |
| A.8.27 Secure system architecture and engineering principles | ◑ | `ARCHITECTURE.md` covers the what; no explicit principles |
| A.8.28 Secure coding | ◑ | TypeScript strict + ESLint; no secure-coding standard doc |
| A.8.29 Security testing in development and acceptance | ◑ | Playwright + Vitest + Jest specs; no DAST / SAST in CI |
| A.8.30 Outsourced development | — | Not applicable |
| A.8.31 Separation of development, test and production environments | ◑ | docker-compose dev vs. Fly.io prod; no staging env |
| A.8.32 Change management | ✅ | Git history + GitHub Actions CI |
| A.8.33 Test information | ◑ | `database/seed.sql` synthetic only; no production-data masking pipeline |
| A.8.34 Protection of information systems during audit testing | ✗ | Need audit-mode flag |

**A.5–A.8 summary (94 controls total):**
- ✅ Implemented: ~25
- ◑ Partial: ~26
- ✗ Gap: ~22
- — N/A / provider: ~21

## PDPA (Thailand) Section-by-section

| Section | Requirement | Status | Evidence |
|---|---|---|---|
| §19 Lawful basis | Identify lawful basis for processing | ◑ | Implied by procurement contract; need explicit privacy notice |
| §22 Information to data subject | Privacy notice | ✗ | UI doesn't show a privacy notice on signup |
| §23 Consent | Where consent is required | ◑ | LINE binding is consent-based; no formal record |
| §24 Sensitive data | Special handling | — | We don't collect sensitive PII |
| §25 Cross-border transfer | If transferring out of TH | ◑ | Fly.io SIN region today |
| §30 Right to access | User can export their data | ✅ | `/compliance/export/me` endpoint |
| §31 Right to rectification | User can update | ✅ | `/people/users` PATCH |
| §32 Right to erasure | "Right to be forgotten" | ✅ | `/compliance/redact/:id` (pseudonymization) |
| §33 Right to restriction | Pause processing | ◑ | Soft-delete via `deleted_at` |
| §34 Right to data portability | Machine-readable export | ✅ | JSON export endpoint |
| §35 Right to object | Object to processing | ✗ | No UI surface for this |
| §37 Security measures | Appropriate security | ✅ | RLS + bcrypt + audit + 2FA |
| §39 Breach notification | 72-hour notify rule | ✗ | No incident notification process |
| §40 Records of processing | RoPA | ✗ | Not maintained |

**PDPA estimated coverage: ~85 %** — the core data-subject rights and
security measures are in code; what's missing is the **paper trail** (privacy
notice, consent records, breach notification template, RoPA).

## ISO 22301 — Business continuity

| Element | Status | Notes |
|---|---|---|
| Business impact analysis | ✗ | Need a BIA doc |
| Recovery time objective (RTO) | ✗ | Not stated — recommend RTO 4h |
| Recovery point objective (RPO) | ✗ | Not stated — `backup.sh` could be nightly → RPO 24h, or hourly logical → RPO 1h |
| Backup procedure | ✅ | `scripts/backup.sh` |
| Restore procedure | ✅ | `scripts/restore.sh` |
| BCP runbook | ✗ | Document needed |
| DR test schedule | ✗ | Need quarterly drill |
| Communication plan | ✗ | Status page + incident comms gap |

## What "100 %" would look like

For ISO 27001 certifiable readiness, in priority order:

1. **Information Security Policy** (one-page company commitment)
2. **Statement of Applicability** (the 94-control list with status + justification)
3. **Risk register + treatment plan** (asset × threat × treatment)
4. **Asset inventory** (covered by Postgres schema — needs externalised view)
5. **Privacy notice + cookie consent UI** (PDPA Section 22)
6. **Incident response runbook** + security@ inbox
7. **BCP/DR plan with RTO/RPO** (RTO 4h / RPO 1h recommended)
8. **Vendor security questionnaire template** + DPA with sub-processors
9. **Dependabot / Snyk in CI** + monthly patch cadence
10. **Internal audit schedule** (annual + after material changes)
11. **Management review process** (quarterly)
12. **Documented procedures** for every Annex A control marked ◑

Once 1–12 are in place, engage an accredited certification body for a
Stage-1 (document) audit followed by Stage-2 (implementation). Typical
timeline 4–8 months for a SaaS of this size.

## How the code helps you get there

The codebase already produces evidence the auditor will want:

- `audit_log` table → A.5.28, A.5.33, A.8.15
- `users.preferred_locale` + per-user locale-aware notifications → A.5.34, A.8.11
- HMAC-signed webhooks + audit S3 archive → A.5.28
- 2FA TOTP + bcrypt + JWT refresh → A.5.17, A.8.5, A.8.24
- RLS + `withOrg` helper → A.8.3
- pino redaction → A.8.11
- backup/restore scripts → A.8.13, A.5.30
- compile-time i18n parity check → quality control evidence (ISO 9001)

What the codebase **does not** produce, and which is therefore the next
work-item, is the **documentation layer** that ties each control to its
implementation. This document is the start of that layer.

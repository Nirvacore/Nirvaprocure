# Information Security Policy

**Owner:** CEO / CTO
**Version:** v1 · 2026-05-23
**Review cycle:** annual, or after any material incident or system change

## 1. Purpose

This policy defines NIRVAPROCURE's commitment to protecting the confidentiality,
integrity, and availability of customer data and the systems that process it.
It applies to every employee, contractor, and supplier who handles the platform
or the data it holds.

## 2. Scope

Everything inside the `NIRVAPROCURE/` codebase, all production infrastructure
(Fly.io Singapore, Amazon S3 Singapore), and every workstation used by people
with production access. Out of scope: customer-managed integrations beyond
our API contract.

## 3. Principles

1. **Least privilege** — grant the smallest permission set that lets a person
   do their job. RBAC roles in the platform must be reviewed quarterly.
2. **Defense in depth** — no single control is allowed to be the last line.
   Auth, RLS, audit log, and incident response all reinforce each other.
3. **Tenant isolation by default** — every database call runs through
   `withOrg(pool, orgId, fn)`; raw `pool.query` outside that helper requires
   an explicit code-review approval.
4. **Auditable by construction** — anything that mutates customer state must
   leave a row in `audit_log`. CI rejects unaudited writes.
5. **Data minimization** — collect only what's needed to fulfill procurement
   contracts (see `PRIVACY` policy / `STANDARDS.md` PDPA matrix).
6. **Secure by default** — TLS everywhere, bcrypt for passwords, JWT short
   TTL with refresh, 2FA TOTP for admin accounts.

## 4. Roles and responsibilities

| Role | Responsibility |
|---|---|
| CEO | Owns this policy; final escalation for major incidents |
| CTO | Owns implementation; chairs the quarterly security review |
| DPO (Data Protection Officer) | PDPA compliance, breach notifications, data-subject requests |
| Engineering Lead | Code-side controls; on-call rotation; runs IR drills |
| All staff | Read this policy on hire; report incidents to security@nirvaprocure.com |

## 5. Acceptable use

- Production access requires SSO + 2FA TOTP. No shared accounts.
- Customer data may NEVER be copied to laptops, personal cloud, or local files.
- AI tools (OpenAI / Anthropic) may receive only the minimum payload needed
  for the requested analysis. No PII unless redacted.
- Screenshots of production data may not be posted in public channels.

## 6. Vendor / sub-processor management

We use Fly.io (compute + Postgres + edge TLS), Amazon S3 (audit archive),
LINE Corp. (notifications), OpenAI / Anthropic (AI assist). New sub-processors
require: (a) DPA review by the DPO, (b) security questionnaire, (c) update
to the public privacy notice. Reviewed annually.

## 7. Incident response

Reportable events: any suspected breach of confidentiality, integrity, or
availability that could affect customer data. See `docs/INCIDENT_RESPONSE.md`
for the runbook. Critical incidents must be reported to the DPO within 1
hour of detection.

## 8. Business continuity

See `docs/BCP.md` for RTO/RPO and the recovery runbook. Restore drills run
quarterly.

## 9. Policy violations

Material violation → up to and including termination. Repeated minor
violations → mandatory re-training. The CTO documents each violation in
the audit log.

## 10. Review

This policy is reviewed by the CTO every 12 months, or sooner if any of
the following occur: change to applicable regulation (PDPA amendments, new
ISO version), material change to architecture, or an incident reveals a gap.

The current version is published in `docs/INFORMATION_SECURITY_POLICY.md`
and linked from the README. All staff acknowledge it during onboarding.

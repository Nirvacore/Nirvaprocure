# PDPA Compliance — NIRVAPROCURE

Quick reference for how Thai PDPA (พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล 2562)
maps to the system. **Not legal advice** — verify with your DPO before production.

## What we collect (per user)

| Field | Where | Lawful basis | Retention |
|-------|-------|--------------|-----------|
| email, full_name | `users` | Contract — needed to operate the account | Until redact request, then pseudonymized |
| line_user_id     | `users` | Consent — opt-in in notification settings | Cleared on redact, or when user turns off LINE |
| password_hash    | `users` | Contract | Wiped on redact |
| PR content, approval decisions | `purchase_requests`, `approval_decisions` | Contract + legitimate interest (audit) | 7 years (Thai accounting law) |
| audit_log entries | `audit_log` | Legal obligation | 90 days default, configurable |

## Right of access — PDPA Section 30

`GET /v1/compliance/export/me`

Returns a JSON dump of every personal-data row tied to the caller. Includes user
profile, department/role bindings, purchase requests they originated, approval
decisions they made, and recent audit log entries.

Admins can use `GET /v1/compliance/export/:user_id` on behalf of any user in
their org.

## Right of erasure — PDPA Section 33

`POST /v1/compliance/redact/:user_id`

We use **pseudonymization** rather than hard delete: the user's PII (email,
name, LINE id, password) is overwritten with deterministic tokens, the account
is marked inactive, and `deleted_at` is set. The foreign-key graph stays
intact so:

- approval trails still render ("[redacted] approved on Jan 5")
- audit logs remain attributable to a stable token
- 7-year accounting retention is satisfied

A hard delete would corrupt the audit trail and is generally NOT the right
move under PDPA — Section 33(3) explicitly allows continued processing when
retention is required by other laws.

## Audit log retention

`POST /v1/compliance/audit/purge?days=90`

Deletes audit_log rows older than `days` (30–3650). Default 90. **Run this on a
schedule.** Recommended setup:
- nightly cron at 02:00 Asia/Bangkok
- dumps the deletion set to S3 + Glacier before erasing (TODO — not implemented)

## Cookie & consent

httpOnly auth cookies are strictly necessary — no banner required under PDPA
(equivalent to GDPR Article 5 Recital 30 carve-out for session cookies). If we
ever add analytics/marketing cookies, those need an explicit opt-in banner.

## DSR ticket flow

A data-subject request comes in →
1. Verify identity (email + recent 2FA, or admin acknowledgement)
2. Run `/compliance/export/:user_id` → email JSON dump to user (encrypted zip)
3. If user requested deletion, run `/compliance/redact/:user_id`
4. Confirm in writing within 30 days (Section 31)

## What's deliberately NOT implemented yet

- Consent ledger (per-purpose granular consent)
- Cross-border transfer logging
- DPO contact page in product
- Automated DSR ticket queue
- S3 cold-storage dump before audit purge

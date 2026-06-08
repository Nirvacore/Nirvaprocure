# Incident Response Runbook

**Owner:** CTO · **Backup:** Engineering Lead
**Last drilled:** TBD — schedule first drill within 30 days of pilot live date

Covers ISO 27001 controls A.5.24–A.5.27 and PDPA §39 (72-hour breach
notification). Use this when something is on fire OR when someone suspects
it might be.

## Severity matrix

| Severity | Definition | Response time | Page |
|---|---|---|---|
| **SEV-1** | Production unreachable OR confirmed PII breach OR auth bypass in the wild | Within 5 min | All on-call + CTO + DPO + CEO |
| **SEV-2** | Material degradation OR suspected breach, unverified | Within 15 min | On-call + CTO |
| **SEV-3** | Single-tenant or partial impact, workaround available | Within 1 hour | On-call |
| **SEV-4** | Non-urgent (latency creep, single failed webhook) | Next business day | On-call queue |

## The IR loop

Five phases. Don't skip; don't get stuck on one.

### 1. Detect

Sources we monitor (any of these can trigger an incident):
- **Sentry** (DSN set in `SENTRY_DSN`) — runtime exceptions, captured client + server
- **Fly.io alerts** — host-level CPU, memory, restart loops
- **Customer report** via `security@nirvaprocure.com` or in-app `Support` link
- **Anomaly detector cron** (`AnomalyScanJob`) — surfaces price spikes,
  CoI patterns; only some of these are security-relevant
- **GitHub Dependabot** — `dependencies` label on PRs flags new CVEs
- **`audit_log`** — UNUSUAL row counts on `pr.decide` or `user.delete`

The first responder OPENS AN INCIDENT (channel #incident-YYYY-MM-DD) within
the SLA above. Don't wait for confirmation that "it's really a thing."

### 2. Triage

Within 15 minutes of opening:

1. Confirm severity. Re-classify if needed.
2. Stop the bleeding — feature flag off the suspect endpoint, roll back the
   suspect deploy (`flyctl deploy --image <previous-sha>`), or pause the
   cron job. Don't try to debug first; contain first.
3. Snapshot evidence:
   ```bash
   # Postgres state for the affected tenant
   psql "$DATABASE_URL" -c \
     "SELECT * FROM audit_log WHERE org_id = '<org>' AND created_at > now() - interval '1 hour' ORDER BY created_at DESC"
   # Fly.io app + machine logs
   flyctl logs -a nirva-backend --since 1h > evidence/log-$(date -u +%FT%H%M).txt
   # Sentry — copy the issue URL into the incident channel
   ```
4. Assign roles in the channel:
   - **Incident Commander** (IC) — drives the response, doesn't fix
   - **Operations Lead** — runs the fix
   - **Comms Lead** — talks to customers + status page
   - **Scribe** — writes the timeline as it unfolds

### 3. Contain & remediate

Standard playbooks:

**Auth bypass / leaked JWT signing key**
1. Rotate `JWT_SECRET`: `flyctl secrets set -a nirva-backend JWT_SECRET=$(openssl rand -hex 48)`
2. Invalidate all sessions: `UPDATE users SET token_version = token_version + 1`
   (forces every refresh-token to fail next use)
3. Force password reset for affected users via the magic-link flow
4. Audit `audit_log` for any actions taken with the leaked token

**Database confused-deputy / RLS bypass**
1. Add a `WHERE org_id = ...` guard to the suspect query
2. Run `EXPLAIN` to verify the planner uses the RLS predicate
3. Add a regression test that proves cross-tenant access fails
4. Deploy

**LINE channel secret leaked**
1. Rotate `LINE_CHANNEL_SECRET` from the LINE Developer Console
2. `flyctl secrets set -a nirva-backend LINE_CHANNEL_SECRET=<new>`
3. Replay missed webhooks from the LINE-side delivery log

**Webhook signing key leaked**
1. Rotate per webhook: `webhooks.create` returns a new secret; force customers
   to re-pull
2. The old key is hashed in DB — old payloads were signed by it but the key
   itself never leaves our DB plaintext

**Suspected data exfiltration**
1. `pg_dump` everything for forensics. NEVER delete logs during an incident.
2. Diff the current `audit_log` against the prior snapshot — what was read?
3. Notify the DPO immediately. PDPA §39 clock starts at this moment.

### 4. Communicate

- **Internal:** real-time updates in `#incident-...` channel, summary post
  every 30 min during SEV-1/2
- **Customers:** status page update within 15 min for any user-visible
  impact. Honest, factual, no speculation. Template:
  > "At 09:42 SGT we detected [symptom]. Impact: [scope]. Cause: [if known
  > else 'investigating']. Workaround: [if any]. We will update at 10:15 SGT."
- **PDPA §39 — 72-hour notification:** if confirmed breach of personal data,
  the DPO drafts notification to PDPC + affected data subjects. Template
  lives at `docs/templates/breach-notification.md` (TODO).
- **CEO:** notified within 30 min for SEV-1, within 24 hours for SEV-2

### 5. Recover & learn

After the fix lands:
1. Verify with the smoke test: `./scripts/smoke.sh`
2. Watch metrics for 1 hour — make sure the patch didn't introduce a regression
3. Close the incident channel
4. Schedule a blameless post-mortem within 5 business days

## Post-mortem template

```markdown
# Post-mortem — [Incident name] — YYYY-MM-DD

## Summary
[2-3 sentences. What broke, who was affected, how long]

## Timeline (Asia/Bangkok)
- HH:MM — first signal
- HH:MM — incident opened, SEV-X
- HH:MM — root cause identified
- HH:MM — mitigation deployed
- HH:MM — fully recovered

## Impact
[Tenants, users, requests affected. Data exposure if any.]

## Root cause
[Five-whys analysis. Not a person; a process or system gap.]

## What went well
[The detection, the response, the comms — call it out]

## What went poorly
[Honestly]

## Action items
| # | Item | Owner | Due |
| 1 | ... | ... | ... |
```

Action items go into the team's tracker with explicit dates. Re-review at
the next quarterly security review.

## Quarterly drills

Run a tabletop simulation every quarter. Last drill date logged in
`STATUS.md`. Topics rotate through:
- Q1: Auth bypass / leaked secret
- Q2: Database / RLS bypass
- Q3: Confirmed data breach + PDPA §39 notification flow
- Q4: Full DR — restore from S3 to a fresh Fly.io app

Each drill must produce: timeline, what we discovered, action items.

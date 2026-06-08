# Business Continuity & Disaster Recovery Plan

**Owner:** CTO · **Last tested:** TBD — first DR drill within 30 days of pilot live
**Standards:** ISO 22301 / ISO 27001 A.5.29–A.5.30, A.8.13–A.8.14

## RTO / RPO targets

| Tier | Service | RTO | RPO |
|---|---|---|---|
| **0** | Auth + read-only PR list (degraded mode) | 1 hour | 0 (cached read replicas) |
| **1** | Full read/write — submit, approve, comment | 4 hours | 1 hour |
| **2** | Async — LINE pushes, webhooks, AI calls, PDF export | 24 hours | 1 hour |
| **3** | Reporting — analytics, audit log search | 48 hours | 24 hours |

RTO = max acceptable time from outage to service restored.
RPO = max acceptable data loss (so for Tier 1 we accept losing ≤1 hour
of writes during a major DR event).

## Threat scenarios + responses

### Scenario A — Single Fly.io machine fails
**Impact:** brief 502s during machine restart.
**Detection:** Fly.io health check, Sentry spike.
**Response:** Fly.io auto-restarts on a new host within ~30 seconds.
No human action needed unless the auto-restart loops (then SEV-2,
follow IR runbook).

### Scenario B — Fly.io Singapore region degraded
**Impact:** all traffic affected.
**Detection:** Fly.io status page, customer reports.
**Response:**
1. CTO declares SEV-1.
2. Wait — DON'T failover unless Fly.io declares the region down hard.
   Most "degraded" events resolve in <30 min and switching back is more
   risky than waiting.
3. If hard down, follow Scenario C.

### Scenario C — Need to rebuild in a fresh region
**Impact:** SEV-1, full outage.
**Detection:** Fly.io region post-mortem, internal call.
**Response:** the full DR procedure below.

### Scenario D — Database corruption / accidental data loss
**Impact:** depends — could be a single tenant or system-wide.
**Detection:** customer report, audit_log anomaly, failed cron.
**Response:** restore from point-in-time backup (Scenario E).

### Scenario E — Need to restore from backup
**Procedure** (target: within RTO of 4 hours):

```bash
# 1. Spin up a fresh Postgres in a new app to avoid clobbering production
flyctl postgres create --name nirva-pg-restore --region sin

# 2. Pull the latest backup from S3
./scripts/restore.sh nirva-backups s3://nirva-backups/2026/05/22/nirva-2026-05-22-0300.sql.gz

# 3. Run the post-restore counts script — sanity-check row counts vs.
#    the last good snapshot
./scripts/restore.sh --post-check

# 4. Point the backend at the restored DB
flyctl secrets set -a nirva-backend DATABASE_URL=$(flyctl ssh -a nirva-pg-restore ...)

# 5. Smoke test
./scripts/smoke.sh https://api.nirvaprocure.com/v1
```

### Scenario F — S3 backup bucket corrupted / inaccessible
**Detection:** `restore.sh` errors, `aws s3 ls` shows missing objects.
**Response:**
1. We keep 30 days of nightly backups in S3 + 7 days of WAL archives in
   Postgres itself. So a single bad backup file doesn't mean data loss.
2. Falling all the way back: the Fly.io Postgres has automated daily snapshots
   that are independent of our S3 backups. Restore from those via
   `flyctl postgres restore`.

### Scenario G — Both prod region AND backup region lost
**Impact:** worst-case. Recovery from cold S3 archive.
**RTO target:** 24 hours (Tier 2 services).
**Response:**
1. Provision new infrastructure from scratch (DEPLOY.md walkthrough)
2. Restore from S3 cold archive (encrypted, region replicated)
3. Re-run all migrations: `./scripts/migrate.sh`
4. Update DNS to new edge

## Backups

| What | Tool | Frequency | Retention | Location |
|---|---|---|---|---|
| Postgres logical dump | `scripts/backup.sh` (cron nightly 03:00 SGT) | daily | 30 days | S3 ap-southeast-1 |
| Postgres WAL | Fly.io managed | continuous | 7 days | Fly.io managed |
| Postgres physical snapshot | Fly.io managed | daily | 14 days | Fly.io |
| Audit log archive | `compliance.service` cron | daily | 7 years | S3 ap-southeast-1 (object-locked) |
| App container images | GitHub Container Registry | per build | 90 days | GHCR |

S3 bucket has versioning + lifecycle rules + object lock for the audit
archive (required for PDPA + ISO 27001 A.5.33 "protection of records").

## Backup integrity testing

Monthly:
1. Random backup from the last 30 days
2. Restore to a throw-away Fly.io app
3. Run `./scripts/smoke.sh` against it
4. Compare row counts with `audit_log` checksum
5. Tear down the throw-away app
6. Log the result in `STATUS.md` under "Last backup integrity check"

If a restore fails, fix BEFORE the next nightly backup. Don't keep stacking
broken backups.

## Communication plan

During a SEV-1 + DR event:
- Status page updated within 15 min of declaring the incident
- Top-3 customers contacted directly by the CEO
- Hourly progress updates until restored
- Post-incident report within 5 business days

## What's NOT covered

- Customer-side LINE bot config — if their Channel Access Token is lost,
  they need to re-issue from LINE Developer Console; we can't recover it
  for them.
- Customer-side webhook keys — we only store hashes; lost keys force a
  webhook re-create.

## DR drill schedule

Quarterly. Each drill produces a timeline + action items.

| Quarter | Scenario tested | Last run | Outcome |
|---|---|---|---|
| Q1 | Scenario E (restore from S3 backup) | TBD | TBD |
| Q2 | Scenario C (region failover) | TBD | TBD |
| Q3 | Scenario D (point-in-time DB restore) | TBD | TBD |
| Q4 | Scenario G (full cold restore) | TBD | TBD |

After each drill, update this doc with the actual measured RTO and any
adjustments to the procedure.

# NIRVAPROCURE — Architecture

> For a new engineer joining the team. Skim it once, then keep open during your
> first week. Cross-references everything I'd otherwise tell you in standup.

## Mission

AI-augmented procurement OS for Thailand + ASEAN. Three layers in one
product: marketplace integration (Shopee/Lazada/Makro), ERP workflow
(approvals/budget/audit), and AI assist (price compare, OCR, TOR draft).

## Surface

| Channel | Tech | Responsibility |
|---|---|---|
| **Web** | Next.js 14 App Router, Tailwind, Noto Sans Thai | Buyer + approver + admin UI |
| **Mobile** | Flutter 3.22 + dio + go_router + secure storage | Approve from anywhere |
| **LINE chat** | LINE Messaging API + Flex Messages | Approve/reject from chat. HMAC-verified inbound postbacks |
| **Supplier portal** | Next.js (token-auth route) | Vendor sees + acknowledges POs |
| **Webhooks** | HMAC-SHA256 signed JSON POSTs | Customer ERPs subscribe to events |
| **CLI / API** | OpenAPI 3.1 spec; `lib/api.ts` typed client | Power users + integrations |

All channels share one backend, one auth model, one design system.

## Module map

```
backend/src/
├── common/
│   ├── auth/       JWT + refresh + cookie + bcrypt + 2FA TOTP + Google OAuth
│   ├── db/         pg pool + withOrg(orgId, fn) helper that enables RLS
│   └── logging/    pino (JSON in prod, pretty in dev) + request-id middleware
└── modules/
    ├── pr/         NirvaBuy — purchase requests, marketplace import, PDF export, receive flow, comments
    ├── approvals/  NirvaFlow — runtime decisions + workflows CRUD + SSE stream
    ├── marketplace/ Shopee + Lazada + Makro + Alibaba parsers
    ├── stock/      NirvaStock — warehouses, items, movements ledger, reorder cron
    ├── people/     NirvaPeople — users + departments + roles CRUD
    ├── gov/        NirvaGov — TOR templates + AI draft (Thai government format)
    ├── ai/         NirvaAI — OpenAI/Claude wrapper with stub mode
    ├── finance/    NirvaFinance — invoice OCR via vision LLM
    ├── notifications/ LINE push + LINE webhook (verifies HMAC)
    ├── email/      SMTP wrapper, optional
    ├── budget/     Department budgets + spent_minor trigger
    ├── analytics/  MTD rollups + savings leaderboard
    ├── anomaly/    Price spike + new supplier + CoI detection
    ├── compliance/ PDPA Section 30/33 + S3 audit archive
    ├── portal/     Token-auth supplier endpoints + admin token CRUD
    ├── audit/      Read-only audit log viewer
    ├── webhooks/   Outbound event subscribers + delivery log
    ├── import/     CSV bulk upsert
    ├── suppliers/, users/, health/
```

Every domain module owns one bounded context. PR depends on Marketplace +
Stock + Budget + Anomaly + Webhooks + LINE; nothing else cross-references
PR. NotificationsModule and BudgetModule are `@Global()` so any module can
inject them without explicit `imports:`.

## Request lifecycle

Every authenticated request flows through:

```
1. Next.js page → fetch() with credentials: 'include'
2. → CORS preflight (origin allowlist via WEB_ORIGIN env)
3. → helmet sets HSTS/X-Frame-Options/etc.
4. → cookie-parser populates req.cookies
5. → AuthMiddleware reads `nirva.access` cookie OR `Authorization: Bearer`
        - verifies JWT signature
        - rejects with 401 if missing/expired
        - on 401, frontend api.ts auto-retries once with /auth/refresh
        - attaches req.user = { userId, orgId, email }
6. → @CurrentUser() decorator unpacks req.user for the handler
7. → Handler usually calls withOrg(pool, user.orgId, async (client) => …)
        - opens a tx
        - SET LOCAL app.current_org = <orgId>
        - RLS policies on every multi-tenant table enforce isolation
8. → Response. Pino logs the request line with id + status.
```

## Approval workflow data flow

```
[ Buyer ]
   ├─ creates PR (draft)
   ├─ submits PR
   │     ├─ PrService.submit()
   │     │     ├─ picks workflow by amount tier
   │     │     ├─ refuses if no non-requester approver in chain
   │     │     ├─ checks budget → AnomalyService.record if over
   │     │     ├─ checks CoI    → AnomalyService.record('coi_match')
   │     │     ├─ INSERT approval_instance(current_step=1)
   │     │     ├─ UPDATE pr.status = 'in_approval'
   │     │     ├─ LineNotifier.send('pr_submitted', step-1 approvers)
   │     │     ├─ WebhooksService.emit('pr.submitted', subscribers)
   │     │     └─ audit_log INSERT
   │     ↓
[ Approver ]
   ├─ receives LINE Flex Message OR opens web/mobile inbox
   ├─ taps approve / reject
   │     ├─ ApprovalsService.decide()
   │     │     ├─ refuses if user === requester     (self-approve guard)
   │     │     ├─ refuses if user not in current step approver_ref
   │     │     ├─ INSERT approval_decision
   │     │     ├─ advances current_step OR marks terminal
   │     │     ├─ on terminal: UPDATE pr.status = 'approved'/'rejected'
   │     │     ├─ LineNotifier.send('pr_decided', requester)
   │     │     └─ audit_log INSERT
   │     ↓
[ System ]
   ├─ SSE stream pushes new inbox count to all open browsers
   ├─ Hourly cron: SavingsService recomputes user_savings_log
   ├─ Daily 8 AM Bangkok: ReorderScanJob → LINE digest to admin
   └─ Daily 9 AM Bangkok: AnomalyScanJob → price_spike + new_supplier flags
```

## Data model — multi-tenancy via RLS

Every business table carries `org_id UUID NOT NULL` and an enabled RLS policy:

```sql
CREATE POLICY tablename_org_isolation ON tablename
  USING (org_id = current_setting('app.current_org')::uuid);
```

The single rule the app must follow: **every request handler routes through
`withOrg(pool, user.orgId, fn)`** which opens a tx and sets the GUC. Direct
pool queries (e.g. background cron) explicitly bypass and cross orgs.

## Schemas applied in order

| File | Purpose |
|---|---|
| `phase1_schema.sql` | Org, users, departments, suppliers, PRs, items, approvals, audit |
| `phase2_stock_schema.sql` | Warehouses, items, stock movements, reorder rules |
| `phase2_gov_schema.sql` | TOR templates + drafts |
| `phase4_portal_schema.sql` | Supplier portal opaque tokens |
| `phase4_2fa_schema.sql` | TOTP secret + recovery codes |
| `phase5_incentives_schema.sql` | Savings log + badges |
| `phase5_anomaly_schema.sql` | Anomaly alerts + CoI disclosures |
| `phase5_budget_schema.sql` | Department budgets + spent trigger |
| `phase5_comments_schema.sql` | PR comments thread |
| `phase5_webhooks_schema.sql` | Outbound webhooks + delivery log |
| `seed.sql` | Demo org for local dev |

Run all with `./scripts/migrate.sh` (idempotent, tracked in `schema_migrations`).

## Auth flow

```
   /auth/login (email + password)
   ├─ bcrypt.compare (or dev: prefix for seed accounts)
   ├─ if user.totp_enabled_at set → require 2FA in a follow-up call
   ├─ issue access token (JWT 15m) + refresh token (JWT 14d)
   ├─ set both as httpOnly + sameSite=lax + secure-in-prod cookies
   └─ return body { token, refresh_token, user } (compat with mobile/curl)

Subsequent requests: AuthMiddleware reads access cookie OR Bearer header.
On 401, frontend's api.ts:
   ├─ in-flight refresh promise dedups concurrent retries
   ├─ POST /auth/refresh (uses refresh cookie OR refresh body)
   ├─ writes fresh access + refresh cookies
   └─ replays the original request once
```

Alternative auth surfaces:
- **Google OAuth** — `POST /auth/oauth/google { id_token }`. Verifies ID
  token against Google certs, matches user by email (no auto-provision),
  reuses the same JWT issuance path.
- **2FA TOTP** — opt-in per user. Required for admin/CFO by policy.
- **LINE webhook** — HMAC-signed, no JWT.
- **Supplier portal token** — URL-embedded random 32B, hashed at rest,
  scoped to one supplier.

## Real-time

- **SSE** for inbox counts. `GET /approvals/stream` polls + diffs on the
  server, emits only on change. Frontend opens once per tab, with a 30s
  polling fallback if the connection fails.
- **LINE push** for cross-channel notification. Inbound LINE webhooks
  let an approver decide from inside the LINE app via a postback button.

## Background jobs

All via `@nestjs/schedule` with `Asia/Bangkok` TZ pin:
- **Hourly** — SavingsService.recomputeAllOrgs
- **8 AM daily** — ReorderScanJob (stock below reorder_point → LINE digest)
- **9 AM daily** — AnomalyScanJob (price spike + new supplier → admin)

Webhook delivery is in-process today (parallel fetch with 5s timeout).
Phase 6 will graduate this to BullMQ + Redis with retry/backoff.

## Security model

- Cookies: httpOnly, sameSite=lax, secure in prod.
- CSP: tight allowlist for marketplace image hosts only.
- Helmet headers, HSTS 2y, X-Frame DENY.
- bcrypt for passwords (10 rounds), `dev:` prefix only honored when
  `NODE_ENV !== 'production'`.
- Throttler: 5 logins / 15 min per IP, 30 refresh / 15 min, 120 r/min default.
- Pino redacts `authorization`, `cookie`, `password`, `password_hash`,
  `refresh_token`, `token` at log-time.
- Webhook secrets stored as SHA-256 hash; raw shown once.
- Portal tokens: 32B URL-safe random; stored as SHA-256 hash; expirable + revocable.

See [docs/POLICY.md](docs/POLICY.md) for the procurement-side policy that
maps to these controls.

## Deployment topology

Single region (Singapore on Fly.io) for the MVP:

```
    DNS
     │
     ├─ nirvaprocure.com           → Fly app `nirva-web`        (Next.js)
     ├─ api.nirvaprocure.com       → Fly app `nirva-backend`    (NestJS)
     └─ portal.nirvaprocure.com    → same `nirva-web` (different route group)

    nirva-backend ──► nirva-pg (Fly managed Postgres, single instance)
                  ──► OpenAI/Anthropic (outbound HTTPS)
                  ──► LINE API
                  ──► SMTP relay (SendGrid/Resend)
                  ──► S3 (audit archive + db backups)
```

Multi-region read replicas are the obvious next graduation. Schemas are
RLS-ready; we'd just add `pg_partman` for `audit_log` partitioning once it
gets fat.

## Observability

- **Logs** — pino JSON in prod, ship to Datadog/Loki. Each request carries
  a stable `x-request-id`; honored when inbound, generated otherwise.
- **Errors** — Sentry opt-in via `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN`.
  `app/global-error.tsx` captures the layout-level catastrophes.
- **Metrics** — not wired yet. Phase 6 adds Prometheus exporters
  (request counters per endpoint, AI call latency histograms,
  webhook delivery success rate, SSE connection count).
- **Audit** — `/audit/log` page lets admins browse the immutable log
  with cursor pagination. Retention 90 days in DB, then archived to S3.

## Tests

- **Backend** — Jest + Nest TestingModule, mocked pg pool. See
  `pr.service.spec.ts` for the integration-style pattern.
- **Frontend** — Vitest + RTL for components, Playwright for E2E flows
  (login, create PR, approve from inbox).
- **End-to-end stack** — `./scripts/smoke.sh` runs a curl-based smoke
  test against `docker compose up`. Optional `SMOKE_BRINGUP=1` brings it up
  itself.

## Where to put new code

| If you're adding... | Put it here |
|---|---|
| A new endpoint | `backend/src/modules/<domain>/<domain>.controller.ts` |
| Business logic | `backend/src/modules/<domain>/<domain>.service.ts` |
| A new table | new SQL file in `database/phase{N}_<name>_schema.sql` + append to `scripts/migrate.sh` MIGRATIONS |
| A reusable React component | `frontend/components/<Name>.tsx` + a Storybook story in `components/stories/` |
| A new web page | `frontend/app/<route>/page.tsx` |
| A new mobile screen | `mobile/lib/pages/<name>_page.dart` + route in `main.dart` |
| Cross-cutting middleware | `backend/src/common/` |
| A scheduled job | `<module>/<name>.job.ts` with `@Cron(CronExpression.*, { timeZone: 'Asia/Bangkok' })` |
| A new outbound integration | `<module>/<provider>.parser.ts` (or `.notifier.ts`) following the Shopee/LINE patterns |

## What we deliberately don't have (yet)

- **BullMQ / Redis** — webhook + LINE delivery is in-process. Fine for
  hundreds of orgs; needs the queue once a single org hits ~5k events/day.
- **Multi-region replicas** — single Singapore region today.
- **Real-time presence on PR detail** — "Sarah is viewing this PR" is on
  the wishlist but not started.
- **Mobile push** — LINE is the cross-platform substitute. FCM/APNs would
  be a Phase 6 addition.
- **GraphQL** — REST + OpenAPI codegen covers all current consumers.
- **Multi-currency** — everything is THB satang. The codebase is satang-aware
  end-to-end but no FX conversion yet.

---

If you're reading this and something is wrong or missing, fix it in place.
This doc lives in the repo, not a wiki, on purpose.

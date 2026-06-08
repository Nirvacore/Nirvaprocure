# NIRVAPROCURE — Project Status & Handoff

Last updated by Claude during the 92-task autonomous build session.

## TL;DR

Production-shape codebase for an AI-augmented procurement OS targeting
Thailand + ASEAN SMEs. **~230 files, 90+ tasks shipped end-to-end, typecheck
clean.** Ready for a first pilot customer + a real Fly.io deploy.

| Surface | Status |
|---|---|
| Web (Next.js 14 + Tailwind + dark mode + 8-locale i18n) | ✅ Feature-complete for Phase 1–5 |
| Mobile (Flutter — 26 screens, ShellRoute bottom nav + dark mode) | ✅ Shell (4-tab nav + FAB + notification badge), home dashboard (+ PO quick action), PR list (filter chips), PR detail (+ attachments + create PO + linked PO card), approvals, PR create, analytics, stock, settings, suppliers, supplier detail, notifications, budget, audit, more grid (14 tiles), profile, global search, goods received, onboarding walkthrough, PO list (filter chips + tap→detail), PO detail (header + line items + status actions), charts (donut + bar + dept bars), scanner (barcode + photo), biometric login |
| LINE (Flex Messages + HMAC webhook) | ✅ Approve from chat works |
| Supplier portal (token URL) | ✅ Read + ack |
| Backend (NestJS — 35 modules) | ✅ All domain logic + scheduled jobs + PO + attachments + FCM |
| Database (14 schemas + migrate.sh) | ✅ Phase 1–7 applied via runner |
| Deployment (Docker + Fly.io configs) | ✅ One-command via `docker compose up` or `flyctl deploy` |
| Observability (pino + Sentry-ready) | ✅ Logs redacted; DSN opt-in |
| CI (GitHub Actions) | ✅ Lint + typecheck + e2e + image build |
| Compliance (PDPA Section 30/33 + audit + S3) | ✅ Documented in COMPLIANCE.md |
| ISO 27001 / 27017 / 27018 / 27701 / PDPA / 22301 readiness matrix | ◑ ~55–65 % toward ISO 27001 audit — see `docs/STANDARDS.md` |
| ISP, IR runbook, BCP/DR, Risk Register (the paper layer) | ✅ Drafted — `docs/INFORMATION_SECURITY_POLICY.md`, `INCIDENT_RESPONSE.md`, `BCP.md`, `RISK_REGISTER.md` |
| PDPA §22 privacy notice + cookie consent UI | ✅ `/privacy` page + `<CookieConsent />` banner in 8 locales; `POST /people/me/consent` persists decision |
| Dependabot (A.8.8) | ✅ `.github/dependabot.yml` — weekly npm + GH Actions + Docker |

## Languages supported (procurement-grade)

8 locales, every key parity-checked at compile time:

```
ไทย · English · 中文 · 日本語 · Tiếng Việt · Bahasa Indonesia · မြန်မာ · ភាសាខ្មែរ
```

Font per script auto-loaded by Next.js; the body font-stack swaps based on
`html.lang`. Switching language is a single click in the header dropdown.

## Module inventory

### Backend (`backend/src/modules/`)

| Module | Owns | Key endpoints |
|---|---|---|
| `pr/`           | NirvaBuy — PRs, items, marketplace import, PDF, receive, comments | `POST /pr`, `POST /pr/:id/submit`, `GET/POST /pr/:id/comments` |
| `approvals/`    | NirvaFlow — decisions + workflows CRUD + SSE inbox stream | `POST /approvals/:id/decision`, `GET /approvals/stream`, `GET/POST/PATCH/DELETE /workflows` |
| `marketplace/`  | Shopee + Lazada + Makro + Alibaba URL parsers | (internal — called by /pr/import-link) |
| `stock/`        | Warehouses, items, movements ledger, reorder cron | `GET /stock/on-hand`, `POST /stock/movements` |
| `people/`       | Users + departments + roles CRUD | `GET/POST /people/users`, `/people/departments` |
| `gov/`          | TOR templates + AI draft (Thai gov format) | `POST /gov/tor/drafts` |
| `ai/`           | NirvaAI price-compare (OpenAI/Claude wrapper) | `POST /ai/price-compare` |
| `finance/`      | NirvaFinance — invoice OCR via vision LLM | `POST /finance/invoice/ocr` |
| `notifications/`| LINE push + webhook receive (HMAC) + FCM push | `POST /notifications/line/webhook`, `POST /notifications/fcm/token` |
| `attachments/`  | PR file attachment metadata | `GET/POST/DELETE /pr/:id/attachments` |
| `po/`           | Purchase Orders (PO from approved PR) | `GET/POST /po`, `PATCH /po/:id/status` |
| `email/`        | SMTP wrapper, optional | (internal) |
| `budget/`       | Department budgets + spent_minor trigger | `GET/POST /budgets` |
| `analytics/`    | MTD rollups + savings leaderboard | `GET /analytics/summary`, `/savings/leaderboard`, `/savings/me` |
| `anomaly/`      | Price spike + new supplier + CoI detection | `GET /anomaly/alerts`, `POST /anomaly/disclosures` |
| `compliance/`   | PDPA Section 30/33 + audit S3 archive | `GET /compliance/export/me`, `POST /redact/:id` |
| `portal/`       | Token-auth supplier endpoints + admin token CRUD | `GET /portal/:token`, `POST /pr/:pr_id/ack` |
| `audit/`        | Read-only audit log viewer (cursor pagination) | `GET /audit/log` |
| `webhooks/`     | Outbound event subscribers + delivery log | `GET/POST/DELETE /webhooks` |
| `import/`       | CSV bulk upsert (items/suppliers/departments) | `POST /import/csv` |
| `suppliers/`    | Supplier catalog CRUD + risk tier | `GET /suppliers`, `GET /suppliers/:id`, `POST /suppliers`, `PATCH /suppliers/:id`, `DELETE /suppliers/:id` |
| `users/`        | Legacy users module (CRUD lives in `people/`) | (internal) |
| `health/`       | Liveness + DB probe | `GET /health` |

Plus `common/auth/` (JWT + refresh + cookie + bcrypt + 2FA TOTP + Google OAuth),
`common/db/` (pg pool + RLS helper), `common/logging/` (pino).

### Frontend (`frontend/`)

```
app/
├── (root)                  Home — 4 action cards + this-month summary
├── login                   Email/password + Google OAuth (UI)
├── onboarding              Multi-step wizard for new orgs
├── pr/
│   ├── (list)              Cursor-paginated + filter chips
│   ├── new                 Shopee paste → AI parse → submit
│   └── [id]                Detail + items + AI suggestions + comments + trail
├── approvals               Inbox + optimistic undo + urgent badges
├── settings                4 tabs: workflows / users / departments / webhooks
├── stock                   Warehouse on-hand + reorder + movement modal
├── gov/tor/new             TOR brief → AI draft + compliance checklist
├── analytics               Stat cards + dept bar chart + top suppliers + SLA
├── audit                   Cursor-paginated audit log + diff expand
├── line                    LINE notification preview + test send
└── portal/[token]          Supplier-facing read + ack (no app shell)
```

components/ has 18 reusable bits (Header, Toast, StatusPill, AiSuggestionCard,
PrComments, MovementModal, WorkflowEditor, WebhooksPanel, etc).

### Mobile (`mobile/lib/pages/`)

`shell_page` (persistent bottom nav + FAB + pending-approval badge) · `home_page` (live dashboard: stat chips, quick actions incl. PO, pending approvals card, recent PRs; all drill-in uses `context.push`) · `pr_list_page` (Shopee-style filter chips + debounced 300ms inline search + result count + clear button + sort toggle: newest/oldest/by-amount) · `pr_detail_page` (+ comments + attachments section + linked PO card + create PO button; `push` nav after PO creation) · `approvals_page` (swipe-to-decide + reject confirmation dialog) · `pr_create_page` · `analytics_page` · `stock_page` (debounced 250ms search by name/SKU + result count + clear button; adjustment bottom sheet: +/- qty, direction toggle, note, API call) · `settings_page` · `suppliers_page` (debounced 250ms search + result count + clear button + LangButton) · `supplier_detail_page` (avatar, risk badge, stats row, contact card; Tokens design system) · `notifications_page` (LangButton + unread-only filter chip + tap-to-navigate + mark read + mark all read) · `budget_page` (LangButton + empty-state icon + scrollable error state) · `audit_page` (LangButton + action filter chips: All/PR/PO/Stock/Auth + expandable detail) · `more_page` (14-tile grid + live badges + logout confirmation) · `profile_page` (LINE-style: avatar, live supplier count, settings, dark mode toggle, logout confirmation dialog) · `search_page` (Grab spotlight: debounced search across PRs & suppliers; tappable supplier tiles → detail) · `receive_page` (goods received: expand approved PR, confirm receipt, updates stock; LangButton) · `onboarding_page` (3-step Grab-style walkthrough: create PR → submit → track; LangButton + Skip in top bar) · `po_list_page` (debounced 300ms search + color-coded filter chips + Tokens styling + LangButton) · `po_detail_page` (RefreshIndicator + extracted `_ActionButton` + status switch expressions + Tokens) · `charts_page` (donut pie + monthly bar + dept bars; LangButton + elevation:0 cards) · `scanner_page` (barcode/QR tab + photo capture tab; LangButton) · `biometric_page` (fingerprint/face ID + PIN fallback)

Architecture: `ShellRoute` wraps 4 bottom-nav tabs (Home, Approvals, PRs, More) with `BottomAppBar` + centered FAB (create PR). Sub-pages live outside the shell so bottom nav hides when drilling in — same pattern as LINE/Grab.

All 26 screens support 8-locale i18n via `L10nScope` / `LangButton` (319 keys × 8 locales at parity). Full dark mode support via toggle in Profile page — all tile containers use `colorScheme.surface` (no hardcoded `Colors.white` in card backgrounds). Zero deprecated `withOpacity` calls — all migrated to `withAlpha(int)`. Zero `Colors.grey.shade*` or bare `Colors.grey` — fully migrated to `Tokens.gray100/200/500/700` + `const Color(0xFFD1D5DB/F9FAFB)`. Navigation audit complete: `context.go()` for tab switches only, `context.push()` for all drill-in pages. Login page: centered logo + password show/hide toggle. All `CircularProgressIndicator` use `strokeWidth: 2`. Home page: time-of-day greeting (morning/afternoon/evening) via `DateTime.now().hour`. Added `import '../theme/tokens.dart'` to suppliers_page, audit_page, biometric_page, notifications_page (compile fix).
Shares brand tokens and 56px tap-target rule with web. Uses dio interceptor
for automatic JWT refresh; flutter_secure_storage for tokens.

## Database schemas (apply order — `./scripts/migrate.sh`)

1. `phase1_schema.sql` — orgs, users, departments, suppliers, PRs, items, approvals, audit
2. `phase2_stock_schema.sql` — warehouses, items, movements ledger
3. `phase2_gov_schema.sql` — TOR templates + drafts
4. `phase4_portal_schema.sql` — supplier portal tokens
5. `phase4_2fa_schema.sql` — TOTP + recovery codes
6. `phase5_incentives_schema.sql` — savings log + badges
7. `phase5_anomaly_schema.sql` — anomaly alerts + CoI disclosures
8. `phase5_budget_schema.sql` — dept budgets + spent trigger
9. `phase5_comments_schema.sql` — PR comments thread
10. `phase5_webhooks_schema.sql` — outbound webhooks + delivery log
11. `phase6_locale_schema.sql` — per-user `preferred_locale` for server-side i18n
12. `phase6_pdpa_consent_schema.sql` — `pdpa_consent_at` + `cookie_consent` JSONB
13. `phase7_attachments_schema.sql` — PR file attachments + RLS
14. `phase7_po_schema.sql` — Purchase Orders + PO items + RLS
15. `phase7_fcm_schema.sql` — FCM device token registry
16. `seed.sql` — demo org for dev

`schema_migrations` table tracks applied + sha256 of each file.

## Scripts

| `scripts/` | Purpose |
|---|---|
| `migrate.sh`        | Apply pending schemas (idempotent, hash-tracked) |
| `smoke.sh`          | curl-based e2e against running stack |
| `backup.sh`         | pg_dump → gzip → S3 |
| `restore.sh`        | S3 download → gzip → psql + post-restore counts |
| `loadtest/*.js`     | k6 scenarios: login-burst, pr-list-soak, approval-spike |

## Day 0 → Day 30 pilot playbook

### Day 0 — Provisioning (4 hours)

```bash
# 1. Stand up infra
flyctl postgres create --name nirva-pg --region sin
cd backend && flyctl launch --no-deploy --copy-config && flyctl postgres attach nirva-pg
cd ../frontend && flyctl launch --no-deploy --copy-config

# 2. Secrets
flyctl secrets set -a nirva-backend \
  JWT_SECRET=$(openssl rand -hex 48) \
  WEB_ORIGIN=https://nirvaprocure.com \
  OPENAI_API_KEY=sk-... \
  LINE_CHANNEL_ACCESS_TOKEN=... \
  LINE_CHANNEL_SECRET=...

# 3. Deploy
cd ../backend  && flyctl deploy
cd ../frontend && flyctl deploy

# 4. Schema + seed
flyctl proxy 5432 -a nirva-pg &
DATABASE_URL=postgres://postgres:$(flyctl secrets list -a nirva-pg | …)@localhost:5432/postgres \
  ./scripts/migrate.sh

# 5. Custom domain + LINE bot URL
flyctl certs add nirvaprocure.com -a nirva-web
# Configure LINE Messaging API webhook URL = https://api.nirvaprocure.com/v1/notifications/line/webhook
```

### Day 1–7 — Pilot customer onboarding (1 SME)

1. Admin signs in (Google OAuth or password).
2. Run through `/onboarding` wizard:
   - Create first department
   - Pick approver (or designate self for solo founder)
   - CSV import items + suppliers (optional)
3. Issue LINE channel link to every approver — they bind their LINE account
   via the OA "add friend" flow (Phase 6: add per-user binding UI).
4. Create one workflow rule per amount tier in `/settings → กฎการอนุมัติ`.
5. Buyers paste their first Shopee URL → submit → approver gets LINE → tap.

**Success signal at Day 7:** at least 5 PRs flowed end-to-end on real money,
no production 5xx in Sentry, audit log has matching `pr.submit`/`pr.decide`
pairs for every PR.

### Day 8–14 — Behavior shaping

- Schedule the procurement-policy training session. Distribute `docs/POLICY.md`.
- Have everyone declare CoI via `/anomaly/disclosures`.
- Set department budgets in `/budgets`.
- Turn on the savings leaderboard in the home page (already on).

### Day 15–30 — Tighten + scale

- Enable 2FA TOTP for all admin/CFO accounts.
- Configure S3 audit archive bucket + AWS keys.
- Set up nightly `scripts/backup.sh` cron.
- Run k6 load tests against production at off-hours to establish baseline.
- Add 2nd + 3rd customer if pilot looks healthy.

## Known gaps (explicit)

**By design — defer until customer demand:**
- BullMQ / Redis queue for webhooks (currently in-process, fine for hundreds of orgs)
- Multi-region Postgres replicas (single Singapore region today)
- Real-time presence ("Sarah is viewing this PR")
- ✅ FCM push notifications — `fcm.service.ts` (token register/send/cleanup), `fcm_tokens` table, mobile `Api.registerFcmToken()`, dev logger until firebase-admin wired
- GraphQL (REST + OpenAPI codegen covers all consumers)
- Multi-currency (everything THB satang; codebase is unit-aware but no FX)

**Phase 6 candidates:**
- ✅ Per-user LINE OA binding UI — self-service 3-step flow in `/line` page; 6-digit code (10 min TTL) via `POST /notifications/line/bind`; webhook handles `message` events to auto-link; `GET /notifications/line/status` + `DELETE /notifications/line/bind` for status & disconnect; 14 new i18n keys in all 8 locales; bot replies in user's preferred locale
- ✅ Replay button on webhook delivery log — collapsible per-webhook delivery log (last 20, newest first); failed rows get a Replay button that re-fires the original payload and prepends the result; `GET /webhooks/:id/deliveries` + `POST /webhooks/:id/deliveries/:delivId/replay`; 7 new i18n keys × 8 locales
- ✅ Advanced supplier risk scoring — 5-factor composite score (0–100) per supplier: spend concentration 30%, price volatility 20%, rejection rate 20%, CoI flag 20%, 90-day anomaly count 10%; 4 tiers (low/medium/high/critical); SQL-only, single-query upsert into `supplier_risk_scores`; daily recompute in `AnomalyScanJob`; admin on-demand via `POST /anomaly/supplier-risks/refresh`; collapsible leaderboard on analytics page with per-factor breakdown; 15 i18n keys × 8 locales
- ✅ Mobile app: create PR — `pr_create_page.dart` with Shopee/Lazada paste + manual items
- ✅ Mobile app: PR comments — `_CommentsSection` in `pr_detail_page.dart` (optimistic, 8-locale)
- ✅ Mobile i18n: 8-locale `LangButton` in every AppBar, 73 keys at parity
- ✅ E2E LINE bot integration — binding (6-digit code), unbinding (web UI), rich menu (2×3 grid, browser Canvas → PNG → LINE API upload → set as default); `GET/POST/DELETE /notifications/line/rich-menu/*`; visual mini-preview in LINE settings page; 13 i18n keys × 8 locales
- Backend i18n: ✅ LINE Flex pushes + chat-postback decision comments + PR PDF
  (column headers, justification, approval trail, signature lines) + analytics
  "unspecified dept" label all translate via `users.preferred_locale`
  (PUT `/people/me/locale`). Email subject/body templates still default to
  whatever the caller passes — extend `backend/src/common/i18n/dictionary.ts`
  when adding new email templates and thread `locale` through their callers.

**Revenue features:**
- ✅ Affiliate links — auto-tags every Shopee/Lazada/Alibaba URL with org's affiliate ID before parsing; Shopee: `?af_id=`, Lazada: `c.lazada.co.th/t/c.`, Alibaba: `?aff_trace_key=`; click tracking in `affiliate_clicks`; admin config panel in Settings → Affiliate tab; `GET/POST/PATCH/DELETE /affiliate`, `GET /affiliate/stats`; 21 i18n keys × 8 locales; 0 TS errors

**Operational unknowns until live deploy:**
- Actual Fly.io machine sizing — start at shared-cpu-1x; bump on load test
- LINE rate limits — Messaging API caps unknown until production traffic
- ✅ OpenAI cost metering — `ai_runs` table (migration `phase6_ai_runs_schema.sql`); every `OpenAiProvider.chat()` call records model, tokens, latency, cost estimate (USD); `InvoiceOcrService` wired via `recordRun()`; `GET /ai/runs` returns usage + monthly summary; AI cost StatCard on analytics page (4 i18n keys × 8 locales); pre-existing backend TS errors (workflows DTO + pr.service rowCount) also fixed → 0 errors across entire backend

## How to keep typecheck clean while iterating

```bash
cd frontend && npx tsc --noEmit       # 0 errors required to merge
cd backend  && npx tsc --noEmit
```

Both are wired into the GitHub Actions CI workflow.

## Test surface

- **Backend** — Jest + Nest TestingModule, mocked pg pool. See `pr.service.spec.ts` for the pattern. 13 specs, 124 tests.
- **Frontend** — Vitest + RTL for components, Playwright for E2E flows.
- **Stack** — `./scripts/smoke.sh` (curl-based) + `scripts/loadtest/*.js` (k6).

## Owners — who to ping when

(Fill in after handoff.)

| Surface | Primary | Backup |
|---|---|---|
| Backend (Nest) | _____ | _____ |
| Frontend (Next.js) | _____ | _____ |
| Mobile (Flutter) | _____ | _____ |
| Database / migrations | _____ | _____ |
| LINE integration | _____ | _____ |
| AI prompts | _____ | _____ |
| DevOps / Fly.io | _____ | _____ |
| Compliance / DPO | _____ | _____ |

---

If you're picking this up and something is wrong, fix it in this file too.
Living docs > stale wiki.

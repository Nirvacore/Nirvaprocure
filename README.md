# NIRVAPROCURE

**AI-augmented procurement OS for Thailand & ASEAN SMEs.**

Marketplace integration (Shopee/Lazada/Makro/Alibaba) · LINE approval flow · Flutter mobile · 8-locale i18n · PDPA-ready

![CI](https://github.com/Nirvacore/Nirvaprocure/actions/workflows/ci.yml/badge.svg)
![Mobile CI](https://github.com/Nirvacore/Nirvaprocure/actions/workflows/mobile-ci.yml/badge.svg)

---

## Quick start (Docker)

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Web (Next.js) | http://localhost:3001 |
| API (NestJS) | http://localhost:3000/v1 |
| Health | http://localhost:3000/v1/health |
| Postgres | postgres://nirva:nirva@localhost:5432/nirvaprocure |

Dev login: any `@nirva.co.th` email — password `password123`

---

## Quick start (local, no Docker)

```bash
# 1. Postgres 14+ — apply all schemas + seed
for f in database/phase*.sql; do psql $DATABASE_URL -f $f; done
psql $DATABASE_URL -f database/seed.sql

# 2. Backend
cd backend && cp .env.example .env
# Edit .env: set DATABASE_URL, JWT_SECRET, optional LINE/OpenAI keys
npm install && npm run start:dev

# 3. Frontend (new terminal)
cd frontend && cp .env.example .env.local
npm install && npm run dev

# 4. Mobile (Flutter 3.22+)
cd mobile && flutter pub get && flutter run
```

---

## Stack

| Layer | Technology |
|---|---|
| Mobile | Flutter 3.22 · GoRouter · Dio · 26 screens · 8 locales |
| Frontend | Next.js 14 · Tailwind · TypeScript · 8 locales · dark mode |
| Backend | NestJS 10 · PostgreSQL 16 · 35 modules · JWT + 2FA |
| Infra | Docker · Fly.io · VPS (Contabo) · GitHub Actions CI |
| Integrations | LINE Messaging API · Shopee/Lazada/Makro parsers · FCM push |

---

## Repo layout

```
├── backend/      NestJS API (35 modules)
├── frontend/     Next.js web app
├── mobile/       Flutter mobile app
├── database/     19 SQL schema migrations
├── scripts/      migrate.sh · smoke.sh · backup.sh · vps-setup.sh · k6 load tests
├── docs/         ISP · IR runbook · BCP · Risk register · PDPA
├── api/          OpenAPI spec
└── .github/      CI workflows · Dependabot · PR template
```

See [STATUS.md](STATUS.md) for the full feature inventory and pilot playbook.

---

## Contributing

1. Branch from `develop`: `git checkout -b feature/your-feature develop`
2. Open a PR → `develop` (CI runs automatically)
3. Merges to `main` trigger Docker image builds + Fly.io deploy

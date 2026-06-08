# NIRVAPROCURE Backend

NestJS modular monolith. Module boundaries match the Nirva* domain modules.

## Run locally

```bash
cp .env.example .env
# point DATABASE_URL at a Postgres with phase1_schema.sql applied
npm install
npm run start:dev
```

## Layout

```
src/
├── main.ts                    # bootstrap
├── app.module.ts              # wiring
├── common/
│   ├── db/                    # pg pool + with-org helper (RLS)
│   └── auth/                  # JWT + CurrentUser decorator
└── modules/
    ├── pr/                    # NirvaBuy — purchase requests
    ├── approvals/             # NirvaFlow — approval workflow runtime
    ├── marketplace/           # Shopee/Lazada/Alibaba/Makro parsers
    ├── notifications/         # LINE / email / in-app
    ├── suppliers/             # supplier catalog (stub)
    └── users/                 # NirvaPeople (stub)
```

## Key decisions

- **Modular monolith**, not microservices — modules can be extracted later if needed.
- **Row-level security** in Postgres; every request runs inside `withOrg(pool, orgId, fn)` which sets `app.current_org`.
- **JWT auth** carrying `userId`, `orgId`, `email` — read via the `@CurrentUser()` decorator.
- **No ORM** in Phase 1 — raw SQL via `pg`. We can add one later if it pays off, but procurement queries tend to be ad-hoc enough that an ORM often gets in the way.

## What's stubbed for Phase 1

- `users/` and `suppliers/` modules are empty placeholders — flesh out as PR features need them.
- `LineNotifier` logs instead of calling the LINE API when no token is set.
- Auth middleware that populates `req.user` from the JWT is not yet wired — controllers assume it exists.

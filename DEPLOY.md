# Deployment — Fly.io

Single-region (Singapore) deploy. Two apps: `nirva-backend` and `nirva-web`,
plus a managed Postgres. ~$10–20/month for low traffic.

## First-time setup

```bash
# Install flyctl + log in
brew install flyctl
flyctl auth login

# Create org-level Postgres (single instance, dev-class for now).
flyctl postgres create \
  --name nirva-pg \
  --region sin \
  --vm-size shared-cpu-1x \
  --volume-size 10 \
  --initial-cluster-size 1
```

## Backend

```bash
cd backend
flyctl launch --no-deploy --copy-config --name nirva-backend --region sin

# Wire Postgres → injects DATABASE_URL automatically.
flyctl postgres attach nirva-pg

# Required secrets.
flyctl secrets set \
  JWT_SECRET=$(openssl rand -hex 48) \
  WEB_ORIGIN=https://nirvaprocure.com

# Optional but recommended.
flyctl secrets set \
  LINE_CHANNEL_ACCESS_TOKEN=xxx \
  LINE_CHANNEL_SECRET=xxx \
  OPENAI_API_KEY=sk-xxx \
  AUDIT_ARCHIVE_BUCKET=nirva-audit-prod \
  AWS_ACCESS_KEY_ID=xxx \
  AWS_SECRET_ACCESS_KEY=xxx

flyctl deploy
```

After first deploy, apply schemas + seed:

```bash
flyctl proxy 5432 -a nirva-pg                                   # in a separate shell
PGPASSWORD=$(flyctl secrets list -a nirva-pg | grep PG_PASS...) \
  psql -h localhost -U postgres -d nirva -f database/phase1_schema.sql
# Then phase2_stock_schema.sql, phase2_gov_schema.sql, phase4_portal_schema.sql, seed.sql
```

## Web

```bash
cd ../frontend
flyctl launch --no-deploy --copy-config --name nirva-web --region sin

flyctl secrets set \
  NEXT_PUBLIC_API_BASE_URL=https://nirva-backend.fly.dev/v1

# Optional
flyctl secrets set \
  NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/yyy

flyctl deploy
```

## Custom domain

```bash
# Web
flyctl certs add nirvaprocure.com   -a nirva-web
flyctl certs add www.nirvaprocure.com -a nirva-web

# Backend (CORS WEB_ORIGIN must match scheme + host exactly)
flyctl certs add api.nirvaprocure.com -a nirva-backend
flyctl secrets set WEB_ORIGIN=https://nirvaprocure.com -a nirva-backend
```

Point DNS:
- `nirvaprocure.com`     A     → fly v4 IPv4 (from `flyctl ips list -a nirva-web`)
- `nirvaprocure.com`     AAAA  → fly v6
- `api.nirvaprocure.com` A/AAAA → nirva-backend ips

## Day-2

| What | Command |
|---|---|
| Tail logs | `flyctl logs -a nirva-backend` |
| Shell into a machine | `flyctl ssh console -a nirva-backend` |
| Restart | `flyctl machine restart -a nirva-backend` |
| Roll back | `flyctl releases -a nirva-backend` → `flyctl deploy --image registry.fly.io/nirva-backend:vN` |
| Update a secret | `flyctl secrets set KEY=value -a nirva-backend` (triggers redeploy) |
| Run smoke test | `SMOKE_API_BASE=https://api.nirvaprocure.com/v1 ./scripts/smoke.sh` |

## What's not configured here

- Multi-region read replicas (single-region keeps things simple)
- LINE webhook URL (set after first deploy: `https://api.nirvaprocure.com/v1/notifications/line/webhook`)
- Sentry source maps upload
- Cron schedules (use Fly machines `scheduled` flag or external service)
- Backup encryption keys (Fly Postgres has automatic daily snapshots)

---

## VPS (Contabo / Ubuntu 24.04)

Single-server deploy with Docker Compose. Fits a **Cloud VPS 20** in Singapore (~$16/mo
including backup + location surcharge).

### One-command bootstrap

```bash
# SSH into the VPS as root, then:
git clone https://github.com/Nirvacore/Nirvaprocure.git /opt/nirvaprocure
cd /opt/nirvaprocure
./scripts/vps-setup.sh --ip-only
```

The script installs Docker, configures `ufw`, creates `.env` with random secrets,
starts `docker-compose.prod.yml`, runs `migrate.sh`, and prints URLs.

| Mode | Command | URLs |
|---|---|---|
| IP only (no domain) | `./scripts/vps-setup.sh --ip-only` | `http://YOUR_IP:3001` web, `:3000/v1` API |
| Domain + HTTPS | `./scripts/vps-setup.sh --ssl nirvaprocure.com you@example.com` | `https://nirvaprocure.com`, `https://api.nirvaprocure.com/v1` |

Before HTTPS mode, point DNS:

- `nirvaprocure.com` → VPS IPv4 (`A`)
- `api.nirvaprocure.com` → same IP (`A`)

### Manual bring-up

```bash
cp .env.prod.example .env          # edit POSTGRES_PASSWORD, JWT_SECRET, URLs
docker compose --env-file .env -f docker-compose.prod.yml \
  -f docker-compose.prod-ip.yml up -d --build
DATABASE_URL=postgres://nirva:$POSTGRES_PASSWORD@127.0.0.1:5432/nirvaprocure \
  ./scripts/migrate.sh
SMOKE_API_BASE=http://YOUR_IP:3000/v1 ./scripts/smoke.sh
```

### Files

| Path | Purpose |
|---|---|
| `docker-compose.prod.yml` | Postgres + backend + web (+ optional Caddy profile `ssl`) |
| `docker-compose.prod-ip.yml` | Expose :3000/:3001 for IP-only access |
| `deploy/Caddyfile` | Reverse proxy + Let's Encrypt when `--ssl` |
| `.env.prod.example` | Secret / URL template |
| `scripts/vps-setup.sh` | Full bootstrap for Ubuntu 24.04 |

### Security checklist

- Change default seed password after first login
- Keep Postgres on `127.0.0.1:5432` only (prod compose default)
- Disable public VNC; use SSH keys
- Contabo Auto Backup ($2.45/mo) covers VM snapshots — also run `scripts/backup.sh` for logical dumps

### Day-2 on VPS

| What | Command |
|---|---|
| Logs | `docker compose --env-file .env -f docker-compose.prod.yml logs -f backend` |
| Update | `git pull && docker compose --env-file .env -f docker-compose.prod.yml -f docker-compose.prod-ip.yml up -d --build` |
| Migrate | `DATABASE_URL=... ./scripts/migrate.sh` |
| Smoke | `SMOKE_API_BASE=http://YOUR_IP:3000/v1 ./scripts/smoke.sh` |

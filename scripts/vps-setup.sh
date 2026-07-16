#!/usr/bin/env bash
# Bootstrap NIRVAPROCURE on Ubuntu 24.04 VPS (Contabo, etc.).
#
# Run as root on a fresh server:
#   curl -fsSL https://raw.githubusercontent.com/Nirvacore/Nirvaprocure/main/scripts/vps-setup.sh | bash
# Or from a cloned repo:
#   sudo ./scripts/vps-setup.sh --repo-dir /opt/nirvaprocure
#
# Modes:
#   --ip-only          Expose :3001 (web) and :3000 (API) — default
#   --ssl DOMAIN EMAIL Use Caddy + Let's Encrypt on ports 80/443
#
# Env overrides:
#   VPS_REPO_URL       git clone URL (default: Nirvacore/Nirvaprocure)
#   VPS_INSTALL_DIR    install path (default: /opt/nirvaprocure)
#   VPS_SSH_PORT       ufw allow port (default: 22)

set -euo pipefail

REPO_URL="${VPS_REPO_URL:-https://github.com/Nirvacore/Nirvaprocure.git}"
INSTALL_DIR="${VPS_INSTALL_DIR:-/opt/nirvaprocure}"
SSH_PORT="${VPS_SSH_PORT:-22}"
MODE="ip"
DOMAIN=""
ACME_EMAIL=""
REPO_DIR=""

usage() {
  sed -n '2,12p' "$0"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ip-only)   MODE="ip"; shift ;;
    --ssl)       MODE="ssl"; DOMAIN="${2:?--ssl requires DOMAIN}"; ACME_EMAIL="${3:?--ssl requires EMAIL}"; shift 3 ;;
    --repo-dir)  REPO_DIR="${2:?--repo-dir requires path}"; shift 2 ;;
    -h|--help)   usage ;;
    *) echo "Unknown option: $1" >&2; usage ;;
  esac
done

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root (or via sudo)." >&2
  exit 1
fi

echo "==> Installing packages (Docker, git, ufw, postgresql-client)..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl git ufw postgresql-client

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker..."
  curl -fsSL https://get.docker.com | sh
fi

systemctl enable --now docker

echo "==> Configuring firewall (ufw)..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow "${SSH_PORT}/tcp" comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
if [[ "$MODE" == "ip" ]]; then
  ufw allow 3000/tcp comment 'NIRVA API'
  ufw allow 3001/tcp comment 'NIRVA Web'
fi
ufw --force enable

if [[ -z "$REPO_DIR" ]]; then
  REPO_DIR="$INSTALL_DIR"
fi

if [[ ! -d "$REPO_DIR/.git" ]]; then
  echo "==> Cloning $REPO_URL → $REPO_DIR"
  mkdir -p "$(dirname "$REPO_DIR")"
  git clone "$REPO_URL" "$REPO_DIR"
fi

cd "$REPO_DIR"

if [[ ! -f .env ]]; then
  echo "==> Creating .env from .env.prod.example"
  cp .env.prod.example .env
  pg_pass="$(openssl rand -hex 24)"
  jwt="$(openssl rand -hex 48)"
  sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${pg_pass}/" .env
  sed -i "s/^JWT_SECRET=.*/JWT_SECRET=${jwt}/" .env

  if [[ "$MODE" == "ip" ]]; then
  pub_ip="$(curl -fsS https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
    sed -i "s|^WEB_ORIGIN=.*|WEB_ORIGIN=http://${pub_ip}:3001|" .env
    sed -i "s|^NEXT_PUBLIC_API_BASE_URL=.*|NEXT_PUBLIC_API_BASE_URL=http://${pub_ip}:3000/v1|" .env
    echo "    Public IP detected: ${pub_ip}"
  else
    sed -i "s|^WEB_ORIGIN=.*|WEB_ORIGIN=https://${DOMAIN}|" .env
    sed -i "s|^NEXT_PUBLIC_API_BASE_URL=.*|NEXT_PUBLIC_API_BASE_URL=https://api.${DOMAIN}/v1|" .env
    sed -i "s/^DOMAIN=.*/DOMAIN=${DOMAIN}/" .env
    sed -i "s/^ACME_EMAIL=.*/ACME_EMAIL=${ACME_EMAIL}/" .env
  fi
  echo "    Secrets written to ${REPO_DIR}/.env — back this file up securely."
else
  echo "==> .env already exists — leaving unchanged"
  # shellcheck disable=SC1091
  source .env
fi

# shellcheck disable=SC1091
source .env

COMPOSE=(docker compose --env-file .env -f docker-compose.prod.yml)
if [[ "$MODE" == "ip" ]]; then
  COMPOSE+=(-f docker-compose.prod-ip.yml)
else
  COMPOSE+=(--profile ssl)
fi

echo "==> Building and starting stack..."
"${COMPOSE[@]}" up -d --build

echo "==> Waiting for Postgres..."
for i in {1..30}; do
  if pg_isready -h 127.0.0.1 -U nirva -d nirvaprocure >/dev/null 2>&1; then
    break
  fi
  sleep 2
  [[ "$i" == 30 ]] && { echo "FAIL: Postgres not ready"; exit 1; }
done

echo "==> Running migrations..."
DATABASE_URL="postgres://nirva:${POSTGRES_PASSWORD}@127.0.0.1:5432/nirvaprocure" ./scripts/migrate.sh

echo "==> Waiting for API health..."
API_LOCAL="http://127.0.0.1:3000/v1"
for i in {1..60}; do
  if curl -fsS "${API_LOCAL}/health" | grep -q '"status":"ok"'; then
    break
  fi
  sleep 2
  [[ "$i" == 60 ]] && { echo "FAIL: backend /health"; "${COMPOSE[@]}" logs --tail=40 backend; exit 1; }
done

if [[ "$MODE" == "ip" ]]; then
  pub_ip="$(grep '^WEB_ORIGIN=' .env | cut -d= -f2 | sed 's|http://||;s|:3001||')"
  echo ""
  echo "✅ NIRVAPROCURE is up (IP mode)"
  echo "   Web:  http://${pub_ip}:3001"
  echo "   API:  http://${pub_ip}:3000/v1"
  echo "   Login: suda@nirva.co.th / password123  (change after first login)"
  echo ""
  echo "Smoke test from your laptop:"
  echo "   SMOKE_API_BASE=http://${pub_ip}:3000/v1 ./scripts/smoke.sh"
else
  echo ""
  echo "✅ NIRVAPROCURE is up (HTTPS)"
  echo "   Web:  https://${DOMAIN}"
  echo "   API:  https://api.${DOMAIN}/v1"
  echo ""
  echo "Point DNS A records at this server's IP before testing HTTPS."
  echo "Smoke: SMOKE_API_BASE=https://api.${DOMAIN}/v1 ./scripts/smoke.sh"
fi

echo ""
echo "Day-2 commands (run from ${REPO_DIR}):"
echo "  ${COMPOSE[*]} logs -f backend"
echo "  ${COMPOSE[*]} pull && ${COMPOSE[*]} up -d --build"
echo "  DATABASE_URL=postgres://nirva:\$POSTGRES_PASSWORD@127.0.0.1:5432/nirvaprocure ./scripts/migrate.sh"

#!/usr/bin/env bash
# Restore a Postgres backup from S3.
#
# Usage:
#   DATABASE_URL=postgres://nirva@localhost/nirvaprocure_restore \
#   BACKUP_BUCKET=nirva-backups \
#   ./scripts/restore.sh postgres/2026-05-21T02-00-00Z.sql.gz
#
# THIS COMMAND IS DESTRUCTIVE — it pipes the dump straight into the target
# database. Use a fresh DB or one you're explicitly OK overwriting.
#
# Smoke check: after restore, verify by counting key tables.

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_BUCKET:?BACKUP_BUCKET is required}"

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <s3-key>" >&2
    echo "Example: $0 postgres/2026-05-21T02-00-00Z.sql.gz" >&2
    exit 1
fi
KEY="$1"
REGION="${BACKUP_REGION:-ap-southeast-1}"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
local_dump="$tmp/dump.sql.gz"

echo "==> Downloading s3://${BACKUP_BUCKET}/${KEY}"
aws s3 cp \
  --region "$REGION" \
  ${BACKUP_ENDPOINT:+--endpoint-url "$BACKUP_ENDPOINT"} \
  "s3://${BACKUP_BUCKET}/${KEY}" "$local_dump"

# Sanity check the file we just downloaded actually looks like a Postgres dump.
if ! gzip -dc "$local_dump" | head -n 30 | grep -q "PostgreSQL database dump"; then
    echo "FAIL: downloaded file doesn't look like a pg_dump archive" >&2
    exit 1
fi

# Confirm destructive action when stdin is a TTY (interactive run).
if [[ -t 0 ]]; then
    read -r -p "Target DB: $DATABASE_URL — this will OVERWRITE. Continue? (yes/no) " ack
    [[ "$ack" == "yes" ]] || { echo "aborted"; exit 1; }
fi

echo "==> Restoring into $DATABASE_URL"
gzip -dc "$local_dump" | psql "$DATABASE_URL"

# Smoke check — count the rows the seed file establishes, so we know the
# restore worked end-to-end.
echo "==> Post-restore counts:"
psql "$DATABASE_URL" -c "
  SELECT 'organizations' AS table, count(*) FROM organizations
  UNION ALL SELECT 'users',         count(*) FROM users
  UNION ALL SELECT 'purchase_requests', count(*) FROM purchase_requests
  UNION ALL SELECT 'audit_log',     count(*) FROM audit_log;
"
echo "✅ Restore complete"

#!/usr/bin/env bash
# Daily Postgres backup → S3-compatible storage.
#
# Usage (run from repo root):
#   DATABASE_URL=postgres://... \
#   BACKUP_BUCKET=nirva-backups \
#   ./scripts/backup.sh
#
# Run nightly via cron, e.g. on the host or as a Fly machine scheduled job:
#   0 2 * * * /opt/nirva/scripts/backup.sh >> /var/log/nirva-backup.log 2>&1
#
# Requires: pg_dump, aws CLI v2 configured (or AWS_* env vars), gzip.
# Retention is enforced at the bucket level via a lifecycle policy — we
# don't manage it from here so backup runs stay idempotent.

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_BUCKET:?BACKUP_BUCKET is required}"

REGION="${BACKUP_REGION:-ap-southeast-1}"
PREFIX="${BACKUP_PREFIX:-postgres}"

stamp="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

dump="$tmp/nirvaprocure-${stamp}.sql.gz"

echo "==> pg_dump → ${dump}"
pg_dump \
  --no-owner \
  --no-acl \
  --quote-all-identifiers \
  --format=plain \
  "$DATABASE_URL" \
  | gzip -9 > "$dump"

bytes="$(stat -f%z "$dump" 2>/dev/null || stat -c%s "$dump")"
echo "    dump size: ${bytes} bytes"

key="${PREFIX}/${stamp}.sql.gz"
echo "==> Uploading s3://${BACKUP_BUCKET}/${key}"

# --storage-class STANDARD_IA → cheaper for write-once. Transition to
# Glacier via the bucket's lifecycle policy after N days.
aws s3 cp \
  --region "$REGION" \
  --storage-class STANDARD_IA \
  ${BACKUP_ENDPOINT:+--endpoint-url "$BACKUP_ENDPOINT"} \
  "$dump" "s3://${BACKUP_BUCKET}/${key}"

echo "✅ Backup complete: s3://${BACKUP_BUCKET}/${key} (${bytes} bytes)"

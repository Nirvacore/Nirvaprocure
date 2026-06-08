#!/usr/bin/env bash
# Idempotent schema migration runner.
#
# Usage:
#   DATABASE_URL=postgres://... ./scripts/migrate.sh           # apply all pending
#   DATABASE_URL=postgres://... ./scripts/migrate.sh --list    # show status
#   DATABASE_URL=postgres://... ./scripts/migrate.sh --dry     # show what WOULD run
#
# Rules:
#   - SQL files live in database/ and are applied in a fixed order (see MIGRATIONS below).
#   - We track applied migrations in a `schema_migrations` table created on first run.
#   - Each migration runs inside its own transaction (psql `--single-transaction`),
#     so a failure leaves the DB untouched and the migration unmarked.
#   - Re-running this is safe: applied files are skipped.

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"

# Order matters. Phase 1 establishes the base; subsequent phases add tables
# that reference Phase 1's. The seed runs LAST so it can see all FK targets.
MIGRATIONS=(
  phase1_schema.sql
  phase2_stock_schema.sql
  phase2_gov_schema.sql
  phase4_portal_schema.sql
  phase4_2fa_schema.sql
  phase5_incentives_schema.sql
  phase5_anomaly_schema.sql
  phase5_budget_schema.sql
  phase5_comments_schema.sql
  phase5_webhooks_schema.sql
  phase6_locale_schema.sql
  phase6_pdpa_consent_schema.sql
  seed.sql
)

DB_DIR="$(cd "$(dirname "$0")/.." && pwd)/database"
MODE="${1:-apply}"

ensure_table() {
  psql -q "$DATABASE_URL" <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  name        TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  sha256      TEXT NOT NULL
);
SQL
}

is_applied() {
  local name="$1"
  local count
  count="$(psql -tA "$DATABASE_URL" -c "SELECT COUNT(*) FROM schema_migrations WHERE name = '$name'")"
  [[ "$count" -gt 0 ]]
}

apply_one() {
  local name="$1"
  local path="$DB_DIR/$name"
  if [[ ! -f "$path" ]]; then
    echo "    SKIP: $name not found at $path" >&2
    return 0
  fi
  local sha
  # macOS shasum vs. linux sha256sum — handle both.
  sha="$(shasum -a 256 "$path" 2>/dev/null | awk '{print $1}' || sha256sum "$path" | awk '{print $1}')"

  echo "==> Applying $name"
  # --single-transaction wraps the whole file in a tx; --set ON_ERROR_STOP=1
  # makes psql exit on the first error. Together: atomic apply.
  psql -q --single-transaction --set ON_ERROR_STOP=1 "$DATABASE_URL" -f "$path"
  psql -q "$DATABASE_URL" -c \
    "INSERT INTO schema_migrations (name, sha256) VALUES ('$name', '$sha')"
  echo "    ✓ recorded"
}

case "$MODE" in
  --list)
    ensure_table
    echo "Migration              Applied?"
    echo "──────────────────────────────────"
    for m in "${MIGRATIONS[@]}"; do
      if is_applied "$m"; then
        printf "  ✓ %s\n" "$m"
      else
        printf "  · %s\n" "$m"
      fi
    done
    ;;
  --dry)
    ensure_table
    for m in "${MIGRATIONS[@]}"; do
      if ! is_applied "$m"; then
        echo "WOULD APPLY: $m"
      fi
    done
    ;;
  apply|"")
    ensure_table
    for m in "${MIGRATIONS[@]}"; do
      if is_applied "$m"; then
        echo "==> Already applied: $m"
        continue
      fi
      apply_one "$m"
    done
    echo "✅ All migrations applied"
    ;;
  *)
    echo "Unknown mode: $MODE" >&2
    echo "Usage: $0 [--list | --dry | apply]" >&2
    exit 1
    ;;
esac

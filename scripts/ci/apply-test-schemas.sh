#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:?PGHOST is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"
: "${PGDATABASE:?PGDATABASE is required}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$script_dir/../.." && pwd)"

schemas=(
  phase1_schema.sql
  phase2_stock_schema.sql
  phase2_gov_schema.sql
  phase4_2fa_schema.sql
  phase4_portal_schema.sql
  phase5_anomaly_schema.sql
  phase5_budget_schema.sql
  phase5_comments_schema.sql
  phase5_incentives_schema.sql
  phase5_webhooks_schema.sql
  phase6_affiliate_schema.sql
  phase6_ai_runs_schema.sql
  phase6_line_binding_schema.sql
  phase6_locale_schema.sql
  phase6_pdpa_consent_schema.sql
  phase6_supplier_risk_schema.sql
  phase7_attachments_schema.sql
  phase7_fcm_schema.sql
  phase7_po_schema.sql
  seed.sql
)

for schema in "${schemas[@]}"; do
  psql -X -v ON_ERROR_STOP=1 \
    -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" \
    -f "$root_dir/database/$schema"
done

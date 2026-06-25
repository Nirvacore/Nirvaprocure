#!/usr/bin/env bash
# Smoke test for the full NIRVAPROCURE Docker Compose stack.
#
# Exits non-zero on the first failed step so CI flags real regressions.
# Run from the repo root:  ./scripts/smoke.sh
#
# Assumes docker-compose has already brought the stack up (or starts it itself
# when SMOKE_BRINGUP=1 is set). When run standalone, point API at a different
# host with SMOKE_API_BASE.

set -euo pipefail

API="${SMOKE_API_BASE:-http://localhost:3000/v1}"
EMAIL="${SMOKE_EMAIL:-suda@nirva.co.th}"
PASSWORD="${SMOKE_PASSWORD:-password123}"

# Optional bring-up: useful from CI where the test runner owns the stack.
if [[ "${SMOKE_BRINGUP:-0}" == "1" ]]; then
    # Verify daemon is reachable before promising bringup. Some sandbox
    # environments expose the docker CLI but block the socket.
    if ! docker info >/dev/null 2>&1; then
        echo "FAIL: docker daemon unreachable. Start Docker Desktop or unset SMOKE_BRINGUP." >&2
        exit 1
    fi
    echo "==> docker compose up -d --build"
    docker compose up -d --build || { echo "FAIL: docker compose up failed" >&2; exit 1; }
    trap 'docker compose down -v' EXIT
fi

echo "==> Waiting for backend to become healthy..."
for i in {1..60}; do
    if curl -fsS "$API/health" | grep -q '"status":"ok"'; then
        echo "    backend up after ${i}s"
        break
    fi
    sleep 1
    if [[ "$i" == 60 ]]; then
        echo "FAIL: backend never reached /health"
        docker compose logs --tail=50 backend || true
        exit 1
    fi
done

cookie_jar="$(mktemp)"
trap 'rm -f "$cookie_jar"' EXIT

# -----------------------------------------------------------------------------
# 1. Login
# -----------------------------------------------------------------------------
echo "==> POST /auth/login as $EMAIL"
login_response="$(
  curl -fsS -c "$cookie_jar" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
    "$API/auth/login"
)"
echo "$login_response" | grep -q '"token"' || { echo "FAIL: login response missing token"; echo "$login_response"; exit 1; }
TOKEN="$(printf '%s' "$login_response" | python3 -c 'import sys, json; print(json.load(sys.stdin)["token"])')"
echo "    token issued (len ${#TOKEN})"

auth_header=(-H "Authorization: Bearer $TOKEN")

# -----------------------------------------------------------------------------
# 2. List PRs (should at least include the seeded PR-2026-0042)
# -----------------------------------------------------------------------------
echo "==> GET /pr"
pr_list="$(curl -fsS -b "$cookie_jar" "${auth_header[@]}" "$API/pr")"
echo "$pr_list" | grep -q 'PR-2026-0042' || { echo "FAIL: seeded PR not in list"; echo "$pr_list"; exit 1; }
echo "    list returns seeded PR"

# -----------------------------------------------------------------------------
# 3. Inbox should expose the seeded PR awaiting approval
# -----------------------------------------------------------------------------
echo "==> GET /approvals/inbox (as another user via cookie)"
# Switch users: login as the seeded approver to view the inbox.
approver_login="$(
  curl -fsS -c "$cookie_jar" \
    -H 'Content-Type: application/json' \
    -d '{"email":"por@nirva.co.th","password":"password123"}' \
    "$API/auth/login"
)"
APPROVER_TOKEN="$(printf '%s' "$approver_login" | python3 -c 'import sys, json; print(json.load(sys.stdin)["token"])')"
inbox="$(curl -fsS -b "$cookie_jar" -H "Authorization: Bearer $APPROVER_TOKEN" "$API/approvals/inbox")"
echo "$inbox" | grep -q 'instance_id' || { echo "FAIL: approver inbox empty"; echo "$inbox"; exit 1; }
INSTANCE_ID="$(printf '%s' "$inbox" | python3 -c 'import sys, json; print(json.load(sys.stdin)[0]["instance_id"])')"
echo "    inbox has instance $INSTANCE_ID"

# -----------------------------------------------------------------------------
# 4. Approve it
# -----------------------------------------------------------------------------
echo "==> POST /approvals/$INSTANCE_ID/decision"
curl -fsS -b "$cookie_jar" -H "Authorization: Bearer $APPROVER_TOKEN" \
    -H 'Content-Type: application/json' \
    -d '{"decision":"approved","comment":"smoke test"}' \
    "$API/approvals/$INSTANCE_ID/decision" >/dev/null
echo "    decision recorded"

# -----------------------------------------------------------------------------
# 5. Verify it disappeared from the inbox
# -----------------------------------------------------------------------------
echo "==> GET /approvals/inbox (post-approval)"
inbox_after="$(curl -fsS -b "$cookie_jar" -H "Authorization: Bearer $APPROVER_TOKEN" "$API/approvals/inbox")"
echo "$inbox_after" | grep -q "$INSTANCE_ID" && { echo "FAIL: instance still in inbox"; exit 1; }
echo "    instance gone from inbox"

# -----------------------------------------------------------------------------
# 6. Self-service PDPA export works
# -----------------------------------------------------------------------------
echo "==> GET /compliance/export/me"
me_export="$(curl -fsS -b "$cookie_jar" -H "Authorization: Bearer $APPROVER_TOKEN" "$API/compliance/export/me")"
echo "$me_export" | grep -q '"user"' || { echo "FAIL: export response missing user block"; exit 1; }
echo "    export OK"

# -----------------------------------------------------------------------------
# 7. Audit log is readable
# -----------------------------------------------------------------------------
echo "==> GET /audit/log"
audit_log="$(curl -fsS -b "$cookie_jar" "${auth_header[@]}" "$API/audit/log")"
echo "$audit_log" | grep -q '"data"' || { echo "FAIL: audit log response missing data"; echo "$audit_log"; exit 1; }
echo "    audit log OK"

# -----------------------------------------------------------------------------
# 8. Analytics summary is readable
# -----------------------------------------------------------------------------
echo "==> GET /analytics/summary"
analytics_summary="$(curl -fsS -b "$cookie_jar" "${auth_header[@]}" "$API/analytics/summary")"
echo "$analytics_summary" | grep -q 'pr_counts' || { echo "FAIL: analytics summary missing pr_counts"; echo "$analytics_summary"; exit 1; }
echo "    analytics summary OK"

# -----------------------------------------------------------------------------
# 9. Stock warehouses and on-hand are readable
# -----------------------------------------------------------------------------
echo "==> GET /stock/warehouses"
stock_wh="$(curl -fsS -b "$cookie_jar" "${auth_header[@]}" "$API/stock/warehouses")"
echo "$stock_wh" | grep -q '"code"' || { echo "FAIL: stock warehouses response missing code"; echo "$stock_wh"; exit 1; }
echo "    stock warehouses OK"

echo "==> GET /stock/on-hand"
stock_on_hand="$(curl -fsS -b "$cookie_jar" "${auth_header[@]}" "$API/stock/on-hand")"
echo "$stock_on_hand" | grep -qE '\[|qty' || { echo "FAIL: stock on-hand response unexpected"; echo "$stock_on_hand"; exit 1; }
echo "    stock on-hand OK"

# -----------------------------------------------------------------------------
# 10. NirvaGov TOR templates and drafts are readable
# -----------------------------------------------------------------------------
echo "==> GET /gov/tor/templates"
gov_templates="$(curl -fsS -b "$cookie_jar" "${auth_header[@]}" "$API/gov/tor/templates")"
echo "$gov_templates" | grep -qE '\[|procurement_kind' || { echo "FAIL: gov templates response unexpected"; echo "$gov_templates"; exit 1; }
echo "    gov templates OK"

echo "==> GET /gov/tor/drafts"
gov_drafts="$(curl -fsS -b "$cookie_jar" "${auth_header[@]}" "$API/gov/tor/drafts")"
echo "$gov_drafts" | grep -qE '\[|"id"' || { echo "FAIL: gov drafts response unexpected"; echo "$gov_drafts"; exit 1; }
echo "$gov_drafts" | grep -q 'จัดซื้อเครื่องคอมพิวเตอร์' || { echo "FAIL: seeded TOR draft not in list"; echo "$gov_drafts"; exit 1; }
echo "    gov drafts OK"

# -----------------------------------------------------------------------------
# 11. TOR draft PDF export
# -----------------------------------------------------------------------------
TOR_DRAFT_ID='99999999-9999-9999-9999-999999999901'
echo "==> GET /gov/tor/drafts/$TOR_DRAFT_ID/pdf"
pdf_type="$(curl -fsS -b "$cookie_jar" "${auth_header[@]}" \
    -o /dev/null -w '%{content_type}' \
    "$API/gov/tor/drafts/$TOR_DRAFT_ID/pdf")"
echo "$pdf_type" | grep -q 'application/pdf' || { echo "FAIL: TOR PDF not application/pdf ($pdf_type)"; exit 1; }
echo "    gov draft PDF OK"

# -----------------------------------------------------------------------------
# 12. Patch TOR draft body (draft/review only)
# -----------------------------------------------------------------------------
echo "==> PATCH /gov/tor/drafts/$TOR_DRAFT_ID"
gov_patched="$(curl -fsS -b "$cookie_jar" "${auth_header[@]}" \
    -H 'Content-Type: application/json' \
    -X PATCH \
    -d '{"body_markdown":"## Smoke edit\nUpdated by smoke test\n\n## ระยะเวลาดำเนินการ\n12 เดือน (2026-01-01 ถึง 2026-12-31)"}' \
    "$API/gov/tor/drafts/$TOR_DRAFT_ID")"
echo "$gov_patched" | grep -q 'Smoke edit' || { echo "FAIL: TOR patch did not persist body"; echo "$gov_patched"; exit 1; }
echo "$gov_patched" | grep -q '"has_timeline":"passed"' || { echo "FAIL: PATCH should refresh has_timeline to passed"; echo "$gov_patched"; exit 1; }
echo "    gov patch OK"

# -----------------------------------------------------------------------------
# 13. Advance a seeded TOR draft (draft → review)
# -----------------------------------------------------------------------------
echo "==> POST /gov/tor/drafts/$TOR_DRAFT_ID/advance"
gov_advanced="$(curl -fsS -b "$cookie_jar" "${auth_header[@]}" \
    -X POST "$API/gov/tor/drafts/$TOR_DRAFT_ID/advance")"
echo "$gov_advanced" | grep -q '"status":"review"' || { echo "FAIL: advance did not return review status"; echo "$gov_advanced"; exit 1; }
echo "    gov advance OK"

# -----------------------------------------------------------------------------
# 14. Send back TOR draft (review → draft)
# -----------------------------------------------------------------------------
echo "==> POST /gov/tor/drafts/$TOR_DRAFT_ID/revert"
gov_reverted="$(curl -fsS -b "$cookie_jar" "${auth_header[@]}" \
    -X POST "$API/gov/tor/drafts/$TOR_DRAFT_ID/revert")"
echo "$gov_reverted" | grep -q '"status":"draft"' || { echo "FAIL: revert did not return draft status"; echo "$gov_reverted"; exit 1; }
echo "    gov revert OK"

# -----------------------------------------------------------------------------
# 15. Create PR from approved seeded TOR (999…902)
# -----------------------------------------------------------------------------
TOR_APPROVED_ID='99999999-9999-9999-9999-999999999902'
echo "==> POST /gov/tor/drafts/$TOR_APPROVED_ID/create-pr"
gov_pr="$(curl -fsS -b "$cookie_jar" "${auth_header[@]}" \
    -X POST "$API/gov/tor/drafts/$TOR_APPROVED_ID/create-pr")"
echo "$gov_pr" | grep -q '"linked_pr_id"' || { echo "FAIL: create-pr did not link a PR"; echo "$gov_pr"; exit 1; }
echo "$gov_pr" | grep -q 'linked_pr_number' || { echo "FAIL: create-pr missing linked_pr_number"; echo "$gov_pr"; exit 1; }
echo "    gov create-pr OK"

echo ""
echo "✅ SMOKE PASSED — all 17 steps green"

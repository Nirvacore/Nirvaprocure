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

echo ""
echo "✅ SMOKE PASSED — all 8 steps green"

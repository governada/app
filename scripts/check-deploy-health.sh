#!/usr/bin/env bash
# Post-deploy health check with response time assertions.
# Used by CI post-deploy verification and Railway webhook handler.
#
# Usage:
#   bash scripts/check-deploy-health.sh [base-url]
#   bash scripts/check-deploy-health.sh https://governada.io
#
# Exit 0 = healthy, Exit 1 = unhealthy or slow

set -euo pipefail

BASE_URL="${1:-https://governada.io}"
MAX_RESPONSE_MS=3000  # 3 second max for any endpoint
CRITICAL_MAX_MS=1000  # 1 second max for health endpoint

echo "=== Deploy Health Check ==="
echo "Target: $BASE_URL"
echo ""

FAILED=0
TOTAL=0

check_endpoint() {
  local name="$1"
  local path="$2"
  local max_ms="$3"
  local url="${BASE_URL}${path}"

  TOTAL=$((TOTAL + 1))

  # Measure response time in milliseconds
  local start_ms=$(date +%s%N 2>/dev/null | cut -b1-13 || python3 -c "import time; print(int(time.time()*1000))")
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
  local end_ms=$(date +%s%N 2>/dev/null | cut -b1-13 || python3 -c "import time; print(int(time.time()*1000))")
  local duration_ms=$((end_ms - start_ms))

  local status="PASS"
  local detail="${http_code} ${duration_ms}ms"

  if [ "$http_code" != "200" ]; then
    status="FAIL"
    detail="${http_code} (expected 200)"
    FAILED=$((FAILED + 1))
  elif [ "$duration_ms" -gt "$max_ms" ] 2>/dev/null; then
    status="SLOW"
    detail="${http_code} ${duration_ms}ms (max: ${max_ms}ms)"
    FAILED=$((FAILED + 1))
  fi

  printf "  [%s] %-35s %s\n" "$status" "$name" "$detail"
}

# Critical path endpoints with response time budgets
check_endpoint "Health (readiness)"          "/api/health/ready"              "$CRITICAL_MAX_MS"
check_endpoint "Health (full)"               "/api/health"                    "$MAX_RESPONSE_MS"
check_endpoint "Health (deep)"               "/api/health/deep"              "$MAX_RESPONSE_MS"
check_endpoint "DRep list"                   "/api/dreps"                     "$MAX_RESPONSE_MS"
check_endpoint "Public API v1 DReps"         "/api/v1/dreps?limit=5"         "$MAX_RESPONSE_MS"
check_endpoint "Public API v1 Gov Health"    "/api/v1/governance/health"     "$MAX_RESPONSE_MS"
check_endpoint "Auth nonce"                  "/api/auth/nonce"               "$CRITICAL_MAX_MS"
check_endpoint "Proposals"                   "/api/proposals"                "$MAX_RESPONSE_MS"
check_endpoint "Citizen briefing"            "/api/briefing/citizen"         "5000"

echo ""
echo "$((TOTAL - FAILED))/$TOTAL checks passed."

if [ "$FAILED" -gt 0 ]; then
  echo ""
  echo "DEPLOY HEALTH CHECK FAILED"
  exit 1
fi

echo ""
echo "DEPLOY HEALTHY"
exit 0

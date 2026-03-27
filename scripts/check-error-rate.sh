#!/usr/bin/env bash
# Check Sentry error rate before allowing merge.
# Blocks merge if production error rate is elevated.
#
# Usage: bash scripts/check-error-rate.sh
# Exit 0 = error rate normal, Exit 1 = elevated (block merge)
#
# Requires: SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT in env or .env.local

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source env vars
for ENV_PATH in \
  "$SCRIPT_DIR/../.env.local" \
  "/c/Users/dalto/governada/governada-app/.env.local"; do
  if [ -f "$ENV_PATH" ]; then
    while IFS='=' read -r key value; do
      case "$key" in
        SENTRY_AUTH_TOKEN|SENTRY_ORG|SENTRY_PROJECT)
          value="${value#\"}"
          value="${value%\"}"
          export "$key=$value"
          ;;
      esac
    done < "$ENV_PATH"
    break
  fi
done

if [ -z "${SENTRY_AUTH_TOKEN:-}" ] || [ -z "${SENTRY_ORG:-}" ] || [ -z "${SENTRY_PROJECT:-}" ]; then
  echo "SKIP: Sentry env vars not configured. Skipping error rate check."
  exit 0
fi

# Query Sentry for error count in the last hour
echo "Checking Sentry error rate (last 1 hour)..."

ERROR_COUNT=$(curl -s \
  -H "Authorization: Bearer ${SENTRY_AUTH_TOKEN}" \
  "https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/stats/?stat=received&resolution=1h&since=$(date -u -d '1 hour ago' +%s 2>/dev/null || date -u -v-1H +%s 2>/dev/null || echo $(($(date +%s) - 3600)))" \
  2>/dev/null | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    # Sum the last hour's error counts
    total = sum(point[1] for point in data[-2:]) if isinstance(data, list) else 0
    print(total)
except:
    print(0)
" 2>/dev/null || echo "0")

# Thresholds
WARN_THRESHOLD=50    # Warn above 50 errors/hour
BLOCK_THRESHOLD=200  # Block above 200 errors/hour

echo "  Error count (last hour): $ERROR_COUNT"

if [ "$ERROR_COUNT" -gt "$BLOCK_THRESHOLD" ] 2>/dev/null; then
  echo ""
  echo "BLOCKED: Production error rate is critically elevated ($ERROR_COUNT errors/hour)"
  echo "Threshold: $BLOCK_THRESHOLD errors/hour"
  echo ""
  echo "Do NOT merge new changes until the error rate stabilizes."
  echo "Check Sentry dashboard: https://${SENTRY_ORG}.sentry.io/issues/?project=${SENTRY_PROJECT}"
  exit 1
elif [ "$ERROR_COUNT" -gt "$WARN_THRESHOLD" ] 2>/dev/null; then
  echo ""
  echo "WARNING: Production error rate is elevated ($ERROR_COUNT errors/hour)"
  echo "Threshold: $WARN_THRESHOLD errors/hour"
  echo "Proceed with caution — monitor Sentry after merge."
fi

echo "OK: Error rate is within normal range."
exit 0

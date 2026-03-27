#!/usr/bin/env bash
# BetterStack/UptimeRobot heartbeat integration.
# Pings configured heartbeat URLs after successful operations.
#
# Usage:
#   bash scripts/uptime-check.sh proposals   # Ping proposals heartbeat
#   bash scripts/uptime-check.sh batch       # Ping batch heartbeat
#   bash scripts/uptime-check.sh daily       # Ping daily heartbeat
#   bash scripts/uptime-check.sh deploy      # Ping after successful deploy
#   bash scripts/uptime-check.sh all         # Ping all heartbeats
#
# Heartbeat URLs are configured in .env.local:
#   HEARTBEAT_URL_PROPOSALS=https://uptime.betterstack.com/api/v1/heartbeat/xxx
#   HEARTBEAT_URL_BATCH=https://uptime.betterstack.com/api/v1/heartbeat/xxx
#   HEARTBEAT_URL_DAILY=https://uptime.betterstack.com/api/v1/heartbeat/xxx
#   HEARTBEAT_URL_DEPLOY=https://uptime.betterstack.com/api/v1/heartbeat/xxx

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source env vars
for ENV_PATH in \
  "$SCRIPT_DIR/../.env.local" \
  "/c/Users/dalto/governada/governada-app/.env.local"; do
  if [ -f "$ENV_PATH" ]; then
    while IFS='=' read -r key value; do
      case "$key" in
        HEARTBEAT_URL_*)
          value="${value#\"}"
          value="${value%\"}"
          export "$key=$value"
          ;;
      esac
    done < "$ENV_PATH"
    break
  fi
done

TYPE="${1:-all}"

ping_heartbeat() {
  local name="$1"
  local url_var="HEARTBEAT_URL_${name}"
  local url="${!url_var:-}"

  if [ -z "$url" ]; then
    echo "  SKIP: $name (no URL configured)"
    return
  fi

  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")

  if [ "$http_code" = "200" ] || [ "$http_code" = "204" ]; then
    echo "  OK: $name heartbeat pinged"
  else
    echo "  WARN: $name heartbeat failed (HTTP $http_code)"
  fi
}

echo "Pinging heartbeats..."

case "$TYPE" in
  proposals) ping_heartbeat "PROPOSALS" ;;
  batch)     ping_heartbeat "BATCH" ;;
  daily)     ping_heartbeat "DAILY" ;;
  deploy)    ping_heartbeat "DEPLOY" ;;
  all)
    ping_heartbeat "PROPOSALS"
    ping_heartbeat "BATCH"
    ping_heartbeat "DAILY"
    ping_heartbeat "DEPLOY"
    ;;
  *)
    echo "Unknown type: $TYPE"
    echo "Usage: uptime-check.sh [proposals|batch|daily|deploy|all]"
    exit 1
    ;;
esac

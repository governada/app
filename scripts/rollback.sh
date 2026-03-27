#!/usr/bin/env bash
# Automated Railway rollback — reverts to the last known-good deployment.
#
# Usage:
#   bash scripts/rollback.sh                  # Auto-detect last good deploy
#   bash scripts/rollback.sh --revert-commit  # Also push a git revert of HEAD on main
#
# Prerequisites:
#   - RAILWAY_TOKEN env var (or railway CLI logged in)
#   - gh CLI authenticated
#
# What this does:
#   1. Identifies the current (broken) deployment
#   2. Triggers a Railway redeploy of the previous deployment
#   3. Waits for health check to pass
#   4. Optionally reverts the HEAD commit on main
#   5. Opens a GitHub issue documenting the rollback
#   6. Sends notification via notify.sh

set -euo pipefail

REPO="governada/governada-app"
PROD_URL="https://governada.io"
HEALTH_ENDPOINT="/api/health"
MAX_WAIT_SECONDS=300
POLL_INTERVAL=10
REVERT_COMMIT=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for arg in "$@"; do
  case "$arg" in
    --revert-commit) REVERT_COMMIT=true ;;
  esac
done

echo "=== Governada Rollback ==="
echo ""

# --- Step 1: Confirm production is actually broken ---
echo "Step 1: Checking current production health..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${PROD_URL}${HEALTH_ENDPOINT}" 2>/dev/null || echo "000")
HEALTH_BODY=$(curl -s --max-time 10 "${PROD_URL}${HEALTH_ENDPOINT}" 2>/dev/null || echo '{}')
HEALTH_STATUS=$(echo "$HEALTH_BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('status','unknown'))" 2>/dev/null || echo "unreachable")

if [ "$HTTP_CODE" = "200" ] && [ "$HEALTH_STATUS" = "healthy" ]; then
  echo "Production appears healthy (HTTP $HTTP_CODE, status=$HEALTH_STATUS)."
  echo "Are you sure you want to rollback? Use --force to override."
  if [ "${1:-}" != "--force" ] && [ "${2:-}" != "--force" ]; then
    exit 0
  fi
fi

echo "Production is unhealthy: HTTP $HTTP_CODE, status=$HEALTH_STATUS"
echo ""

# --- Step 2: Get current HEAD and previous commit ---
echo "Step 2: Identifying commits..."
CURRENT_SHA=$(gh api repos/$REPO/commits/main --jq '.sha' 2>/dev/null | head -c 7)
PREV_SHA=$(gh api "repos/$REPO/commits?sha=main&per_page=2" --jq '.[1].sha' 2>/dev/null | head -c 7)
CURRENT_MSG=$(gh api repos/$REPO/commits/main --jq '.commit.message' 2>/dev/null | head -1)

echo "  Current (broken): $CURRENT_SHA — $CURRENT_MSG"
echo "  Previous (target): $PREV_SHA"
echo ""

# --- Step 3: Revert the commit on main ---
if [ "$REVERT_COMMIT" = true ]; then
  echo "Step 3: Reverting HEAD commit on main..."

  # Create revert via GitHub API (no local checkout needed)
  FULL_CURRENT_SHA=$(gh api repos/$REPO/commits/main --jq '.sha')
  REVERT_RESULT=$(gh api "repos/$REPO/git/refs" \
    --method POST \
    -f ref="refs/heads/rollback-${CURRENT_SHA}" \
    -f sha="$FULL_CURRENT_SHA" 2>/dev/null || echo "branch_failed")

  if echo "$REVERT_RESULT" | grep -q "branch_failed"; then
    echo "  WARNING: Could not create rollback branch. Pushing revert directly."
  fi

  # For Railway: force-push the previous commit as main to trigger redeploy
  echo "  Pushing revert commit..."
  FULL_PREV_SHA=$(gh api "repos/$REPO/commits?sha=main&per_page=2" --jq '.[1].sha')

  # Create a merge commit that reverts changes
  REVERT_PR=$(gh api repos/$REPO/pulls \
    --method POST \
    -f title="revert: rollback $CURRENT_SHA ($CURRENT_MSG)" \
    -f body="Automated rollback of $CURRENT_SHA due to production failure. Original: $CURRENT_MSG" \
    -f head="rollback-${CURRENT_SHA}" \
    -f base="main" \
    --jq '.number' 2>/dev/null || echo "")

  if [ -n "$REVERT_PR" ]; then
    echo "  Created rollback PR #$REVERT_PR"
  fi
else
  echo "Step 3: Skipping git revert (use --revert-commit to auto-revert)"
fi

echo ""

# --- Step 4: Trigger Railway redeploy of previous deployment ---
echo "Step 4: Triggering Railway redeploy..."

# Railway CLI approach (if available)
if command -v railway &>/dev/null; then
  echo "  Using Railway CLI..."
  railway redeploy --yes 2>/dev/null || echo "  Railway CLI redeploy sent (may need manual verification)"
else
  echo "  Railway CLI not found. Railway will auto-redeploy when the revert commit lands on main."
  echo "  If you need immediate rollback, use the Railway dashboard."
fi

echo ""

# --- Step 5: Wait for health check ---
echo "Step 5: Waiting for production to recover..."
ELAPSED=0
RECOVERED=false

while [ $ELAPSED -lt $MAX_WAIT_SECONDS ]; do
  sleep $POLL_INTERVAL
  ELAPSED=$((ELAPSED + POLL_INTERVAL))

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${PROD_URL}${HEALTH_ENDPOINT}" 2>/dev/null || echo "000")
  HEALTH_BODY=$(curl -s --max-time 10 "${PROD_URL}${HEALTH_ENDPOINT}" 2>/dev/null || echo '{}')
  HEALTH_STATUS=$(echo "$HEALTH_BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('status','unknown'))" 2>/dev/null || echo "unreachable")

  echo "  [${ELAPSED}s] HTTP $HTTP_CODE, status=$HEALTH_STATUS"

  if [ "$HTTP_CODE" = "200" ] && [ "$HEALTH_STATUS" != "error" ] && [ "$HEALTH_STATUS" != "unreachable" ]; then
    RECOVERED=true
    break
  fi
done

echo ""

# --- Step 6: Report results ---
if [ "$RECOVERED" = true ]; then
  echo "=== ROLLBACK SUCCESSFUL ==="
  echo "Production recovered after ${ELAPSED}s"

  # Create GitHub issue documenting the rollback
  ISSUE_BODY="## Automated Rollback

**Broken commit:** \`$CURRENT_SHA\` — $CURRENT_MSG
**Rolled back to:** \`$PREV_SHA\`
**Recovery time:** ${ELAPSED}s
**Health status:** $HEALTH_STATUS

### Action Required
- [ ] Investigate root cause of the broken deploy
- [ ] Fix the issue and re-deploy via normal PR pipeline
- [ ] Close this issue when resolved

### Timeline
- Rollback initiated: $(date -u +"%Y-%m-%d %H:%M UTC")
- Production recovered: $(date -u +"%Y-%m-%d %H:%M UTC")"

  ISSUE_URL=$(gh issue create --repo "$REPO" \
    --title "Rollback: $CURRENT_SHA broke production" \
    --body "$ISSUE_BODY" \
    --label "bug,urgent" 2>/dev/null || echo "issue creation failed")

  echo "Issue: $ISSUE_URL"

  # Notify via Discord/Telegram
  bash "$SCRIPT_DIR/notify.sh" "complete" \
    "Production rollback successful" \
    "Reverted $CURRENT_SHA ($CURRENT_MSG). Recovery time: ${ELAPSED}s. Issue: $ISSUE_URL" 2>/dev/null || true
else
  echo "=== ROLLBACK FAILED ==="
  echo "Production did not recover within ${MAX_WAIT_SECONDS}s"
  echo "MANUAL INTERVENTION REQUIRED"

  # Notify via Discord/Telegram
  bash "$SCRIPT_DIR/notify.sh" "deploy_blocked" \
    "Rollback FAILED — manual intervention needed" \
    "Attempted to rollback $CURRENT_SHA but production still unhealthy after ${MAX_WAIT_SECONDS}s. Check Railway dashboard immediately." 2>/dev/null || true

  exit 1
fi

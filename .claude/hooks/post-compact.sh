#!/usr/bin/env bash
# Post-compaction context recovery for large (1M token) sessions.
# When compaction fires, this session has been running a LONG time.
# Recover the critical state so the agent can continue without drift.

set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

echo "=== POST-COMPACTION CONTEXT RECOVERY ==="
echo ""

# 1. Current branch and divergence from main
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
echo "## Branch: $branch"

if [ "$branch" != "main" ] && [ "$branch" != "unknown" ]; then
  ahead=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo "?")
  behind=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo "?")
  echo "Ahead of main: $ahead commits | Behind main: $behind commits"
  echo ""

  # Recent commits on this branch (what we've been building)
  echo "## Recent commits on this branch:"
  git log --oneline origin/main..HEAD 2>/dev/null | head -15 || echo "(none)"
  echo ""
fi

# 2. Working tree state (uncommitted work)
staged=$(git diff --cached --stat 2>/dev/null)
unstaged=$(git diff --stat 2>/dev/null)
untracked=$(git ls-files --others --exclude-standard 2>/dev/null | head -10)

if [ -n "$staged" ] || [ -n "$unstaged" ] || [ -n "$untracked" ]; then
  echo "## Uncommitted work:"
  if [ -n "$staged" ]; then
    echo "### Staged:"
    echo "$staged"
  fi
  if [ -n "$unstaged" ]; then
    echo "### Modified (unstaged):"
    echo "$unstaged"
  fi
  if [ -n "$untracked" ]; then
    echo "### Untracked:"
    echo "$untracked"
  fi
  echo ""
fi

# 3. Active checkpoints (multi-phase builds in progress)
checkpoint_dir=".claude/checkpoints"
if [ -d "$checkpoint_dir" ]; then
  checkpoints=$(find "$checkpoint_dir" -name "*.md" -newer "$checkpoint_dir" -o -name "*.md" 2>/dev/null | head -5)
  if [ -n "$checkpoints" ]; then
    echo "## Active checkpoints (may indicate in-progress multi-phase work):"
    for cp in $checkpoints; do
      # Print filename and first 3 lines for context
      echo "- $cp"
      head -5 "$cp" 2>/dev/null | sed 's/^/  /'
    done
    echo ""
    echo "If resuming a multi-phase build, read the full checkpoint file."
    echo ""
  fi
fi

# 4. Recent audit results (might be mid fix-audit cycle)
audit_dir=".claude/audit-results"
if [ -d "$audit_dir" ]; then
  # Show audits from the last 24 hours
  recent_audits=$(find "$audit_dir" -name "*.md" -newer "$audit_dir" -o -name "*.md" 2>/dev/null | head -5)
  if [ -n "$recent_audits" ]; then
    echo "## Recent audit results:"
    for audit in $recent_audits; do
      echo "- $audit"
    done
    echo ""
    echo "If fixing audit findings, read the relevant audit file."
    echo ""
  fi
fi

# 5. Open PRs from this repo (might be mid-ship)
open_prs=$(gh pr list --author @me --state open --limit 5 --json number,title,headBranch 2>/dev/null | \
  python3 -c "
import sys, json
try:
    prs = json.load(sys.stdin)
    for pr in prs:
        print(f\"  PR #{pr['number']}: {pr['title']} ({pr['headBranch']})\")
except: pass
" 2>/dev/null) || true

if [ -n "$open_prs" ]; then
  echo "## Open PRs (may indicate in-flight deploys):"
  echo "$open_prs"
  echo ""
fi

# 6. Reminder of key constraints
echo "## Key constraints (from AGENTS.md):"
echo "- force-dynamic on any page/route touching Supabase/env"
echo "- Register Inngest functions in app/api/inngest/route.ts"
echo "- Database reads via lib/data.ts only"
echo "- TanStack Query for client fetches"
echo "- npm run preflight before committing"
echo ""
echo "=== END RECOVERY — Read relevant files above if resuming complex work ==="

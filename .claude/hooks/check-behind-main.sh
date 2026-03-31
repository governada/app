#!/usr/bin/env bash
# Block git push when the branch is behind origin/main.
# Called as a PreToolUse hook on Bash tool for any git push command.
#
# Prevents pushing a stale branch that will require force-push or cause
# CI to run against an outdated base — a common failure in parallel-agent sessions.

INPUT=$(cat)

# Only fire on git push commands
if ! echo "$INPUT" | grep -qE '"(git push|push -u origin)' 2>/dev/null; then
  exit 0
fi

# Skip if not in a worktree (main checkout — not our concern)
if [ -d ".git" ]; then
  exit 0
fi

# Silently pass if fetch fails (offline, no remote, etc.)
git fetch origin main --quiet 2>/dev/null || exit 0

BEHIND_COUNT=$(git rev-list HEAD..origin/main --count 2>/dev/null || echo "0")

if [ "$BEHIND_COUNT" -gt 0 ] 2>/dev/null; then
  BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "this branch")
  echo ""
  echo "⚠️  PUSH BLOCKED: '$BRANCH' is ${BEHIND_COUNT} commit(s) behind origin/main."
  echo "   Pushing a behind branch causes rebase conflicts or CI failures."
  echo ""
  echo "   If working tree is CLEAN:"
  echo "     git rebase origin/main"
  echo ""
  echo "   If working tree is DIRTY (uncommitted changes):"
  echo "     git stash && git rebase origin/main && git stash pop"
  echo "   Or commit your incremental work first, then rebase:"
  echo "     git add -p && git commit -m 'wip: <description>'"
  echo "     git rebase origin/main"
  echo ""
  exit 2
fi

exit 0

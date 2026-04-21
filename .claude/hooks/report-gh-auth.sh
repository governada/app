#!/usr/bin/env bash
# Session-start auth diagnostics only. Do not mutate git or gh state here.

set -uo pipefail

status_output=$(node scripts/gh-auth-status.js 2>&1)
status_code=$?

if [ "$status_code" -ne 0 ]; then
  echo "GitHub auth: not ready. Run 'npm run auth:repair' before push/PR work."
  printf '%s\n' "$status_output" | head -8
  exit 0
fi

printf '%s\n' "$status_output" | tail -3

current_remote=$(git remote get-url origin 2>/dev/null || echo "")
expected_remote="git@github-governada:governada/governada-app.git"
if [ -n "$current_remote" ] && [ "$current_remote" != "$expected_remote" ]; then
  echo "GitHub remote: expected $expected_remote, found $current_remote. Run 'npm run auth:repair'."
fi

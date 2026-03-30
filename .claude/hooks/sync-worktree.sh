#!/usr/bin/env bash
# Sync worktree with latest origin/main and set up dev environment.
# Only runs in worktrees (not the main checkout) to avoid rebasing main itself.
#
# IMPORTANT: No `set -e` — this is a session-start hook and must be maximally
# forgiving. A git sync failure must never prevent dev env setup.

set -uo pipefail

# Detect if we're in a worktree (`.git` is a file, not a directory)
GIT_DIR_ENTRY="$(git rev-parse --git-dir 2>/dev/null)" || exit 0
if [ -d ".git" ]; then
  # Main checkout — skip
  exit 0
fi

# --- Git sync ---
sync_git() {
  git fetch origin main --quiet 2>/dev/null || return 0

  local LOCAL MERGE_BASE REMOTE BEHIND_COUNT
  LOCAL=$(git rev-parse HEAD 2>/dev/null) || return 0
  MERGE_BASE=$(git merge-base HEAD origin/main 2>/dev/null) || return 0
  REMOTE=$(git rev-parse origin/main 2>/dev/null) || return 0

  if [ "$MERGE_BASE" = "$REMOTE" ]; then
    return 0
  fi

  # Skip rebase if working tree is dirty — don't risk conflicts or data loss
  if ! git diff --quiet HEAD 2>/dev/null || ! git diff --cached --quiet HEAD 2>/dev/null; then
    echo "WARN: worktree has uncommitted changes — skipping rebase. Run 'git rebase origin/main' after committing." >&2
    return 0
  fi

  if ! git rebase origin/main --quiet 2>/dev/null; then
    git rebase --abort 2>/dev/null || true
    echo "WARN: auto-sync with origin/main failed (conflicts). Run 'git rebase origin/main' manually." >&2
    return 0
  fi

  BEHIND_COUNT=$(git rev-list "$MERGE_BASE".."$REMOTE" --count 2>/dev/null || echo "?")
  echo "Synced worktree: rebased ${BEHIND_COUNT} commits from origin/main." >&2
}

# --- Dev environment setup ---
setup_dev_env() {
  # Resolve the main checkout path from git common dir
  local MAIN_CHECKOUT
  MAIN_CHECKOUT="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null | sed 's|/\.git$||')" || return 0

  if [ -z "$MAIN_CHECKOUT" ] || [ ! -d "$MAIN_CHECKOUT" ]; then
    return 0
  fi

  # Copy .env.local if missing (plain copy so each worktree is independent)
  if [ ! -f ".env.local" ] && [ -f "$MAIN_CHECKOUT/.env.local" ]; then
    cp "$MAIN_CHECKOUT/.env.local" .env.local
    echo "Copied .env.local from main checkout." >&2
  fi

  # Junction node_modules from main checkout if missing and package.json matches
  if [ ! -d "node_modules" ] && [ -d "$MAIN_CHECKOUT/node_modules" ]; then
    if diff -q package.json "$MAIN_CHECKOUT/package.json" > /dev/null 2>&1; then
      local JUNCTION_TARGET JUNCTION_SOURCE
      JUNCTION_TARGET="$(cygpath -w "$(pwd)/node_modules")"
      JUNCTION_SOURCE="$(cygpath -w "$MAIN_CHECKOUT/node_modules")"
      cmd.exe //c "mklink /J $JUNCTION_TARGET $JUNCTION_SOURCE" > /dev/null 2>&1 \
        && echo "Linked node_modules from main checkout." >&2 \
        || echo "WARN: failed to junction node_modules — run 'npm install'." >&2
    else
      echo "WARN: package.json differs from main — run 'npm install' in this worktree." >&2
    fi
  fi
}

# Always run both — git sync failure must never block dev env setup
sync_git || true
setup_dev_env || true

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
  git fetch origin main --quiet 2>/dev/null || {
    echo "WARN: Could not fetch origin/main — check network/auth." >&2
    return 0
  }

  local LOCAL MERGE_BASE REMOTE BEHIND_COUNT AHEAD_COUNT
  LOCAL=$(git rev-parse HEAD 2>/dev/null) || return 0
  MERGE_BASE=$(git merge-base HEAD origin/main 2>/dev/null) || return 0
  REMOTE=$(git rev-parse origin/main 2>/dev/null) || return 0

  BEHIND_COUNT=$(git rev-list "$MERGE_BASE".."$REMOTE" --count 2>/dev/null || echo "?")
  AHEAD_COUNT=$(git rev-list "$REMOTE"..HEAD --count 2>/dev/null || echo "?")

  if [ "$MERGE_BASE" = "$REMOTE" ]; then
    echo "Git: up-to-date with origin/main (ahead ${AHEAD_COUNT} commits)."
    return 0
  fi

  # Skip rebase if working tree is dirty — don't risk conflicts or data loss
  if ! git diff --quiet HEAD 2>/dev/null || ! git diff --cached --quiet HEAD 2>/dev/null; then
    echo ""
    echo "⚠️  WORKTREE BEHIND origin/main by ${BEHIND_COUNT} commits (working tree dirty — auto-rebase skipped)."
    echo "   ACTION REQUIRED: Commit or stash your changes, then run:"
    echo "     git rebase origin/main"
    echo "   Skipping now — rebase before pushing to avoid conflicts."
    echo ""
    return 0
  fi

  if ! git rebase origin/main --quiet 2>/dev/null; then
    git rebase --abort 2>/dev/null || true
    echo ""
    echo "⚠️  Auto-rebase onto origin/main FAILED (conflicts). Run manually:"
    echo "     git rebase origin/main"
    echo ""
    return 0
  fi

  echo "Git: rebased ${BEHIND_COUNT} commits from origin/main ✓"
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
    echo ".env.local: copied from main checkout ✓"
  fi

  # Junction node_modules from main checkout if missing and package.json matches.
  # mklink /J requires Admin rights on Windows — if it fails, fall back to npm install.
  if [ ! -d "node_modules" ] && [ -d "$MAIN_CHECKOUT/node_modules" ]; then
    if diff -q package.json "$MAIN_CHECKOUT/package.json" > /dev/null 2>&1; then
      local JUNCTION_TARGET JUNCTION_SOURCE
      JUNCTION_TARGET="$(cygpath -w "$(pwd)/node_modules")"
      JUNCTION_SOURCE="$(cygpath -w "$MAIN_CHECKOUT/node_modules")"
      if cmd.exe //c "mklink /J $JUNCTION_TARGET $JUNCTION_SOURCE" > /dev/null 2>&1; then
        echo "node_modules: junctioned from main checkout ✓"
      else
        echo "node_modules: junction failed (needs Admin) — running npm install..."
        npm install --prefer-offline --silent 2>/dev/null \
          && echo "node_modules: installed ✓" \
          || echo "WARN: npm install failed — run it manually." >&2
      fi
    else
      echo "node_modules: package.json differs from main — running npm install..."
      npm install --prefer-offline --silent 2>/dev/null \
        && echo "node_modules: installed ✓" \
        || echo "WARN: npm install failed — run it manually." >&2
    fi
  fi
}

# --- Git push credential setup ---
# Ensures HTTPS remotes work without hanging on credential prompts.
setup_git_credentials() {
  if gh auth status --hostname github.com > /dev/null 2>&1; then
    gh auth setup-git --hostname github.com > /dev/null 2>&1 \
      && echo "Git credentials: HTTPS push configured via gh ✓" \
      || true
  fi
}

# Always run all steps — failure in one must not block the others
echo "=== Worktree setup: $(git rev-parse --abbrev-ref HEAD) ==="
sync_git || true
setup_dev_env || true
setup_git_credentials || true
echo "=== Setup complete ==="

#!/usr/bin/env bash
# Sync worktree with latest origin/main and set up dev environment.
# Only runs in worktrees (not the main checkout) to avoid rebasing main itself.
#
# IMPORTANT: No `set -e` — this is a session-start hook and must be maximally
# forgiving for dev-env setup. But git sync DOES hard-block when the worktree
# is behind origin/main and can't auto-rebase (dirty tree). Planning on stale
# code wastes the entire session.

set -uo pipefail

# Detect if we're in a worktree (`.git` is a file, not a directory)
GIT_DIR_ENTRY="$(git rev-parse --git-dir 2>/dev/null)" || exit 0
if [ -d ".git" ]; then
  # Main checkout — skip
  exit 0
fi

# --- CRLF phantom diff cleanup ---
# On Windows, `git worktree add` can check out files with CRLF even when
# .gitattributes says eol=lf (global core.autocrlf=true leaks through).
# These show as unstaged modifications with 0 real content changes per numstat.
# `git checkout -- .` replaces working-tree CRLF with index LF, clearing them.
cleanup_crlf_phantoms() {
  # Fast path: no unstaged changes at all
  git diff --quiet HEAD 2>/dev/null && return 0

  # Check if ALL modifications are zero-content (CRLF-only)
  local REAL
  REAL=$(git diff --numstat HEAD 2>/dev/null | awk '$1 != 0 || $2 != 0 { print }' | head -1)
  if [ -z "$REAL" ]; then
    local COUNT
    COUNT=$(git diff --name-only HEAD 2>/dev/null | wc -l)
    git checkout -- . 2>/dev/null
    echo "Git: discarded ${COUNT} CRLF phantom diffs ✓"
  fi
}

# --- Git sync ---
sync_git() {
  git fetch origin main --quiet 2>/dev/null || {
    echo "WARN: Could not fetch origin/main — check network/auth." >&2
    return 0
  }

  # Clean CRLF phantom diffs BEFORE dirty-tree detection.
  # This prevents line-ending noise from blocking auto-rebase.
  cleanup_crlf_phantoms

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

  # Check if working tree has REAL changes (not just CRLF phantom diffs).
  # On Windows with core.autocrlf=true, `git worktree add` checks out files
  # with CRLF while the index has LF, causing `git diff --quiet` to report
  # phantom modifications on shell scripts. .gitattributes fixes this for new
  # worktrees, but we also filter here as defense-in-depth.
  local IS_DIRTY=false
  local REAL_CHANGES
  REAL_CHANGES=$(git diff --numstat HEAD 2>/dev/null | awk '$1 != 0 || $2 != 0 { print }' | head -1)
  local STAGED_CHANGES
  STAGED_CHANGES=$(git diff --cached --numstat HEAD 2>/dev/null | awk '$1 != 0 || $2 != 0 { print }' | head -1)
  if [ -n "$REAL_CHANGES" ] || [ -n "$STAGED_CHANGES" ]; then
    IS_DIRTY=true
  fi
  # Also check for untracked files that might matter (not in .gitignore)
  local UNTRACKED
  UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null | grep -v '\.claude/' | head -1)
  if [ -n "$UNTRACKED" ]; then
    IS_DIRTY=true
  fi

  if [ "$IS_DIRTY" = "true" ]; then
    # HARD BLOCK: behind origin/main + dirty tree = planning on stale code.
    # The agent will read outdated files and produce a plan that doesn't match
    # what's actually on main. This wastes the entire session.
    echo ""
    echo "========================================================================="
    echo "BLOCKED: Worktree is ${BEHIND_COUNT} commit(s) behind origin/main"
    echo "         AND has uncommitted changes (auto-rebase not possible)."
    echo ""
    echo "Planning or coding on stale code wastes the session — you'll hit"
    echo "conflicts on every file that changed on main since you branched."
    echo ""
    echo "Fix (pick one):"
    echo ""
    echo "  Option A — Stash, rebase, pop:"
    echo "    git stash"
    echo "    git rebase origin/main"
    echo "    git stash pop"
    echo ""
    echo "  Option B — Commit WIP first, then rebase:"
    echo "    git add -A && git commit -m 'wip: save progress'"
    echo "    git rebase origin/main"
    echo ""
    echo "  Option C — Discard local changes and rebase (DESTRUCTIVE):"
    echo "    git checkout -- ."
    echo "    git rebase origin/main"
    echo ""
    echo "Uncommitted files:"
    git status --short | head -10
    echo "========================================================================="
    echo ""
    exit 2
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

# CRLF cleanup runs FIRST, before anything else — the Claude Code UI may
# snapshot the diff at session start, so we must clean phantom diffs ASAP.
# Then git sync (which also calls cleanup_crlf_phantoms after fetch, in case
# the fetch itself introduces new CRLF mismatches).
# --- Diff health check ---
# Warn loudly if the worktree has a large diff so agents investigate the
# actual cause instead of assuming (and chasing the wrong problem).
check_diff_health() {
  local UNTRACKED_LINES MODIFIED_LINES TOTAL
  UNTRACKED_LINES=$(git ls-files --others --exclude-standard 2>/dev/null \
    | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
  MODIFIED_LINES=$(git diff --stat HEAD 2>/dev/null | tail -1 \
    | sed -n 's/.*\([0-9]\+\) insertion.*/\1/p')
  MODIFIED_LINES=${MODIFIED_LINES:-0}
  TOTAL=$(( ${UNTRACKED_LINES:-0} + ${MODIFIED_LINES:-0} ))
  if [ "$TOTAL" -gt 500 ]; then
    echo ""
    echo "⚠️  LARGE DIFF DETECTED: ~${TOTAL} lines of uncommitted/untracked changes"
    echo "   Breakdown:"
    echo "   Untracked files:"
    git ls-files --others --exclude-standard 2>/dev/null | head -10
    echo "   Modified files:"
    git diff --name-only HEAD 2>/dev/null | head -10
    echo ""
    echo "   This will show in the session diff display. If unexpected,"
    echo "   add to .gitignore or delete before starting work."
    echo ""
  fi
}

echo "=== Worktree setup: $(git rev-parse --abbrev-ref HEAD) ==="
cleanup_crlf_phantoms
sync_git
setup_dev_env || true
setup_git_credentials || true
check_diff_health
echo "=== Setup complete ==="

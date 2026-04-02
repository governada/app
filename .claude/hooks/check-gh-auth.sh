#!/bin/bash
# Ensure gh CLI is authenticated as governada for this project.
# Runs on session start via Claude Code hook.
#
# Also keeps the repo remote credential-free. Authentication should flow
# through gh/git credential helpers rather than embedding tokens in the
# remote URL.

EXPECTED_USER="governada"
CURRENT_USER=$(gh api user --jq '.login' 2>/dev/null)

if [ "$CURRENT_USER" != "$EXPECTED_USER" ]; then
  gh auth switch --user "$EXPECTED_USER" 2>/dev/null
  NEW_USER=$(gh api user --jq '.login' 2>/dev/null)
  if [ "$NEW_USER" = "$EXPECTED_USER" ]; then
    echo "GitHub auth: switched to $EXPECTED_USER ✓"
  else
    echo "WARNING: Could not switch to $EXPECTED_USER (current: $CURRENT_USER)" >&2
  fi
fi

# Configure HTTPS push credentials via gh credential helper.
gh auth setup-git --hostname github.com > /dev/null 2>&1

# Scrub any embedded credentials from the remote URL if they exist.
CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null)
if echo "$CURRENT_REMOTE" | grep -qE '^https://[^/@]+:[^@]+@github\.com/' 2>/dev/null; then
  git remote set-url origin "https://github.com/governada/governada-app.git" 2>/dev/null
  echo "GitHub remote: removed embedded credentials ✓"
fi

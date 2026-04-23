#!/usr/bin/env bash
# Shell compatibility shim for exporting the canonical repo GH context.
# The source of truth is `scripts/set-gh-context.js`.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
eval "$(node "$SCRIPT_DIR/set-gh-context.js" --format=sh)"

#!/usr/bin/env bash
# Test a Supabase migration on a branch database before applying to production.
#
# Usage:
#   bash scripts/test-migration.sh "migration_name" "SQL_CONTENT"
#   bash scripts/test-migration.sh --cleanup  # Remove test branch
#
# This script:
#   1. Creates a Supabase branch database (copies all migrations from prod)
#   2. Applies the new migration on the branch
#   3. Runs basic validation (table exists, no errors)
#   4. Reports success/failure
#   5. Cleans up the branch
#
# Requires: Supabase MCP tools (run from Claude Code, not standalone)
#
# For agent use: This script documents the procedure. Agents should use
# Supabase MCP tools directly following this sequence:
#
#   1. mcp__supabase__create_branch(name: "migration-test-<name>")
#   2. mcp__supabase__apply_migration(name: "<name>", query: "<sql>")
#      (this runs against the branch, not production)
#   3. mcp__supabase__execute_sql(query: "SELECT 1")  -- validate
#   4. mcp__supabase__delete_branch(branch_id: "<id>")
#   5. If all passed, apply migration to production:
#      mcp__supabase__apply_migration(name: "<name>", query: "<sql>")

echo "=== Supabase Migration Safety Test ==="
echo ""
echo "This script is a reference for the agent migration workflow."
echo "Agents should use Supabase MCP tools directly."
echo ""
echo "Procedure:"
echo "  1. Create a Supabase branch: create_branch(name: 'migration-test-<name>')"
echo "  2. Apply migration on branch: apply_migration(name, query)"
echo "  3. Validate: execute_sql('SELECT 1') on branch"
echo "  4. Delete branch: delete_branch(branch_id)"
echo "  5. If passed, apply to production: apply_migration(name, query)"
echo ""
echo "Rollback SQL should be generated for every migration:"
echo "  - For CREATE TABLE: DROP TABLE IF EXISTS <table>"
echo "  - For ALTER TABLE ADD COLUMN: ALTER TABLE DROP COLUMN <col>"
echo "  - For CREATE INDEX: DROP INDEX IF EXISTS <index>"
echo "  - Store rollback SQL in: migrations/rollback/<migration_name>.sql"

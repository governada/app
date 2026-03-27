All code changes compile clean. Execute the full deploy pipeline autonomously. Do NOT pause between steps.

## Sequence

1. **Preflight**: `npm run preflight:quick` — fix ALL failures. Uses `test:changed` for speed; CI runs full suite as the authoritative gate.
2. **Auth check**: `gh auth status` — must show drepscore. If not: `gh auth switch --user drepscore`
3. **Branch check**: `git branch --show-current` — must NOT be main for features
4. **Force-dynamic audit**: Any new `app/` file importing `@/lib/supabase` or `@/lib/data` needs `export const dynamic = 'force-dynamic'`
5. **Stage + commit**: `git add <specific-files>` → review with `git diff --cached --name-only` → commit
6. **Push**: `git push -u origin HEAD`
7. **PR**: `gh pr create --title "feat: description" --body-file PR_BODY.md --base main` → delete PR_BODY.md
8. **CI**: `gh pr checks <N> --watch` — if fails, see [CI Failure Recovery](#ci-failure-recovery) below (max 3 retries)
9. **Pre-merge check**: `bash scripts/pre-merge-check.sh <PR#>` — includes Sentry error rate gate
10. **Merge**: `gh api repos/governada/governada-app/pulls/<N>/merge -X PUT -f merge_method=squash`
11. **Migrations**: If migrations needed, test on Supabase branch first (see `.claude/rules/migration-safety.md`), then apply via Supabase MCP `apply_migration` → `npm run gen:types`
12. **Verify production**: Railway auto-deploys from merge — do NOT watch CI on main or poll Railway logs. Wait ~3 min, then verify health: `bash scripts/check-deploy-health.sh`. Use `deploy-verifier` subagent in background if preferred.
13. **Inngest sync**: `curl -X PUT https://governada.io/api/inngest` if functions changed → `npm run inngest:status`
14. **Smoke test**: `npm run smoke-test` — includes response time assertions. Hit new/changed endpoints on `governada.io`.
15. **Analytics**: `npm run posthog:check <event>` if new events
16. **Heartbeat**: `bash scripts/uptime-check.sh deploy` — ping BetterStack
17. **Update tracking docs**: If this PR adds features, fixes scoring, changes counts (routes, components, functions), or ships a QP/step:
    - Update `docs/strategy/context/build-manifest.md` — check off items, add new `[x]` entries with PR #, update counts
    - Update `CLAUDE.md` if counts changed (Inngest functions, key files, etc.)
    - Commit doc updates in the same PR or as a follow-up commit on main
18. **Cleanup**: Switch to main, pull, delete local branch (`git branch -d <branch>`), drop any stashes from the branch (`git stash list` → `git stash drop`)

**IMPORTANT: For high-risk changes (scoring, matching, delegation, data migrations), use `/ship-careful` instead.**

**CRITICAL: Do NOT send a completion summary until deploy validation passes. Pushing code is step 6 of 18 — it is not "done."**

## Rollback

If smoke test or health check fails after merge:

1. Run `bash scripts/rollback.sh` — auto-detects, reverts, verifies, creates issue
2. With git revert: `bash scripts/rollback.sh --revert-commit`
3. Notify: script auto-sends Discord/Telegram alert

## CI Failure Recovery

When `gh pr checks` reports a failure:

### 1. Get the failed run ID and read the logs

```bash
# Get the run ID for the latest CI run on this PR
RUN_ID=$(gh run list --branch $(git branch --show-current) --limit 1 --json databaseId --jq '.[0].databaseId')
# Show ONLY the failed job logs (not the full run)
gh run view $RUN_ID --log-failed
```

### 2. Common failures and fixes

| Failure        | Check                            | Fix                                                                                                                                                  |
| -------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **format**     | `prettier --check` found issues  | `npx prettier --write <file>`, commit, push                                                                                                          |
| **lint**       | ESLint errors                    | Read the error, fix the code (unused vars, missing types), commit, push                                                                              |
| **type-check** | `tsc --noEmit` found type errors | Read the error, fix types, commit, push                                                                                                              |
| **test**       | Vitest test failure              | Run `npx vitest run <test-file>` locally to reproduce, fix, commit, push                                                                             |
| **build**      | Next.js build failed             | Usually a `force-dynamic` missing on a page using env vars or Supabase. Check the error for which page, add `export const dynamic = 'force-dynamic'` |

### 3. After fixing

```bash
git add <fixed-files>
git commit -m "fix: resolve CI failure (<check-name>)"
git push
# CI re-runs automatically on push — watch again:
gh pr checks <N> --watch
```

### 4. If stuck after 3 attempts

Escalate to the user with the exact error message. Do not keep pushing speculative fixes.

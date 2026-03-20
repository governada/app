Monitor the CI pipeline and Railway deployment until fully validated.

## Branch CI (before merge)

```bash
gh pr checks <pr-number> --watch
# If failed:
gh run list --branch <branch> --limit 1 --json databaseId --jq '.[0].databaseId'
gh run view <run-id> --log-failed
```

Branch protection requires ALL of: `type-check`, `lint`, `test`, `build`.
If CI fails: read the error, fix, commit, push. Max 3 retries before escalating.

## Post-Merge Verification

Railway auto-deploys on push to main independently of CI. Do NOT watch CI on main or poll `railway logs` — verify production directly:

1. Wait ~3 min after merge for Railway Docker build
2. Health check: `curl -s https://governada.io/api/health` — expect `"status":"healthy"` (or check sync-level status)
3. Inngest sync: `curl -X PUT https://governada.io/api/inngest` (if functions changed)
4. Smoke tests: `npm run smoke-test`
5. Feature-specific: hit the changed page/endpoint on `governada.io`

Alternatively, launch the `deploy-verifier` subagent in the background after merge — it handles steps 1-5 autonomously.

If ANY check fails: investigate, fix, push follow-up commit. Never report "done" until all checks pass.

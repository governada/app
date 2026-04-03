Monitor CI and verify deployment. Optimized for minimal context consumption.

## Branch CI (before merge)

Use `gh run watch` — prints only status changes, not full table every 10s:

```powershell
$RunId = gh run list --branch (git branch --show-current) --limit 1 --json databaseId --jq '.[0].databaseId'
gh run watch $RunId --exit-status
```

If CI failed, read only the tail of failed logs:

```powershell
gh run view $RunId --log-failed *>&1 | Select-Object -Last 20
```

Branch protection requires: `build` (which depends on `checks` + `test`).
Max 3 retries before escalating.

## Post-Merge Verification

**Always use the deploy-verifier subagent in background.** Do NOT block on this:

```
Agent(subagent_type="deploy-verifier", run_in_background=true,
  prompt="PR #N merged. Run npm run deploy:verify. If Inngest functions changed, run npm run deploy:verify -- --register-inngest")
```

The unified `smoke-test --quiet` subsumes health checks, response time assertions, and data integrity validation. Only failures are printed.

The `post-deploy.yml` GitHub Action also runs automatically as a second safety net.

If deploy-verifier reports failure: `npm run rollback`

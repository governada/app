# retrospective

You just completed a build session. Perform a thorough documentation review: capture learnings, update stale docs, and prune bloat. This is a maintenance task — be surgical, not expansive.

## 1. Capture Session Learnings

Review the conversation history for:

- **Corrections**: Anything the user corrected you on
- **Surprises**: APIs, tools, or platform behavior that was unexpected
- **Rework**: Plans that changed mid-execution and why
- **Debugging**: Root causes that took 2+ attempts to find
- **Process failures**: Steps skipped, wrong order, wasted time

For each, write a concise entry in `tasks/lessons.md` with: date, context (1-2 sentences), pattern (the reusable takeaway), and whether it should be promoted to a rule.

**Skip if**: nothing notable happened. Not every session produces lessons.

## 2. Audit Rules for Staleness

Read every file in `.cursor/rules/` and check against the ACTUAL codebase:

- **Dead references**: Files, functions, tables, or env vars mentioned in rules that no longer exist. Remove them.
- **Outdated counts/lists**: e.g., "16 durable functions" — count the actual `serve()` array in `app/api/inngest/route.ts`. Update if wrong.
- **Superseded patterns**: Rules about old approaches that have been replaced. Update to reflect current architecture.
- **Contradictions**: Rules that conflict with each other or with `critical.md`. Resolve in favor of `critical.md`.

## 3. Audit Lessons for Promotion or Pruning

Read `tasks/lessons.md` end-to-end:

- **Promote**: Any pattern that appeared 2+ times across sessions → propose a concrete rule addition to the appropriate `.cursor/rules/*.md` file. After promoting, add "Promoted to rule: <file>" to the lesson entry.
- **Consolidate**: Multiple lessons about the same topic (e.g., PowerShell heredoc appears 3+ times) → merge into one authoritative entry, delete the duplicates.
- **Archive**: Lessons about one-time issues that can't recur (e.g., a migration that's already applied, a dep that was removed) → delete them. Lessons should be forward-looking.

## 4. Verify Architecture Docs

Check `architecture.md` against reality:

- **Key Files table**: Are all listed files still the canonical locations? Any new key files missing?
- **Inngest function list**: Does it match `app/api/inngest/route.ts` `serve()` array exactly?
- **Scoring model**: Does it match the actual implementation?
- **Database section**: Are table names and migration count current?

## 5. Commit Changes

After all edits are complete, commit every modified file from the retro (lessons, rules, architecture docs) directly to the current branch. This is autonomous — do not ask for permission.

```
git add .cursor/rules/ .cursor/tasks/ tasks/
git commit -F .git/COMMIT_MSG
```

Use message: `docs: retro — <1-line summary of what changed>`. If on a feature branch, push. If on `main`, push only if the changes are docs-only (no code).

## 6. Output

Provide a summary of changes made:

# GHI Accuracy Fixes — PR 1

**Status:** READY TO EXECUTE
**Branch:** Create `fix/ghi-accuracy` from latest `main`
**Sequence:** This PR ships first. PR 2 (historical backfill) depends on this being deployed.

---

## Background

An audit of production GHI data (score: 65/Good, computed 2026-03-29) revealed 5 bugs artificially depressing or distorting the score. This PR fixes all of them.

### Current GHI Component Values (all incorrect)

| Component                      | Calibrated | Weight | Contribution | Bug                                                                   |
| ------------------------------ | ---------- | ------ | ------------ | --------------------------------------------------------------------- |
| DRep Participation             | 89         | 13.8%  | 12           | No bug — weighted median is correct                                   |
| **SPO Participation**          | **4**      | 9.6%   | **0**        | Unfair denominator: counts ALL 95 proposals, SPOs eligible for ~40    |
| Citizen Engagement             | 70         | 8.5%   | 6            | No bug                                                                |
| Deliberation Quality           | 62         | 13.8%  | 9            | Missing embeddings → 3-signal fallback instead of 5-signal            |
| Governance Effectiveness       | 51         | 13.8%  | 7            | No bug                                                                |
| **CC Constitutional Fidelity** | 83         | 9.6%   | 8            | Using all 13 members (status mismatch), should be 7 authorized        |
| Power Distribution             | 64         | 13.8%  | 9            | No bug                                                                |
| **System Stability**           | 75         | 8.5%   | 6            | Circular dep on ghi_snapshots; score volatility limited to epoch 608+ |
| **Treasury Health**            | **95**     | 8.5%   | 8            | Capped at 95 by calibration function                                  |
| Governance Outcomes            | 0          | 0%     | 0            | No data — correctly disabled                                          |

---

## Fix 1: SPO Participation — Fair Denominator

**File:** `lib/ghi/components.ts` — `computeSPOParticipation` function (~line 646)

### Problem

Code counts ALL 95 proposals as denominator. SPOs can only vote on 4 of 6 types. With 51 TreasuryWithdrawals and 4 NewConstitution excluded, eligible count is ~40. Additionally, 10 eligible proposals received 0 SPO votes (5 from pre-SPO era, 2 still open, 3 with very short windows or edge cases).

### Production Data

```
Proposal types:
  TreasuryWithdrawals: 51 (SPOs CANNOT vote)
  InfoAction: 31 (SPOs CAN vote)
  ParameterChange: 5 (SPOs CAN vote)
  NewConstitution: 4 (SPOs CANNOT vote)
  NewCommittee: 3 (SPOs CAN vote)
  HardForkInitiation: 1 (SPOs CAN vote)

SPO votes by type actually cast:
  InfoAction: 25 proposals voted on
  NewCommittee: 3
  HardForkInitiation: 1
  ParameterChange: 1
  Total: 30 distinct proposals with SPO votes

Current epoch: 621
Earliest SPO vote: epoch 507
722 active SPOs, median participation rate: 2.1% (against unfair denominator of 95)
```

### Fix

Three filters on the proposal denominator:

1. **Type eligibility**: Query proposals WHERE `proposal_type IN ('HardForkInitiation', 'ParameterChange', 'NewCommittee', 'InfoAction')`

2. **Practical availability**: Only count proposals that have ≥1 SPO vote in `spo_votes`. This automatically excludes proposals that predated practical SPO voting. Implementation: join or subquery against `spo_votes` to get distinct `(proposal_tx_hash, proposal_index)` pairs, then intersect with eligible proposals.

3. **Voting window**: Exclude still-open proposals. Filter: must have at least one of `ratified_epoch`, `enacted_epoch`, `dropped_epoch`, `expired_epoch` NOT NULL.

The current code at ~line 650:

```typescript
const { data: proposals } = await supabase.from('proposals').select('tx_hash, proposal_index');
```

Needs to become something like:

```typescript
// Get proposals SPOs could vote on that are closed and received at least 1 SPO vote
const { data: eligibleProposals } = await supabase
  .from('proposals')
  .select('tx_hash, proposal_index')
  .in('proposal_type', ['HardForkInitiation', 'ParameterChange', 'NewCommittee', 'InfoAction'])
  .or(
    'ratified_epoch.not.is.null,enacted_epoch.not.is.null,dropped_epoch.not.is.null,expired_epoch.not.is.null',
  );

// Further filter to only proposals with actual SPO votes
const { data: votedProposals } = await supabase
  .from('spo_votes')
  .select('proposal_tx_hash, proposal_index');
// deduplicate to distinct proposals
```

Then intersect the two sets for the denominator.

---

## Fix 2: CC Member Status — String Mismatch

**File:** `lib/ghi/components.ts` — CC Constitutional Fidelity section (~line 704)

### Problem

GHI code filters `m.status === 'active' || m.status === 'Active'`. Koios stores status as `'authorized'` (7 members) or `null` (6 former members). Zero members match 'active', so fallback uses all 13.

### Production Data

```sql
SELECT status, COUNT(*) FROM cc_members GROUP BY status;
-- authorized: 7
-- null: 6
```

### Fix

Change the filter from:

```typescript
m.status === 'active' || m.status === 'Active';
```

To:

```typescript
m.status === 'authorized';
```

This correctly selects the 7 active CC members.

---

## Fix 3: Embeddings Pipeline — Silent Failure

**File:** `inngest/functions/generate-embeddings.ts`

### Problem

The function runs every 6 hours, flag `semantic_embeddings` IS enabled, function IS registered in `app/api/inngest/route.ts` (line 109). But it has produced 0 embeddings ever because of column name mismatches:

- **Step 2 (proposals, line 42)**: Queries `proposals.index` but column is `proposal_index`. PostgREST silently returns null/empty for non-existent columns.
- **Step 4 (DRep profiles, line 127)**: Queries `dreps.objectives, motivations, alignment_narrative, personality_label` — NONE of these columns exist on `dreps`. DRep metadata lives in `dreps.metadata` (JSONB) and `dreps.info` (JSONB).
- **Step 3 (rationales, line 70)**: Joins `vote_rationales → drep_votes → proposals`. This may work once Step 2 is fixed, but the join syntax should be verified.

All steps fail silently because PostgREST returns empty results for bad column names.

### Production Data

```sql
-- Embeddings table: 0 rows (confirmed)
-- Feature flags: semantic_embeddings = true, all sub-flags = true
-- proposals table has column: proposal_index (NOT index)
-- dreps table has: metadata (JSONB), info (JSONB) — NOT objectives/motivations/etc
-- vote_rationales: 3,567 rows with text
-- proposals: 95 with titles
```

### Fix

**Step 2 (line 42):** Change:

```typescript
.select('tx_hash, index, title, abstract, proposal_type, ai_summary')
```

To:

```typescript
.select('tx_hash, proposal_index, title, abstract, proposal_type, ai_summary')
```

And update the `composeProposal` call (line 50-57) to use `proposal_index` instead of `index`.

**Step 4 (line 125-128):** The DRep profile data lives in the `metadata` JSONB column (Koios CIP-100 metadata). Check what fields are available:

```sql
SELECT DISTINCT jsonb_object_keys(metadata) FROM dreps WHERE metadata IS NOT NULL LIMIT 20;
```

Map to whatever actually exists. Common CIP-100 fields in metadata: `givenName`, `objectives`, `motivations`, `qualifications`, `paymentAddress`, `references`. If `objectives` and `motivations` are in `metadata` JSONB (not top-level columns), change the select to:

```typescript
.select('id, name, metadata')
```

Then extract fields from `metadata` JSONB in the map function.

**Silent failure prevention (all steps):**

- After each query, add explicit logging when results are null/empty:

```typescript
if (!proposals?.length) {
  logger.error(
    '[generate-embeddings] Step 2: proposals query returned 0 rows — possible column mismatch',
    {
      query: 'tx_hash, proposal_index, title, abstract, proposal_type, ai_summary',
      filter: 'title not null',
    },
  );
  return { generated: 0, total: 0, warning: 'empty query result' };
}
```

- Add similar guards for Steps 3 and 4.

---

## Fix 4: Remove 95 Calibration Cap

**File:** `lib/scoring/calibration.ts` — `calibrate()` function (line 1181-1195)

### Problem

The function caps ALL calibrated values at 95:

```typescript
if (raw <= curve.ceiling) {
  return 80 + ((raw - curve.targetHigh) / (curve.ceiling - curve.targetHigh)) * 15;
}
return 95; // Hard cap — this is the problem
```

Treasury Health currently hits this cap. The theoretical max GHI is 95, not 100.

### Fix

Change line 1194 from `return 95` to `return 100`.

**IMPORTANT:** This `calibrate()` function is shared across DRep scoring, SPO scoring, and GHI. The change applies to ALL calibration curves. Verify that DRep/SPO score tests still pass after the change. The 95→100 change is correct for all uses — if a raw value exceeds the ceiling, the component is performing excellently.

---

## Fix 5: System Stability — Remove Circular Dependencies

**File:** `lib/ghi/components.ts` — `computeSystemStability` (~line 758)

### Problem

Current implementation has two issues:

1. **DRep Retention (50%)** reads `activeDreps` from previous `ghi_snapshots` — circular dependency that breaks historical backfill
2. **Score Volatility (30%)** uses `drep_score_history` which only has data from epoch ~608 (2026-02-23)

### Fix: Redesign all 3 sub-signals

**DRep Retention (50%)** — Replace ghi_snapshot dependency with direct query:

```typescript
// Current epoch: count DReps with voting power > 0 in drep_power_snapshots
const { count: currentActive } = await supabase
  .from('drep_power_snapshots')
  .select('drep_id', { count: 'exact', head: true })
  .eq('epoch_no', currentEpoch)
  .gt('amount_lovelace', 0);

// Previous epoch
const { count: previousActive } = await supabase
  .from('drep_power_snapshots')
  .select('drep_id', { count: 'exact', head: true })
  .eq('epoch_no', currentEpoch - 1)
  .gt('amount_lovelace', 0);

const retentionRatio = previousActive > 0 ? currentActive / previousActive : 1;
const retentionScore = Math.min(100, retentionRatio * 100);
```

Data available: epoch 508-621.

**Delegation Volatility (30%)** — Replace score volatility with delegation stability:

```typescript
// Get voting power distribution for current and previous epoch
// Compute mean absolute change in voting power per DRep
// Lower volatility = higher score (stable delegations = healthy system)
```

Measure epoch-over-epoch changes in `drep_power_snapshots.amount_lovelace`. This is more meaningful than score volatility (which partly reflects our own scoring model changes) and is available back to epoch 508.

Scoring curve: `volatilityScore = min(100, max(0, (1 - meanPctChange / threshold) * 100))` where threshold calibrates what "too volatile" means (e.g., 20% mean change = score 0).

**Throughput Stability (20%)** — Keep as-is. Already uses `drep_votes` by epoch, fully historical.

---

## Fix 6: Clean Up Bad Snapshots (Post-Deploy)

After deploying fixes, execute via Supabase MCP:

```sql
-- Delete incorrect GHI snapshots
DELETE FROM ghi_snapshots WHERE epoch_no BETWEEN 616 AND 621;

-- Delete corresponding decentralization snapshots
DELETE FROM decentralization_snapshots WHERE epoch_no BETWEEN 616 AND 621;

-- Delete completeness log entries
DELETE FROM snapshot_completeness_log
WHERE snapshot_type IN ('ghi', 'edi') AND epoch_no BETWEEN 616 AND 621;
```

Then trigger fresh computation by sending Inngest event `drepscore/sync.ghi`.

---

## Post-Deploy: Trigger Embedding Generation

After the column name fixes are deployed, trigger the `generate-embeddings` function. Expected output:

- ~95 proposal embeddings
- ~3,567 rationale embeddings
- DRep profile embeddings (count depends on how many have metadata)

Verify with: `SELECT entity_type, COUNT(*) FROM embeddings GROUP BY entity_type;`

This MUST complete before PR 2 (historical backfill) begins, since PR 2 needs embeddings for full 5-signal Deliberation Quality.

---

## Verification Checklist

1. [ ] `npm run preflight` passes
2. [ ] Deploy to production
3. [ ] PUT `https://governada.io/api/inngest` to register function changes
4. [ ] Delete bad snapshots (SQL above)
5. [ ] Trigger GHI recompute — verify:
   - SPO Participation >> 4 (expect 40-70 range)
   - CC Fidelity uses 7 members
   - Treasury Health can score 100 (no 95 cap)
   - System Stability uses power snapshots (check logs)
6. [ ] Trigger embedding generation — verify:
   - `SELECT COUNT(*) FROM embeddings` > 0
   - `SELECT entity_type, COUNT(*) FROM embeddings GROUP BY entity_type` shows proposals + rationales
7. [ ] Smoke test: `npm run smoke-test`
8. [ ] Wait for PR 2 before backfilling historical data

---

## Files to Modify

1. `lib/ghi/components.ts` — SPO denominator (~line 646), CC status (~line 704), System Stability (~line 758)
2. `lib/scoring/calibration.ts` — Remove 95 cap (line 1194)
3. `inngest/functions/generate-embeddings.ts` — Column fixes (lines 42, 50-57, 125-128) + error logging

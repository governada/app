# GHI Historical Backfill — PR 2

**Status:** BLOCKED — Waiting for PR 1 (ghi-accuracy-fixes) to deploy and embeddings to populate
**Branch:** Create `feat/ghi-historical-backfill` from latest `main` (after PR 1 is merged)
**Prerequisites:**

1. PR 1 merged and deployed
2. Embeddings generated (verify: `SELECT COUNT(*) FROM embeddings` > 3000)
3. Current epoch GHI snapshot recomputed with fixed logic

---

## Goal

Build epoch-aware computation functions and backfill 90 epochs (530-621) of accurate GHI + DRep score history. This creates a complete trend line from the start of meaningful Cardano governance.

---

## Phase A: Backfill DRep Scores (epochs 530-621)

### What to build

A `computeDRepScoresForEpoch(epochNo)` function — epoch-scoped variant of the existing scoring pipeline.

### Data availability (all confirmed via production queries)

| Data Source                     | Epoch Range            | Notes                                                                             |
| ------------------------------- | ---------------------- | --------------------------------------------------------------------------------- |
| `drep_votes`                    | 507-621 (104 epochs)   | All votes with epoch_no, rationale_quality, meta_hash, meta_url, vote, block_time |
| `drep_power_snapshots`          | 508-621 (114 epochs)   | Per-DRep delegation per epoch (amount_lovelace, delegator_count)                  |
| `delegation_snapshots`          | 509-621 (113 epochs)   | Per-DRep delegator dynamics (new_delegators, lost_delegators)                     |
| `proposals`                     | 507-621 (95 proposals) | Full lifecycle columns. 89/95 have resolution data.                               |
| `proposal_voting_summary`       | Epoch-keyed            | Vote power breakdowns per proposal per epoch                                      |
| `vote_rationales`               | 3,567 records          | Rationale text (not epoch-keyed but linkable via drep_votes)                      |
| `dreps.metadata`                | Current state only     | CIP-100 profile metadata (JSONB)                                                  |
| `dreps.profile_last_changed_at` | Current state only     | Profile freshness timestamp                                                       |

### Pillar-by-pillar computation approach

**Engagement Quality (40%)**
All sub-signals scope to `drep_votes WHERE epoch_no <= targetEpoch`:

- **Provision Rate (40%)**: Count votes with rationale_quality NOT NULL vs total votes, weighted by proposal importance
- **Rationale Quality (40%)**: Average rationale_quality, with dissent and vote-change bonuses
- **Deliberation — Rationale Diversity (12%)**: Unique meta_hashes vs total. Blend with semantic diversity from embeddings (embeddings exist post-PR1; they're not epoch-keyed but the rationales they embed existed at the time)
- **Deliberation — Coverage Breadth (8%)**: Proposal types voted on vs available types, weighted by frequency

**Effective Participation (25%)**
Scope `drep_votes` and `proposals` to `epoch_no <= targetEpoch`. Compute importance-weighted vote coverage per DRep. Uses same `calculateEffectiveParticipation` logic but with epoch-scoped proposal set.

**Reliability (25%)**
Build epoch-vote-count arrays from `drep_votes WHERE epoch_no <= targetEpoch`:

- **Streak (35%)**: Consecutive epochs with votes counting backward from targetEpoch
- **Recency (30%)**: Epochs since last vote relative to targetEpoch
- **Gap (25%)**: Longest gap between vote-epochs (only counting epochs with active proposals)
- **Tenure (10%)**: Epochs since first vote

**Governance Identity (10%)**

- **Profile Quality (60%)**: Use CURRENT `dreps.metadata` for all epochs. Pragmatic decision — profiles rarely change, and this is 6% of total score. Use `profile_last_changed_at` for staleness decay relative to targetEpoch.
- **Community Presence (40%)**: Use `delegation_snapshots` at targetEpoch. Has retention, diversity, growth sub-signals. Available from epoch 509+.

### Storage

Insert into `drep_score_history` for each epoch:

```sql
INSERT INTO drep_score_history (
  drep_id, score, engagement_quality, effective_participation_v3,
  reliability_v3, governance_identity, epoch_no, snapshot_date,
  engagement_quality_raw, effective_participation_v3_raw,
  reliability_v3_raw, governance_identity_raw, score_version
) VALUES (...)
ON CONFLICT (drep_id, epoch_no) DO UPDATE SET ...;
```

Set `score_version = 'v3.2-backfill'` to distinguish from live-computed scores.

---

## Phase B: Backfill GHI Snapshots (epochs 530-621)

### What to build

A `computeGHIForEpoch(epochNo)` function — epoch-scoped variant of `computeGHI()`.

### Component-by-component approach

**DRep Participation (13%)**

- Get DRep scores from backfilled `drep_score_history` at targetEpoch
- Get voting power from `drep_power_snapshots` at targetEpoch
- Compute weighted median of `effective_participation` weighted by `amount_lovelace`

**SPO Participation (9%)**

- Get eligible proposals (correct types, resolved, with ≥1 SPO vote) where `proposed_epoch <= targetEpoch`
- Get SPO votes where `epoch <= targetEpoch`
- Compute median participation rate across pools

**Citizen Engagement (8%)**

- Delegation rate: Sum voting power from `drep_power_snapshots` at targetEpoch / circulating supply
- Delegation dynamism: Compare `delegation_snapshots` at targetEpoch vs targetEpoch-1

**Deliberation Quality (13%)**

- Use FULL 5-signal mode with embeddings (populated by PR 1)
- Rationale quality, debate diversity, voting independence from epoch-scoped `drep_votes`
- Semantic diversity + reasoning coherence from `embeddings` table (rationale and proposal embeddings)
- Scope vote data to `epoch_no <= targetEpoch`

**Governance Effectiveness (13%)**

- Resolution rate: proposals resolved by targetEpoch / total proposals by targetEpoch
- Decision velocity: median epochs from proposed to resolved (for proposals resolved by targetEpoch)
- Throughput: proposals with votes / total proposals (scoped to targetEpoch)

**CC Constitutional Fidelity (9%)**

- **RECONSTRUCT from vote history** — do NOT use current `cc_members.fidelity_score`
- For each CC member active at targetEpoch, compute fidelity from `cc_votes WHERE epoch <= targetEpoch`
- Fidelity = alignment between CC votes and constitutional principles (same logic as current fidelity computation, but epoch-scoped)
- Need to determine who was on the committee at each epoch. `cc_members` has `status` and may have term info.

**Power Distribution / EDI (13%)**

- Get voting power distribution from `drep_power_snapshots` at targetEpoch
- Compute all 7 EDI metrics (Nakamoto, Gini, Shannon, HHI, Theil, concentration, tau)
- Apply onboarding bonus, concentration penalty, quality penalty (using epoch-scoped data)

**System Stability (8%)**

- **DRep Retention (50%)**: Compare `drep_power_snapshots` count at targetEpoch vs targetEpoch-1
- **Delegation Volatility (30%)**: Mean absolute change in voting power from `drep_power_snapshots` at targetEpoch vs targetEpoch-1
- **Throughput Stability (20%)**: CV of votes-per-epoch over 5-epoch window ending at targetEpoch

**Treasury Health (8%)**

- Compute from `treasury_snapshots` at targetEpoch (available 509-620)
- Balance trend, withdrawal velocity, income stability from epoch-scoped snapshots

**Governance Outcomes (0%)**

- Disabled — no `proposal_outcomes` data exists. Weight redistributed.

### Storage

For each epoch, upsert into:

1. `ghi_snapshots` (epoch_no, score, band, components, computed_at)
2. `decentralization_snapshots` (epoch_no, all 7 EDI metrics + composite)
3. `snapshot_completeness_log` (for tracking)

### CC Fidelity Reconstruction Detail

This is the most complex part. Current `cc_members.fidelity_score` is a single aggregate — we need per-epoch reconstruction.

Check how fidelity is currently computed:

- Look in `inngest/functions/sync-cc-rationales.ts` or `lib/scoring/` for CC fidelity computation
- It likely measures: vote participation rate, constitutional alignment, reasoning quality
- For backfill: scope `cc_votes` to `epoch <= targetEpoch`, compute same metrics

If the computation is too complex to reconstruct historically, acceptable fallback: use current `fidelity_score` for all epochs (CC membership is stable over short periods and this is 9% of total GHI).

---

## Implementation: One-Time Backfill Inngest Function

```typescript
// inngest/functions/backfill-ghi.ts
export const backfillGhi = inngest.createFunction(
  { id: 'backfill-ghi', retries: 1, concurrency: { limit: 1 } },
  { event: 'drepscore/backfill.ghi' },
  async ({ step, event }) => {
    const startEpoch = event.data?.startEpoch ?? 530;
    const endEpoch = event.data?.endEpoch ?? 621;

    for (let epoch = startEpoch; epoch <= endEpoch; epoch++) {
      await step.run(`backfill-epoch-${epoch}`, async () => {
        // Phase A: Compute DRep scores for this epoch
        const drepScores = await computeDRepScoresForEpoch(epoch);
        // Store in drep_score_history

        // Phase B: Compute GHI for this epoch
        const ghi = await computeGHIForEpoch(epoch);
        // Store in ghi_snapshots + decentralization_snapshots
      });
    }
  },
);
```

Register in `app/api/inngest/route.ts`. Trigger manually after deploy.

**Important:** Each epoch step should be independent so Inngest can retry individual epochs if they fail.

---

## Files to Create/Modify

### New files

- `lib/ghi/historical.ts` — `computeGHIForEpoch(epochNo)` function
- `lib/scoring/historical.ts` — `computeDRepScoresForEpoch(epochNo)` helper functions
- `inngest/functions/backfill-ghi.ts` — One-time backfill Inngest function

### Modified files

- `lib/ghi/components.ts` — Add optional `epochNo` parameter to component functions (or create epoch-aware variants)
- `app/api/inngest/route.ts` — Register backfill function

### Existing files to reuse (read but don't modify)

- `lib/scoring/engagementQuality.ts` — Engagement Quality pillar computation
- `lib/scoring/effectiveParticipation.ts` — Effective Participation pillar
- `lib/scoring/reliability.ts` — Reliability pillar (streak, recency, gap, tenure)
- `lib/scoring/governanceIdentity.ts` — Governance Identity pillar
- `lib/scoring/calibration.ts` — All calibration curves (already fixed in PR 1)
- `lib/scoring/drepScore.ts` — `computeDRepScores()` composite function
- `lib/ghi/ediMetrics.ts` — Edinburgh Decentralization Index (7 metrics)
- `lib/ghi/index.ts` — `computeGHI()` orchestrator (reference for epoch-aware variant)

---

## Verification Checklist

1. [ ] PR 1 is merged and deployed
2. [ ] Embeddings table has >3000 rows: `SELECT COUNT(*) FROM embeddings`
3. [ ] `npm run preflight` passes
4. [ ] Deploy backfill function
5. [ ] PUT Inngest endpoint
6. [ ] Trigger backfill: send `drepscore/backfill.ghi` event with `{ startEpoch: 530, endEpoch: 621 }`
7. [ ] Monitor Inngest dashboard for completion
8. [ ] Verify: `SELECT epoch_no, score, band FROM ghi_snapshots ORDER BY epoch_no` shows 90+ rows
9. [ ] Verify: `SELECT epoch_no, COUNT(*) FROM drep_score_history WHERE score_version = 'v3.2-backfill' GROUP BY epoch_no` shows entries for each epoch
10. [ ] Spot-check: compare backfilled epoch 621 vs live-computed — should be very close
11. [ ] Verify trend charts on governada.io show historical data
12. [ ] Smoke test: `npm run smoke-test`

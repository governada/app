# Scoring Calibration Methodology

> **Config source of truth:** `lib/scoring/calibration.ts`
> **Analysis script:** `npx tsx scripts/calibration-analysis.ts`
> **Review cadence:** Every 50 epochs (~3 months)

## Overview

All scoring thresholds, weights, and magic numbers live in `lib/scoring/calibration.ts`. This document explains the rationale behind each value and provides a framework for periodic recalibration.

## DRep Score V3

### Pillar Weights (35/25/25/15)

| Pillar                  | Weight | Rationale                                                                                                                                                                  |
| ----------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engagement Quality      | 35%    | Rationale provision and quality are the strongest signals of governance diligence. A DRep who votes with thoughtful reasoning creates more value than one who just clicks. |
| Effective Participation | 25%    | Showing up matters, but raw vote count without quality is less meaningful. Importance-weighting ensures critical votes count more.                                         |
| Reliability             | 25%    | Consistency builds trust. Delegators need to know their DRep will keep participating over time, not just show up for one epoch.                                            |
| Governance Identity     | 15%    | A complete profile is the baseline expectation. Important but not dominant — a great voter with a sparse profile should still score well.                                  |

### Engagement Quality Layers

| Layer               | Weight | Components                                                                                              |
| ------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| Provision Rate      | 40%    | Did they provide a rationale? Weighted by proposal importance and temporal decay. InfoActions excluded. |
| Rationale Quality   | 40%    | AI-scored quality of rationales. Weighted by importance and decay. Few excellent > many mediocre.       |
| Deliberation Signal | 20%    | Vote diversity (40%), dissent rate (35%), proposal type breadth (25%).                                  |

**Vote Diversity Thresholds:**

- ≤75% dominant ratio → 100 (healthy diversity)
- 75-85% → 75 (slight lean)
- 85-90% → 55 (noticeable lean)
- 90-95% → 35 (near rubber-stamp)
- > 95% → 15 (rubber-stamp penalty)

**Dissent Curve:** Sweet spot at 15-40%. Zero dissent scores 25 (rubber-stamper), >40% decays (contrarian). The sweet spot rewards independent thinking without rewarding pure contrarianism.

### Effective Participation

**Close-margin bonus:** Proposals decided by <20% margin get 1.5x weight. Rationale: participating on contentious proposals has more governance impact.

**Importance weights:**

- Critical (3x): Hard fork, no confidence, new committee, constitution changes
- Important (2x): Parameter changes, significant/major treasury withdrawals
- Standard (1x): Everything else
- Treasury scaling: Additional log-scale multiplier for treasury amounts, capped at 2.4x

### Reliability Sub-components

| Component      | Weight | Formula                                                                      |
| -------------- | ------ | ---------------------------------------------------------------------------- |
| Active Streak  | 30%    | 10 pts/epoch, cap 100. Consecutive epochs with votes.                        |
| Recency        | 25%    | 100 × exp(-epochs_since_last / 5). Drops fast: 2 epochs = 67, 5 epochs = 37. |
| Gap Penalty    | 20%    | 100 - 12 × longest_gap. One 8-epoch gap = score 4.                           |
| Responsiveness | 15%    | 100 × exp(-median_days / 14). Voting within 1 day ≈ 93, 7 days ≈ 61.         |
| Tenure         | 10%    | 20 + 80 × (1 - exp(-tenure/30)). Floor of 20, asymptotic at 100.             |

### Governance Identity

| Component          | Weight |
| ------------------ | ------ |
| Profile Quality    | 60%    |
| Community Presence | 40%    |

Profile quality uses quality-tiered field scoring (name: 15, objectives: up to 20, motivations: up to 15, qualifications: up to 10, bio: up to 10, social links: 25-30, hash verified: 5). Max raw = 105, clamped to 100.

## SPO Score V3

Same 35/25/25/15 structure with SPO-specific pillar implementations:

- **Participation (35%):** Importance-weighted vote coverage with proposal-level margin multipliers
- **Deliberation (25%):** Rationale quality and timing analysis
- **Reliability (25%):** Proposal-aware streak/gap, engagement consistency (CV), tenure
- **Governance Identity (15%):** Profile completeness and community metrics

**SPO Confidence:** Vote count (50%), epoch span (30%), type coverage (20%). Confidence <60 caps tier at Emerging.

## GHI (Governance Health Index)

### Component Weights

| Component                | Weight | Category                     |
| ------------------------ | ------ | ---------------------------- |
| DRep Participation       | 20%    | Engagement                   |
| Citizen Engagement       | 15%    | Engagement (feature-flagged) |
| Deliberation Quality     | 20%    | Quality                      |
| Governance Effectiveness | 20%    | Quality                      |
| Power Distribution       | 15%    | Resilience                   |
| System Stability         | 10%    | Resilience                   |

When Citizen Engagement is disabled, its 15% redistributes proportionally to other components.

### Calibration Curves

Each component uses piecewise linear calibration with 4 breakpoints:

| Component            | Floor | Target Low | Target High | Ceiling |
| -------------------- | ----- | ---------- | ----------- | ------- |
| DRep Participation   | 20    | 40         | 70          | 90      |
| Citizen Engagement   | 10    | 30         | 60          | 80      |
| Deliberation Quality | 15    | 35         | 65          | 85      |
| Gov. Effectiveness   | 20    | 40         | 70          | 90      |
| Power Distribution   | 15    | 35         | 65          | 85      |
| System Stability     | 30    | 50         | 75          | 90      |

**Mapping:**

- Below floor → 0-20 (critical)
- Floor → target low → 20-50 (fair)
- Target low → target high → 50-80 (good)
- Target high → ceiling → 80-95 (strong)
- Above ceiling → capped at 95

### EDI (Edinburgh Decentralization Index)

7 metrics weighted: Nakamoto (20%), Shannon Entropy (20%), Gini (15%), HHI (15%), Theil (10%), Concentration (10%), Tau-Decentralization (10%).

## Temporal Decay

Half-life: 180 days (~6 months). Lambda = ln(2)/180.

A vote from 180 days ago contributes ~50% weight. A vote from 360 days ago contributes ~25%. This balances recency with track record recognition.

## Tier Boundaries

| Tier      | Range  | Design Intent                          |
| --------- | ------ | -------------------------------------- |
| Emerging  | 0-39   | New or inactive. Safe default.         |
| Bronze    | 40-54  | Basic participation established.       |
| Silver    | 55-69  | Consistent, reliable governance.       |
| Gold      | 70-84  | Strong across multiple pillars.        |
| Diamond   | 85-94  | Elite performance.                     |
| Legendary | 95-100 | Exceptional — by definition, very few. |

## Recalibration Process

1. Run `npx tsx scripts/calibration-analysis.ts`
2. Review `scripts/output/calibration-*.json`
3. Check distribution shape: scores should spread across tiers, not bunch at top or bottom
4. Check sensitivity: rank changes >20 positions under alternative weights indicate instability
5. Update thresholds in `lib/scoring/calibration.ts`
6. Run existing QP-3 tests to verify no regression
7. Document changes in this file with date and rationale

## Alignment Drift

Per-dimension weights for drift detection: Treasury dimensions (20% each), Decentralization (20%), Security (15%), Innovation (15%), Transparency (10%).

Classification: ≤15 = low, ≤30 = moderate, >30 = high.

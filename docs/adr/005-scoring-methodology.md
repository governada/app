# ADR-005: DRep Scoring Methodology and Weights

## Status
Accepted (V3 — Rationale-Forward)

## Context
DRepScore needs a single 0-100 score per DRep that measures governance accountability. The score must be objective, transparent, and resistant to gaming.

## Decision
Weighted composite score with four components:
- **Rationale Quality (35%)**: Do they explain their votes? Highest weight because explaining governance decisions is what separates engaged DReps from rubber-stampers.
- **Effective Participation (30%)**: Do they vote? Penalized for rubber-stamping (voting the same on everything without rationale).
- **Reliability (20%)**: Can delegators count on consistent participation? Measures streak, recency, gap penalty, and tenure.
- **Profile Completeness (15%)**: Did they fill out their CIP-119 profile? Lowest weight because it's a one-time action.

Deliberation modifier adjusts effective participation when a DRep provides rationale — rewarding considered voting over blind participation.

## Consequences
- Rationale-heavy weighting incentivizes DReps to explain votes (positive community effect)
- Score is deterministic and reproducible — no AI/ML black box
- Weights are configurable via `DEFAULT_WEIGHTS` in `lib/koios.ts` but changes affect all historical comparisons
- DReps with few votes get naturally low scores (no minimum-vote threshold) — this is intentional
- Percentile rankings computed across all active DReps for relative positioning

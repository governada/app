# PCA / Dimension Reconciliation

> **Decision:** Option C — Hybrid approach
> **Date:** 2026-03-07
> **Status:** Implemented in QP-6

## Current State (Pre-Reconciliation)

Two independent alignment systems exist:

### System 1: PCA Coordinates (`lib/alignment/pca.ts`)

- **Input:** DRep × Proposal vote matrix (Yes/No/Abstain with temporal decay + amount weighting)
- **Process:** SVD decomposition → 6 principal components
- **Output:** Per-DRep coordinates in PCA latent space
- **Used for:** Matching engine (cosine similarity via `lib/representationMatch.ts`)
- **Strengths:** Mathematically principled, discovers real voting patterns empirically
- **Weaknesses:** Components are abstract — "Component 1" may not map cleanly to governance concepts

### System 2: Manual Dimensions (`lib/alignment/dimensions.ts`)

- **Input:** Vote data + AI proposal classifications (6 relevance scores per proposal)
- **Process:** Per-dimension weighted formula (e.g., Treasury Conservative = weighted No-votes on treasury proposals)
- **Output:** Per-DRep scores in 6 named dimensions (0-100)
- **Used for:** Radar display (`GovernanceRadar.tsx`), dimension agreement in matching (`dimensionAgreement.ts`)
- **Strengths:** Clear, intuitive labels. Governance experts can reason about scores.
- **Weaknesses:** Dimensions may be correlated. Not empirically validated against voting patterns.

### The Problem

A DRep's PCA position may contradict their manual dimension scores. The matching engine uses PCA cosine similarity for ranking, but shows manual dimension agreement on profiles. A user could see "90% match" (PCA) alongside disagreement in Treasury dimensions (manual), eroding trust in both systems.

## Reconciliation Options Evaluated

### Option A: PCA-first

Use PCA components as authoritative dimensions. Label based on loading analysis.

- **Pro:** Data-driven, captures real patterns
- **Con:** Labels may not be intuitive; component rotation is arbitrary; hard to explain to users

### Option B: Domain-first

Keep 6 named dimensions. Replace PCA matching with cosine similarity on manual dimension vectors.

- **Pro:** Clear labels, governance experts can reason about scores
- **Con:** Dimensions may be redundant/correlated. Loses PCA's ability to discover latent patterns.

### Option C: Hybrid (CHOSEN)

Use PCA for matching (captures real voting patterns). Project PCA results back into named dimensions using loadings + classifications. Display projections alongside manual scores.

- **Pro:** Best of both worlds — PCA captures real patterns, named dimensions remain intuitive
- **Con:** Slightly more complex. Projection introduces some noise.

## Implementation

### Explained Variance Enforcement

- Minimum threshold: 60% total explained variance
- If 6 PCA components explain less than threshold, log a warning and fall back to manual dimensions
- Threshold stored in `lib/scoring/calibration.ts`

### PCA-to-Dimension Projection (`lib/alignment/pcaProjection.ts`)

For each DRep:

1. Load their PCA coordinates (6 values)
2. Load the PCA loadings matrix (6 components × N proposals)
3. Load the proposal classifications (6 dimension relevance scores per proposal)
4. For each named dimension, compute the correlation between the DRep's PCA projection and the dimension's proposal relevance scores
5. Normalize to 0-100

### Consistency Rules

- **Matching:** Uses PCA cosine similarity (unchanged) — this captures real voting behavior
- **Dimension Agreement:** Uses reconciled scores (PCA-projected when available, manual fallback)
- **Radar Display:** Uses reconciled scores for consistency with matching
- **User Profile:** Projects poll votes into PCA space for matching, derives alignment from classifications for display
- **When PCA is unavailable or low-variance:** Falls back to manual dimension computation (existing behavior)

### Validation

For 20 sample DReps, the dimension scores displayed on their profile radar should be consistent with their match rank for any given user. The reconciled scores won't be identical to manual scores, but they should correlate (r > 0.7).

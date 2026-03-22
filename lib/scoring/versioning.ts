/**
 * Score Methodology Versioning — Shared infrastructure for DRep, SPO, and CC scoring.
 *
 * Provides version constants, types, and changelog access. Both scoring pipelines
 * write `score_version` on every upsert so historical scores are traceable to
 * the methodology that produced them.
 *
 * Changelog data lives in `scoring_methodology_changelog` table (seeded via migration).
 */

// ---------------------------------------------------------------------------
// Current Versions
// ---------------------------------------------------------------------------

/** Current SPO scoring methodology version. */
export const CURRENT_SPO_SCORE_VERSION = '3.2';

/** Current DRep scoring methodology version. */
export const CURRENT_DREP_SCORE_VERSION = '3.1';

/** Current CC scoring methodology version. */
export const CURRENT_CC_SCORE_VERSION = '1.0';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScoredEntityType = 'drep' | 'spo' | 'cc';

export interface MethodologyChange {
  /** What happened: added, removed, replaced, hardened, reweighted */
  type: 'added' | 'removed' | 'replaced' | 'hardened' | 'reweighted';
  /** Which pillar or sub-component changed */
  component: string;
  /** Human-readable description of the change */
  detail: string;
}

export interface ScoreMethodologyVersion {
  version: string;
  entityType: ScoredEntityType;
  releasedAt: string | null;
  summary: string;
  changes: MethodologyChange[];
  pillarWeights: Record<string, number>;
  migrationNotes: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get the current methodology version for an entity type.
 */
export function getCurrentVersion(entityType: ScoredEntityType): string {
  switch (entityType) {
    case 'spo':
      return CURRENT_SPO_SCORE_VERSION;
    case 'drep':
      return CURRENT_DREP_SCORE_VERSION;
    case 'cc':
      return CURRENT_CC_SCORE_VERSION;
  }
}

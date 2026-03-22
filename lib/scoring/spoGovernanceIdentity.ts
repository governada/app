/**
 * SPO Governance Identity pillar (15% of SPO Score V3).
 * Two sub-components: Pool Identity Quality (60%) and Delegation Responsiveness (40%).
 *
 * V3.1 changes:
 * - Governance statement uses keyword quality checklist instead of pure character count
 * - Community Presence replaced by Delegation Responsiveness (delegator retention after votes)
 *
 * V3.2 changes:
 * - Removed delegator count fallback (leaked pool size into governance scoring). Neutral 50 when insufficient retention data.
 * - Governance statement points gated behind vote counts to prevent gaming via metadata-only.
 * - computeCommunityPresence() removed entirely.
 */

import { isValidatedSocialLink } from '@/utils/display';

const SUB_WEIGHTS = { poolIdentityQuality: 0.6, delegationResponsiveness: 0.4 };

/** Keywords that indicate governance-relevant content in a statement. */
const GOVERNANCE_KEYWORDS = [
  'vote',
  'govern',
  'delegate',
  'cardano',
  'treasury',
  'proposal',
  'constitution',
  'drep',
  'stake',
  'community',
  'accountability',
  'transparency',
  'decentraliz',
];

export interface SpoProfileData {
  poolId: string;
  ticker: string | null;
  poolName: string | null;
  governanceStatement: string | null;
  poolDescription: string | null;
  homepageUrl: string | null;
  socialLinks: Array<{ uri: string; label?: string }>;
  metadataHashVerified: boolean;
  delegatorCount: number;
  voteCount: number;
  brokenUris?: Set<string>;
}

export interface DelegationRetentionData {
  poolId: string;
  delegatorsBefore: number;
  delegatorsAfter: number;
}

/**
 * Compute raw Governance Identity scores (0-100) for all SPOs.
 * Uses delegation responsiveness when available, falls back to neutral 50.
 */
export function computeSpoGovernanceIdentity(
  profiles: Map<string, SpoProfileData>,
  retentionData?: Map<string, DelegationRetentionData>,
): Map<string, number> {
  const scores = new Map<string, number>();

  for (const [poolId, profile] of profiles) {
    const identityScore = computePoolIdentityQuality(profile);
    const responsiveness = retentionData?.get(poolId);

    let communityScore: number;
    if (responsiveness && responsiveness.delegatorsBefore >= 5) {
      // Delegation responsiveness: retention rate after governance activity
      communityScore = computeDelegationResponsiveness(responsiveness);
    } else {
      // V3.2: neutral score when insufficient retention data (no pool-size leak)
      communityScore = 50;
    }

    const raw =
      identityScore * SUB_WEIGHTS.poolIdentityQuality +
      communityScore * SUB_WEIGHTS.delegationResponsiveness;

    scores.set(poolId, clamp(Math.round(raw)));
  }

  return scores;
}

/**
 * Pool Identity Quality (60% of pillar).
 * V3: governance statement uses keyword quality checklist:
 * - Present (5pts) + >100 chars (5pts) + governance keywords (5pts) + unique from description (5pts)
 * Other fields unchanged from V2.
 *
 * Max raw: ticker(10) + poolName(10) + govStatement(20) + description(15) + homepage(10) + social(30) + hash(5) = 100
 */
function computePoolIdentityQuality(profile: SpoProfileData): number {
  let score = 0;

  if (profile.ticker && profile.ticker.length > 0) score += 10;
  if (profile.poolName && profile.poolName.length > 2) score += 10;

  // Governance statement: keyword quality checklist with vote gates (max 20)
  score += scoreGovernanceStatement(
    profile.governanceStatement,
    profile.poolDescription,
    profile.voteCount,
  );

  // Pool description: tiered by length (max 15)
  score += tierScore(profile.poolDescription, [
    { minLen: 200, pts: 15 },
    { minLen: 50, pts: 10 },
    { minLen: 1, pts: 3 },
  ]);

  // Homepage URL (10 pts)
  if (profile.homepageUrl) {
    try {
      const url = new URL(profile.homepageUrl);
      if (url.protocol === 'https:' || url.protocol === 'http:') {
        if (!profile.brokenUris?.has(profile.homepageUrl)) {
          score += 10;
        }
      }
    } catch {
      // invalid URL
    }
  }

  // Social links (max 30)
  if (Array.isArray(profile.socialLinks)) {
    let validCount = 0;
    const seenUris = new Set<string>();
    for (const link of profile.socialLinks) {
      if (!link?.uri || seenUris.has(link.uri)) continue;
      seenUris.add(link.uri);
      if (isValidatedSocialLink(link.uri, link.label)) {
        if (profile.brokenUris?.has(link.uri)) continue;
        validCount++;
      }
    }
    if (validCount >= 2) score += 30;
    else if (validCount >= 1) score += 25;
  }

  if (profile.metadataHashVerified) score += 5;

  return Math.min(100, score);
}

/**
 * Governance statement quality checklist (max 20 points).
 * V3.2: most tiers gated behind vote counts to prevent gaming via metadata-only.
 *
 * - Present AND >= 1 vote: 5 pts
 * - >100 chars AND >= 3 votes: 5 pts
 * - >= 3 governance keywords AND unique from description AND >= 5 votes: 5 pts
 * - Content distinct from pool description (Jaccard < 0.5): 5 pts (no vote gate)
 */
function scoreGovernanceStatement(
  statement: string | null | undefined,
  description: string | null | undefined,
  voteCount: number,
): number {
  if (!statement?.trim()) return 0;
  const trimmed = statement.trim();
  let pts = 0;

  // Present AND at least 1 vote: 5 pts
  if (voteCount >= 1) pts += 5;

  // >100 chars AND at least 3 votes: 5 pts
  if (trimmed.length > 100 && voteCount >= 3) pts += 5;

  // Keyword + uniqueness combo AND at least 5 votes: 5 pts
  const lower = trimmed.toLowerCase();
  const matchedKeywords = GOVERNANCE_KEYWORDS.filter((kw) => lower.includes(kw));
  if (matchedKeywords.length >= 3 && voteCount >= 5) {
    // Also require uniqueness from description for this tier
    if (description?.trim()) {
      const stmtWords = new Set(lower.split(/\s+/).filter((w) => w.length > 3));
      const descWords = new Set(
        description
          .trim()
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3),
      );
      const intersection = [...stmtWords].filter((w) => descWords.has(w)).length;
      const union = new Set([...stmtWords, ...descWords]).size;
      const jaccard = union > 0 ? intersection / union : 0;
      if (jaccard < 0.5) pts += 5;
    } else {
      pts += 5; // no description to compare against, give credit
    }
  }

  // Uniqueness check (no vote gate): Jaccard distance from description
  if (description?.trim()) {
    const stmtWords = new Set(lower.split(/\s+/).filter((w) => w.length > 3));
    const descWords = new Set(
      description
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3),
    );
    const intersection = [...stmtWords].filter((w) => descWords.has(w)).length;
    const union = new Set([...stmtWords, ...descWords]).size;
    const jaccard = union > 0 ? intersection / union : 0;
    if (jaccard < 0.5) pts += 5; // sufficiently unique
  } else {
    pts += 5; // no description to compare against, give full credit
  }

  return pts;
}

/**
 * Delegation Responsiveness (40% of pillar).
 * Measures delegator retention in epochs following governance votes.
 * retentionRate = delegatorsAfter / delegatorsBefore, clamped to 0-100.
 */
function computeDelegationResponsiveness(data: DelegationRetentionData): number {
  if (data.delegatorsBefore === 0) return 50;
  const rate = data.delegatorsAfter / data.delegatorsBefore;
  // Score: 100% retention = 100, 90% = 90, etc.
  // Allow growth beyond 100% (capped at 100 score)
  return clamp(Math.round(rate * 100));
}

interface Tier {
  minLen: number;
  pts: number;
}

function tierScore(text: string | null | undefined, tiers: Tier[]): number {
  if (!text) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  for (const tier of tiers) {
    if (trimmed.length >= tier.minLen) return tier.pts;
  }
  return 0;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

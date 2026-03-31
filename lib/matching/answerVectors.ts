import type { AlignmentScores } from '@/lib/drepIdentity';

/**
 * Answer-to-alignment vector mappings for the Quick Match quiz.
 * Shared between the API route (server) and client components
 * (progress bar identity color, loading screen preview).
 */
export const ANSWER_VECTORS: Record<string, Record<string, Partial<AlignmentScores>>> = {
  treasury: {
    conservative: { treasuryConservative: 85, treasuryGrowth: 20 },
    growth: { treasuryConservative: 20, treasuryGrowth: 85 },
    balanced: { treasuryConservative: 55, treasuryGrowth: 55 },
  },
  protocol: {
    caution: { security: 85, innovation: 25 },
    innovation: { security: 25, innovation: 85 },
    case_by_case: { security: 55, innovation: 55 },
  },
  transparency: {
    essential: { transparency: 90, decentralization: 70 },
    nice_to_have: { transparency: 55, decentralization: 50 },
    doesnt_matter: { transparency: 20, decentralization: 35 },
  },
  decentralization: {
    spread_widely: {
      decentralization: 85,
    },
    concentrated: {
      decentralization: 20,
    },
    current_fine: {
      decentralization: 50,
    },
  },
  governance_risk: {
    voter_apathy: { transparency: 80, decentralization: 75 },
    plutocracy: { decentralization: 90, treasuryConservative: 65 },
    too_slow: { innovation: 85, security: 30 },
    lack_accountability: { transparency: 90, treasuryConservative: 70 },
  },
  drep_engagement: {
    regular_updates: { transparency: 90, decentralization: 70 },
    major_decisions_only: { transparency: 50, innovation: 60 },
    trust_and_verify: { transparency: 30, security: 65, decentralization: 55 },
  },
  spending_priority: {
    dev_tooling: { innovation: 85, treasuryGrowth: 70, security: 60 },
    community_education: { decentralization: 80, transparency: 70, treasuryGrowth: 55 },
    defi_growth: { innovation: 80, treasuryGrowth: 85 },
    constitutional_dev: { security: 80, transparency: 75, treasuryConservative: 60 },
  },
};

/**
 * Build a full AlignmentScores object from quiz answers.
 * Dimensions not covered by answers default to 50 (neutral).
 */
export function buildAlignmentFromAnswers(answers: Record<string, string>): AlignmentScores {
  const scores: AlignmentScores = {
    treasuryConservative: 50,
    treasuryGrowth: 50,
    decentralization: 50,
    security: 50,
    innovation: 50,
    transparency: 50,
  };

  for (const [qId, answer] of Object.entries(answers)) {
    const dimScores = ANSWER_VECTORS[qId]?.[answer];
    if (dimScores) {
      for (const [dim, val] of Object.entries(dimScores)) {
        scores[dim as keyof AlignmentScores] = val;
      }
    }
  }

  return scores;
}

/**
 * Pill Generator — static governance-relevant questions with pill options
 * that map to alignment dimensions.
 *
 * 4 questions covering the 6 alignment dimensions:
 * 1. Treasury philosophy (treasuryConservative, treasuryGrowth)
 * 2. Technical priorities (security, innovation)
 * 3. Governance values (transparency, decentralization)
 * 4. Trade-off question (forces a stance across dimensions)
 */

import type { AlignmentScores } from '@/lib/drepIdentity';

export interface PillOption {
  id: string;
  text: string;
  alignmentHint: Partial<AlignmentScores>;
}

export interface QuestionSet {
  question: string;
  pills: PillOption[];
  targetDimensions: string[];
}

const QUESTIONS: QuestionSet[] = [
  // Round 1: Treasury philosophy
  {
    question: 'How should Cardano use its treasury?',
    targetDimensions: ['treasuryConservative', 'treasuryGrowth'],
    pills: [
      {
        id: 'treasury-preserve',
        text: 'Preserve it — only fund proven, essential projects',
        alignmentHint: { treasuryConservative: 85, treasuryGrowth: 20 },
      },
      {
        id: 'treasury-invest',
        text: 'Invest boldly — fund experiments that could 10x the ecosystem',
        alignmentHint: { treasuryConservative: 20, treasuryGrowth: 85 },
      },
      {
        id: 'treasury-balanced',
        text: 'Mix of both — steady funding with room for big bets',
        alignmentHint: { treasuryConservative: 55, treasuryGrowth: 60 },
      },
      {
        id: 'treasury-community',
        text: 'Let the community decide case by case',
        alignmentHint: { treasuryConservative: 50, treasuryGrowth: 50 },
      },
    ],
  },
  // Round 2: Technical priorities
  {
    question: 'What matters more for Cardano right now?',
    targetDimensions: ['security', 'innovation'],
    pills: [
      {
        id: 'tech-security',
        text: 'Rock-solid security — never rush changes to the protocol',
        alignmentHint: { security: 85, innovation: 25 },
      },
      {
        id: 'tech-innovation',
        text: 'Ship faster — we need features to compete with other chains',
        alignmentHint: { security: 25, innovation: 85 },
      },
      {
        id: 'tech-pragmatic',
        text: 'Move fast where safe, go slow on core protocol changes',
        alignmentHint: { security: 65, innovation: 60 },
      },
      {
        id: 'tech-research',
        text: 'Invest in research — long-term breakthroughs over quick wins',
        alignmentHint: { security: 70, innovation: 70 },
      },
    ],
  },
  // Round 3: Governance values
  {
    question: 'What kind of governance does Cardano need?',
    targetDimensions: ['transparency', 'decentralization'],
    pills: [
      {
        id: 'gov-transparent',
        text: 'Full transparency — every decision, vote, and rationale public',
        alignmentHint: { transparency: 90, decentralization: 70 },
      },
      {
        id: 'gov-decentralized',
        text: 'Maximum decentralization — no single entity should have outsized power',
        alignmentHint: { transparency: 65, decentralization: 90 },
      },
      {
        id: 'gov-efficient',
        text: 'Efficient governance — sometimes smaller groups decide faster',
        alignmentHint: { transparency: 40, decentralization: 25 },
      },
      {
        id: 'gov-evolving',
        text: 'Governance should evolve — start simple, decentralize over time',
        alignmentHint: { transparency: 60, decentralization: 55 },
      },
    ],
  },
  // Round 4: Trade-off — forces cross-dimensional stance
  {
    question: 'If you had to pick one priority for the next year, what would it be?',
    targetDimensions: [
      'treasuryConservative',
      'treasuryGrowth',
      'decentralization',
      'security',
      'innovation',
      'transparency',
    ],
    pills: [
      {
        id: 'tradeoff-growth',
        text: 'Fund 100 new projects — grow the ecosystem at all costs',
        alignmentHint: { treasuryGrowth: 90, innovation: 80, treasuryConservative: 15 },
      },
      {
        id: 'tradeoff-trust',
        text: 'Build trust — make governance so transparent that no one questions it',
        alignmentHint: { transparency: 90, decentralization: 75, security: 70 },
      },
      {
        id: 'tradeoff-resilience',
        text: 'Harden the protocol — security and stability above all else',
        alignmentHint: { security: 90, treasuryConservative: 75, innovation: 20 },
      },
      {
        id: 'tradeoff-power',
        text: 'Redistribute power — break up concentration wherever it exists',
        alignmentHint: { decentralization: 90, transparency: 70, treasuryConservative: 60 },
      },
    ],
  },
];

/**
 * Follow-up questions for "Continue refining" — different scenarios testing the same dimensions.
 * Used on pass 2+ so users never see the same questions twice.
 */
const FOLLOWUP_QUESTIONS: QuestionSet[] = [
  // Follow-up: Treasury scenario
  {
    question: 'A proposal requests 5M ADA for a risky but promising DeFi project. Your call?',
    targetDimensions: ['treasuryConservative', 'treasuryGrowth'],
    pills: [
      {
        id: 'fu-treasury-reject',
        text: 'Too risky — protect the treasury from speculative bets',
        alignmentHint: { treasuryConservative: 90, treasuryGrowth: 15 },
      },
      {
        id: 'fu-treasury-fund',
        text: 'Fund it — this is exactly the kind of moonshot we need',
        alignmentHint: { treasuryConservative: 15, treasuryGrowth: 90 },
      },
      {
        id: 'fu-treasury-partial',
        text: 'Partial funding with milestones — reduce risk, keep upside',
        alignmentHint: { treasuryConservative: 65, treasuryGrowth: 55 },
      },
      {
        id: 'fu-treasury-defer',
        text: 'Let DReps debate it — I trust the governance process',
        alignmentHint: { treasuryConservative: 50, treasuryGrowth: 50, transparency: 65 },
      },
    ],
  },
  // Follow-up: Technical scenario
  {
    question:
      "A hard fork is proposed to add smart contract features. It hasn't been fully audited.",
    targetDimensions: ['security', 'innovation'],
    pills: [
      {
        id: 'fu-tech-wait',
        text: 'Wait for the audit — never compromise chain safety',
        alignmentHint: { security: 90, innovation: 20 },
      },
      {
        id: 'fu-tech-proceed',
        text: 'Ship it — the features are needed now, audit can follow',
        alignmentHint: { security: 20, innovation: 90 },
      },
      {
        id: 'fu-tech-testnet',
        text: 'Deploy to testnet first — real-world testing reveals more than audits',
        alignmentHint: { security: 70, innovation: 65 },
      },
      {
        id: 'fu-tech-community',
        text: 'Let the SPOs decide — they run the infrastructure',
        alignmentHint: { security: 60, innovation: 50, decentralization: 75 },
      },
    ],
  },
  // Follow-up: Governance scenario
  {
    question:
      'A well-known whale is buying votes to pass self-serving proposals. What should happen?',
    targetDimensions: ['transparency', 'decentralization'],
    pills: [
      {
        id: 'fu-gov-expose',
        text: 'Expose it publicly — sunlight is the best disinfectant',
        alignmentHint: { transparency: 90, decentralization: 65 },
      },
      {
        id: 'fu-gov-limit',
        text: 'Cap voting power — no single entity should dominate',
        alignmentHint: { decentralization: 90, transparency: 60 },
      },
      {
        id: 'fu-gov-allow',
        text: "It's their ADA — governance should tolerate all strategies",
        alignmentHint: { transparency: 30, decentralization: 30 },
      },
      {
        id: 'fu-gov-protocol',
        text: 'Fix it in the protocol — build incentives that prevent capture',
        alignmentHint: { security: 70, decentralization: 75, innovation: 60 },
      },
    ],
  },
  // Follow-up: Trade-off scenario
  {
    question: "Cardano is falling behind competitors. What's the best response?",
    targetDimensions: [
      'treasuryConservative',
      'treasuryGrowth',
      'decentralization',
      'security',
      'innovation',
      'transparency',
    ],
    pills: [
      {
        id: 'fu-tradeoff-spend',
        text: 'Spend aggressively — outpace them with funded innovation',
        alignmentHint: { treasuryGrowth: 90, innovation: 85, treasuryConservative: 10 },
      },
      {
        id: 'fu-tradeoff-differentiate',
        text: 'Double down on what makes us different — governance and security',
        alignmentHint: { security: 85, transparency: 80, decentralization: 75 },
      },
      {
        id: 'fu-tradeoff-patience',
        text: 'Stay the course — fundamentals matter more than hype',
        alignmentHint: { treasuryConservative: 80, security: 75, innovation: 30 },
      },
      {
        id: 'fu-tradeoff-community',
        text: 'Empower the community — grassroots growth beats top-down',
        alignmentHint: { decentralization: 85, transparency: 70, treasuryGrowth: 55 },
      },
    ],
  },
];

/**
 * Map topic slugs (from the topic pill cloud) to alignment dimensions.
 * Used to reorder questions so the first question matches the user's interest.
 */
const TOPIC_TO_DIMENSIONS: Record<string, string[]> = {
  treasury: ['treasuryConservative', 'treasuryGrowth'],
  'developer-funding': ['treasuryConservative', 'treasuryGrowth'],
  innovation: ['security', 'innovation'],
  security: ['security', 'innovation'],
  transparency: ['transparency', 'decentralization'],
  decentralization: ['transparency', 'decentralization'],
  'community-growth': ['transparency', 'decentralization'],
  constitutional: ['transparency', 'decentralization'],
};

/**
 * Build a question order based on topic hints.
 * Moves the question whose targetDimensions best match the selected topics to the front.
 * Trade-off question (index 3) always stays last.
 */
function buildQuestionOrder(
  topicHints?: string[],
  questionBank: QuestionSet[] = QUESTIONS,
): QuestionSet[] {
  if (!topicHints || topicHints.length === 0) return questionBank;

  // Collect relevant dimensions from topic hints
  const relevantDims = new Set<string>();
  for (const topic of topicHints) {
    const slug = topic.replace(/^topic-/, '');
    const dims = TOPIC_TO_DIMENSIONS[slug];
    if (dims) dims.forEach((d) => relevantDims.add(d));
  }

  if (relevantDims.size === 0) return questionBank;

  // Separate trade-off question (always last) from orderable questions
  const tradeoff = questionBank[questionBank.length - 1];
  const orderable = questionBank.slice(0, -1);

  // Score each orderable question by overlap with relevant dimensions
  const scored = orderable.map((q) => {
    const overlap = q.targetDimensions.filter((d) => relevantDims.has(d)).length;
    return { q, overlap };
  });

  // Sort: highest overlap first, preserve original order for ties
  scored.sort((a, b) => b.overlap - a.overlap);

  return [...scored.map((s) => s.q), tradeoff];
}

/**
 * Get the question set for a given round number (0-indexed).
 * When topicHints are provided, reorders questions so the first question
 * matches the user's selected topic pill(s).
 * When pass > 0 (continue refining), uses follow-up questions instead.
 */
export function getQuestionForRound(
  roundNumber: number,
  _previousAnswers?: unknown[],
  topicHints?: string[],
  pass: number = 0,
): QuestionSet | null {
  const questionBank = pass > 0 ? FOLLOWUP_QUESTIONS : QUESTIONS;
  const ordered = buildQuestionOrder(topicHints, questionBank);
  if (roundNumber < 0 || roundNumber >= ordered.length) return null;
  return ordered[roundNumber];
}

/** Total number of available questions. */
export const TOTAL_QUESTIONS = QUESTIONS.length;

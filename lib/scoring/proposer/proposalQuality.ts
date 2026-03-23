/**
 * AI-Assessed Proposal Quality Scoring
 *
 * Uses Claude to evaluate governance proposal text quality across multiple
 * dimensions (specificity, feasibility, scope clarity, constitutional awareness).
 * Falls back gracefully when AI is unavailable.
 *
 * Also provides budget quality scoring for treasury withdrawal proposals.
 */

import { generateJSON } from '@/lib/ai';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProposalQualityInput {
  proposalType: string;
  title: string;
  abstract: string | null;
  motivation: string | null;
  body: string | null;
}

interface PrimaryRubricResult {
  score: number;
  specificity: number;
  feasibility: number;
  scope_clarity: number;
  constitutional_awareness: number;
}

interface SecondaryRubricResult {
  score: number;
  problem_definition: number;
  stakeholder_impact: number;
  value_proposition: number;
  completeness: number;
}

export interface ProposalQualityResult {
  score: number;
  dimensions: {
    specificity: number;
    feasibility: number;
    scopeClarity: number;
    constitutionalAwareness: number;
    problemDefinition: number;
    stakeholderImpact: number;
    valueProposition: number;
    completeness: number;
  };
}

export interface BudgetQualityResult {
  budgetQuality: number;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isValidScore(n: unknown): n is number {
  return typeof n === 'number' && n >= 0 && n <= 100 && Number.isFinite(n);
}

function validatePrimaryResult(data: unknown): PrimaryRubricResult | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (
    !isValidScore(d.score) ||
    !isValidScore(d.specificity) ||
    !isValidScore(d.feasibility) ||
    !isValidScore(d.scope_clarity) ||
    !isValidScore(d.constitutional_awareness)
  ) {
    return null;
  }
  return d as unknown as PrimaryRubricResult;
}

function validateSecondaryResult(data: unknown): SecondaryRubricResult | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (
    !isValidScore(d.score) ||
    !isValidScore(d.problem_definition) ||
    !isValidScore(d.stakeholder_impact) ||
    !isValidScore(d.value_proposition) ||
    !isValidScore(d.completeness)
  ) {
    return null;
  }
  return d as unknown as SecondaryRubricResult;
}

function validateBudgetResult(data: unknown): BudgetQualityResult | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (!isValidScore(d.budget_quality)) return null;
  return { budgetQuality: d.budget_quality as number };
}

// ---------------------------------------------------------------------------
// Input preparation
// ---------------------------------------------------------------------------

function hasMinimumContent(input: ProposalQualityInput): boolean {
  const textLength =
    (input.abstract?.length ?? 0) + (input.body?.length ?? 0) + (input.motivation?.length ?? 0);
  return textLength > 30;
}

function truncate(text: string | null | undefined, maxLen: number): string {
  if (!text) return '(not provided)';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

function buildPrimaryPrompt(input: ProposalQualityInput): string {
  return `Score this Cardano governance proposal (0-100 each dimension):

Proposal Type: ${input.proposalType}
Title: ${input.title}
Abstract: ${truncate(input.abstract, 1000)}
Motivation: ${truncate(input.motivation, 1000)}
Body: ${truncate(input.body, 2000)}

Dimensions:
- specificity: Does it reference concrete details, metrics, timelines, or stakeholders? (vs vague promises)
- feasibility: Does it explain HOW the goal will be achieved, not just WHAT? (vs wishful thinking)
- scope_clarity: Are deliverables measurable? Is the scope well-bounded? (vs open-ended)
- constitutional_awareness: Does it acknowledge relevant governance principles or precedent?

Return ONLY valid JSON, no markdown: { "score": 0-100, "specificity": 0-100, "feasibility": 0-100, "scope_clarity": 0-100, "constitutional_awareness": 0-100 }`;
}

function buildSecondaryPrompt(input: ProposalQualityInput): string {
  return `Evaluate this Cardano governance proposal's quality (0-100 each):

Proposal Type: ${input.proposalType}
Title: ${input.title}
Abstract: ${truncate(input.abstract, 1000)}
Motivation: ${truncate(input.motivation, 1000)}
Body: ${truncate(input.body, 2000)}

Dimensions:
- problem_definition: Does it clearly articulate the problem before proposing a solution?
- stakeholder_impact: Does it consider who is affected and how?
- value_proposition: Is the benefit to the Cardano ecosystem clear and justified?
- completeness: Are there obvious gaps in the proposal (missing budget, timeline, success criteria)?

Return ONLY valid JSON, no markdown: { "score": 0-100, "problem_definition": 0-100, "stakeholder_impact": 0-100, "value_proposition": 0-100, "completeness": 0-100 }`;
}

function buildBudgetPrompt(input: {
  title: string;
  abstract: string | null;
  body: string | null;
  withdrawalAmount: number;
}): string {
  return `This Cardano governance proposal requests ${input.withdrawalAmount.toLocaleString()} ADA from the treasury.

Title: ${input.title}
Abstract: ${truncate(input.abstract, 1000)}
Body excerpt: ${truncate(input.body, 1500)}

Score the budget justification (0-100):
- Is the requested amount justified by the scope described?
- Is there a budget breakdown or spending plan?
- Are milestones or deliverables tied to fund releases?
- Is the amount proportionate to similar governance proposals?

Return ONLY valid JSON, no markdown: { "budget_quality": 0-100 }`;
}

// ---------------------------------------------------------------------------
// Ensemble scoring
// ---------------------------------------------------------------------------

/** Maximum divergence between primary and secondary rubric scores. */
const DIVERGENCE_THRESHOLD = 15;

/**
 * Score a proposal's text quality using a dual-rubric AI ensemble.
 *
 * Runs two evaluations in parallel (primary: specificity/feasibility rubric,
 * secondary: problem definition/stakeholder rubric). If both succeed and agree
 * within the divergence threshold, the final score is their average.
 *
 * Returns null if AI is unavailable or the proposal has insufficient text.
 */
export async function scoreProposalQuality(
  input: ProposalQualityInput,
): Promise<ProposalQualityResult | null> {
  if (!hasMinimumContent(input)) {
    logger.debug('[ProposalQuality] Insufficient text for AI scoring', {
      title: input.title,
    });
    return null;
  }

  const aiOptions = { maxTokens: 256, temperature: 0.2 };

  // Run both rubrics in parallel
  const [primaryRaw, secondaryRaw] = await Promise.all([
    generateJSON<unknown>(buildPrimaryPrompt(input), aiOptions),
    generateJSON<unknown>(buildSecondaryPrompt(input), aiOptions),
  ]);

  const primary = validatePrimaryResult(primaryRaw);
  const secondary = validateSecondaryResult(secondaryRaw);

  // Both must succeed for ensemble result
  if (!primary && !secondary) {
    logger.warn('[ProposalQuality] Both AI rubrics failed', { title: input.title });
    return null;
  }

  // If only one succeeded, use it alone (degraded but better than nothing)
  if (!primary && secondary) {
    return {
      score: Math.round(secondary.score),
      dimensions: {
        specificity: 0,
        feasibility: 0,
        scopeClarity: 0,
        constitutionalAwareness: 0,
        problemDefinition: secondary.problem_definition,
        stakeholderImpact: secondary.stakeholder_impact,
        valueProposition: secondary.value_proposition,
        completeness: secondary.completeness,
      },
    };
  }

  if (primary && !secondary) {
    return {
      score: Math.round(primary.score),
      dimensions: {
        specificity: primary.specificity,
        feasibility: primary.feasibility,
        scopeClarity: primary.scope_clarity,
        constitutionalAwareness: primary.constitutional_awareness,
        problemDefinition: 0,
        stakeholderImpact: 0,
        valueProposition: 0,
        completeness: 0,
      },
    };
  }

  // Both succeeded — check divergence
  const divergence = Math.abs(primary!.score - secondary!.score);
  if (divergence > DIVERGENCE_THRESHOLD) {
    logger.warn('[ProposalQuality] Rubric divergence exceeded threshold', {
      title: input.title,
      primary: primary!.score,
      secondary: secondary!.score,
      divergence,
    });
    // Use the more conservative (lower) score when rubrics disagree significantly
    const conservativeScore = Math.min(primary!.score, secondary!.score);
    return {
      score: Math.round(conservativeScore),
      dimensions: {
        specificity: primary!.specificity,
        feasibility: primary!.feasibility,
        scopeClarity: primary!.scope_clarity,
        constitutionalAwareness: primary!.constitutional_awareness,
        problemDefinition: secondary!.problem_definition,
        stakeholderImpact: secondary!.stakeholder_impact,
        valueProposition: secondary!.value_proposition,
        completeness: secondary!.completeness,
      },
    };
  }

  // Ensemble average
  const ensembleScore = Math.round((primary!.score + secondary!.score) / 2);

  return {
    score: ensembleScore,
    dimensions: {
      specificity: primary!.specificity,
      feasibility: primary!.feasibility,
      scopeClarity: primary!.scope_clarity,
      constitutionalAwareness: primary!.constitutional_awareness,
      problemDefinition: secondary!.problem_definition,
      stakeholderImpact: secondary!.stakeholder_impact,
      valueProposition: secondary!.value_proposition,
      completeness: secondary!.completeness,
    },
  };
}

// ---------------------------------------------------------------------------
// Budget quality scoring (treasury proposals only)
// ---------------------------------------------------------------------------

/**
 * Score the budget justification quality for a treasury withdrawal proposal.
 * Single-model call (lighter signal, no ensemble needed).
 *
 * Returns null for non-treasury proposals or if AI is unavailable.
 */
export async function scoreBudgetQuality(proposal: {
  title: string;
  abstract: string | null;
  body: string | null;
  withdrawalAmount: number | null;
  proposalType: string;
}): Promise<number | null> {
  if (proposal.proposalType !== 'TreasuryWithdrawals') return null;
  if (!proposal.withdrawalAmount || proposal.withdrawalAmount <= 0) return null;

  const textLength = (proposal.abstract?.length ?? 0) + (proposal.body?.length ?? 0);
  if (textLength < 30) return null;

  const raw = await generateJSON<unknown>(
    buildBudgetPrompt({
      title: proposal.title,
      abstract: proposal.abstract,
      body: proposal.body,
      withdrawalAmount: proposal.withdrawalAmount,
    }),
    { maxTokens: 128, temperature: 0.2 },
  );

  const result = validateBudgetResult(raw);
  if (!result) {
    logger.warn('[ProposalQuality] Budget quality AI scoring failed', {
      title: proposal.title,
    });
    return null;
  }

  return Math.round(result.budgetQuality);
}

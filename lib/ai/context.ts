/**
 * Personal context assembler for AI interactions.
 *
 * Fetches a user's governance philosophy, voting history, and alignment data
 * to inject into AI skill prompts. This ensures AI outputs are personalized
 * to the individual's perspective rather than producing generic analysis.
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import {
  fetchDrepPersonalContextSeed,
  fetchGovernanceAlignmentProfile,
} from '@/lib/governance/drepContext';
import { logger } from '@/lib/logger';

export interface PersonalContext {
  role: 'drep' | 'spo' | 'citizen';
  /** Governance philosophy / objectives (DRep/SPO) */
  philosophy: string | null;
  /** Recent voting positions (last 10) */
  recentVotes: Array<{
    proposalTitle: string;
    vote: string;
    rationaleSnippet: string | null;
  }>;
  /** Personality/alignment label from PCA */
  personalityLabel: string | null;
  /** Alignment scores (6D) */
  alignmentScores: Record<string, number> | null;
}

/**
 * Assemble personal context for an AI call.
 * Returns a structured context string that gets injected into skill system prompts.
 */
export async function assemblePersonalContext(
  stakeAddress: string,
  role: 'drep' | 'spo' | 'citizen',
): Promise<PersonalContext> {
  const supabase = getSupabaseAdmin();
  const context: PersonalContext = {
    role,
    philosophy: null,
    recentVotes: [],
    personalityLabel: null,
    alignmentScores: null,
  };

  try {
    // Fetch DRep metadata (objectives, motivations, philosophy)
    if (role === 'drep') {
      const drepSeed = await fetchDrepPersonalContextSeed(supabase, stakeAddress);
      context.philosophy = drepSeed.philosophy;
      context.recentVotes = drepSeed.recentVotes;
    }

    // Fetch alignment profile
    const profile = await fetchGovernanceAlignmentProfile(supabase, stakeAddress);

    if (profile) {
      context.personalityLabel = profile.personalityLabel;
      context.alignmentScores = profile.alignmentScores;
    }
  } catch (err) {
    logger.error('[AI Context] Failed to assemble personal context', { error: err });
  }

  return context;
}

/**
 * Format personal context into a string for injection into AI prompts.
 */
export function formatPersonalContext(ctx: PersonalContext): string {
  const lines: string[] = [];

  lines.push(`Role: ${ctx.role.toUpperCase()}`);

  if (ctx.philosophy) {
    lines.push(`\nGovernance Philosophy:\n${ctx.philosophy}`);
  }

  if (ctx.personalityLabel) {
    lines.push(`\nGovernance Personality: ${ctx.personalityLabel}`);
  }

  if (ctx.alignmentScores) {
    const scores = Object.entries(ctx.alignmentScores)
      .map(([dim, score]) => `  ${dim}: ${score}/100`)
      .join('\n');
    lines.push(`\nAlignment Scores:\n${scores}`);
  }

  if (ctx.recentVotes.length > 0) {
    const votes = ctx.recentVotes.map((v) => `  - ${v.vote} on "${v.proposalTitle}"`).join('\n');
    lines.push(`\nRecent Votes (last ${ctx.recentVotes.length}):\n${votes}`);
  }

  return lines.join('\n');
}

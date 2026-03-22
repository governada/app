/**
 * Spotlight Narrative Generation
 *
 * Generates 2-3 sentence personality narratives for DReps and SPOs.
 * Uses Claude for AI narratives, with a template fallback for zero-cost operation.
 */

import { generateText } from '@/lib/ai';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a governance analyst writing brief personality narratives for Cardano governance participants.

Rules:
- Write exactly 2-3 sentences.
- Be specific about their governance behavior (participation, voting patterns, strengths).
- Use warm but factual tone. No marketing language, no superlatives, no emojis.
- Write in third person ("Votes on..." not "They vote on...").
- Reference concrete data: participation rate, vote count, alignment strengths.
- If participation is low, be honest but encouraging.
- Never fabricate data — only reference what's provided in the context.`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface DRepNarrativeContext {
  name: string;
  score: number;
  tier: string;
  archetype: string;
  participationRate: number;
  totalVotes: number;
  delegatorCount: number;
  strengths: string[];
  alignmentSummary: string;
  momentum: number;
}

interface SPONarrativeContext {
  name: string;
  score: number;
  tier: string;
  participationPct: number;
  voteCount: number;
  delegatorCount: number;
  liveStakeAda: number;
  strengths: string[];
  governanceStatement: string | null;
}

// ─── Generator ────────────────────────────────────────────────────────────────

export async function generateDRepNarrative(ctx: DRepNarrativeContext): Promise<string | null> {
  const prompt = `Write a 2-3 sentence governance personality narrative for this DRep:

Name: ${ctx.name}
Governance Score: ${ctx.score}/100 (${ctx.tier})
Archetype: ${ctx.archetype}
Participation: ${Math.round(ctx.participationRate)}% of proposals voted on
Total Votes: ${ctx.totalVotes}
Delegators: ${ctx.delegatorCount}
Strengths: ${ctx.strengths.join(', ') || 'None yet'}
Alignment: ${ctx.alignmentSummary}
Score Momentum: ${ctx.momentum > 0 ? 'trending up' : ctx.momentum < 0 ? 'trending down' : 'stable'}

Focus on what makes this DRep distinctive as a governance participant.`;

  return generateText(prompt, {
    model: 'FAST',
    maxTokens: 200,
    temperature: 0.4,
    system: SYSTEM_PROMPT,
  });
}

export async function generateSPONarrative(ctx: SPONarrativeContext): Promise<string | null> {
  const prompt = `Write a 2-3 sentence governance personality narrative for this Stake Pool Operator:

Pool: ${ctx.name}
Governance Score: ${ctx.score}/100 (${ctx.tier})
Participation: ${Math.round(ctx.participationPct)}% of proposals voted on
Total Votes: ${ctx.voteCount}
Delegators: ${ctx.delegatorCount}
Live Stake: ${(ctx.liveStakeAda / 1_000_000).toFixed(1)}M ADA
Strengths: ${ctx.strengths.join(', ') || 'None yet'}
${ctx.governanceStatement ? `Governance Statement: "${ctx.governanceStatement.slice(0, 200)}"` : ''}

Focus on their governance engagement and reliability.`;

  return generateText(prompt, {
    model: 'FAST',
    maxTokens: 200,
    temperature: 0.4,
    system: SYSTEM_PROMPT,
  });
}

// ─── Cache Layer ──────────────────────────────────────────────────────────────

export async function getCachedNarrative(
  entityType: 'drep' | 'spo',
  entityId: string,
): Promise<string | null> {
  const table = entityType === 'drep' ? 'dreps' : 'pools';
  const idCol = entityType === 'drep' ? 'drep_id' : 'pool_id';

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from(table)
    .select('spotlight_narrative')
    .eq(idCol, entityId)
    .single();

  return (data as { spotlight_narrative?: string | null } | null)?.spotlight_narrative ?? null;
}

export async function cacheNarrative(
  entityType: 'drep' | 'spo',
  entityId: string,
  narrative: string,
): Promise<void> {
  const table = entityType === 'drep' ? 'dreps' : 'pools';
  const idCol = entityType === 'drep' ? 'drep_id' : 'pool_id';

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from(table)
    .update({
      spotlight_narrative: narrative,
      spotlight_narrative_generated_at: new Date().toISOString(),
    })
    .eq(idCol, entityId);

  if (error) {
    logger.error('[Spotlight] Failed to cache narrative', { entityType, entityId, error });
  }
}

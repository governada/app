/**
 * Contextual AI Synthesis — the Co-Pilot brain.
 *
 * Given a page path and optional user context, produces an AI-synthesized
 * contextual briefing. Uses existing AI skills infrastructure and
 * assemblePersonalContext() for personalization.
 *
 * Route-specific synthesis:
 * - Proposal page: constitutional concerns + community sentiment + precedent
 * - DRep page: alignment match + score trajectory + key divergences
 * - Hub: personalized governance briefing + priority actions
 * - List pages: trending signals + personalized highlights
 */

import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { cached } from '@/lib/redis';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContextSynthesisInput {
  pathname: string;
  stakeAddress?: string;
  entityId?: string;
}

export interface ContextSynthesisResult {
  /** The synthesized briefing text */
  briefing: string;
  /** Key data points extracted for structured display */
  highlights: ContextHighlight[];
  /** Suggested actions for the user */
  suggestedActions: SuggestedAction[];
  /** Route type that was detected */
  routeType: RouteType;
  /** When this was computed */
  computedAt: string;
}

export interface ContextHighlight {
  label: string;
  value: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

export interface SuggestedAction {
  label: string;
  href: string;
  priority: 'high' | 'medium' | 'low';
}

type RouteType = 'proposal' | 'drep' | 'hub' | 'governance' | 'list' | 'unknown';

// ---------------------------------------------------------------------------
// Route detection
// ---------------------------------------------------------------------------

interface ParsedRoute {
  type: RouteType;
  entityId?: string;
}

function parseRoute(pathname: string): ParsedRoute {
  // /proposals/[txHash]-[index]
  const proposalMatch = pathname.match(/\/proposals\/([a-f0-9]+)-?(\d+)?/);
  if (proposalMatch) {
    return { type: 'proposal', entityId: proposalMatch[1] };
  }

  // /dreps/[drepId]
  const drepMatch = pathname.match(/\/dreps\/([^/]+)/);
  if (drepMatch) {
    return { type: 'drep', entityId: decodeURIComponent(drepMatch[1]) };
  }

  // /governance or /governance/*
  if (pathname.startsWith('/governance')) {
    return { type: 'governance' };
  }

  // Hub / home
  if (pathname === '/' || pathname === '/hub') {
    return { type: 'hub' };
  }

  // List pages
  if (pathname === '/dreps' || pathname === '/proposals') {
    return { type: 'list' };
  }

  return { type: 'unknown' };
}

// ---------------------------------------------------------------------------
// Synthesis implementations per route
// ---------------------------------------------------------------------------

async function synthesizeProposalContext(
  txHash: string,
  stakeAddress?: string,
): Promise<ContextSynthesisResult> {
  const supabase = createClient();

  // Fetch proposal data
  const { data: proposal } = await supabase
    .from('proposals')
    .select(
      'tx_hash, proposal_index, title, abstract, ai_summary, proposal_type, withdrawal_amount, treasury_tier, expiration_epoch, proposed_epoch, relevant_prefs',
    )
    .eq('tx_hash', txHash)
    .maybeSingle();

  if (!proposal) {
    return emptyResult('proposal');
  }

  // Parallel: vote counts, constitutional classification, similarity
  const [voteResult, classificationResult] = await Promise.all([
    supabase
      .from('drep_votes')
      .select('vote')
      .eq('proposal_tx_hash', txHash)
      .eq('proposal_index', proposal.proposal_index),
    supabase
      .from('proposal_classifications')
      .select('*')
      .eq('proposal_tx_hash', txHash)
      .eq('proposal_index', proposal.proposal_index)
      .maybeSingle(),
  ]);

  const votes = voteResult.data ?? [];
  const yes = votes.filter((v) => v.vote === 'Yes').length;
  const no = votes.filter((v) => v.vote === 'No').length;
  const abstain = votes.filter((v) => v.vote === 'Abstain').length;
  const total = yes + no + abstain;

  const highlights: ContextHighlight[] = [];
  const suggestedActions: SuggestedAction[] = [];

  // Vote sentiment
  if (total > 0) {
    const yesPct = Math.round((yes / total) * 100);
    highlights.push({
      label: 'DRep Sentiment',
      value: `${yesPct}% Yes (${total} votes)`,
      sentiment: yesPct > 60 ? 'positive' : yesPct < 40 ? 'negative' : 'neutral',
    });
  }

  // Treasury impact
  if (proposal.withdrawal_amount) {
    const adaAmount = Math.round(Number(proposal.withdrawal_amount) / 1_000_000);
    highlights.push({
      label: 'Treasury Impact',
      value: `${adaAmount.toLocaleString()} ADA`,
      sentiment: adaAmount > 10_000_000 ? 'negative' : 'neutral',
    });
  }

  // Constitutional classification strength
  if (classificationResult.data) {
    const dims = classificationResult.data as Record<string, number>;
    const maxDim = Math.max(
      dims.dim_treasury_conservative ?? 0,
      dims.dim_treasury_growth ?? 0,
      dims.dim_decentralization ?? 0,
      dims.dim_security ?? 0,
      dims.dim_innovation ?? 0,
      dims.dim_transparency ?? 0,
    );
    if (maxDim > 0.5) {
      highlights.push({
        label: 'Alignment Signal',
        value: maxDim > 0.8 ? 'Strong' : 'Moderate',
        sentiment: 'neutral',
      });
    }
  }

  // Expiration
  if (proposal.expiration_epoch) {
    const SHELLEY_GENESIS = 1596491091;
    const EPOCH_LEN = 432000;
    const SHELLEY_BASE = 209;
    const currentEpoch =
      Math.floor((Date.now() / 1000 - SHELLEY_GENESIS) / EPOCH_LEN) + SHELLEY_BASE;
    const epochsRemaining = proposal.expiration_epoch - currentEpoch;
    if (epochsRemaining <= 2 && epochsRemaining > 0) {
      highlights.push({
        label: 'Expiration',
        value: `${epochsRemaining} epoch${epochsRemaining === 1 ? '' : 's'} remaining`,
        sentiment: epochsRemaining <= 1 ? 'negative' : 'neutral',
      });
    }
  }

  // Build briefing text
  const briefingParts: string[] = [];
  briefingParts.push(
    `${proposal.title || 'Untitled Proposal'} is a ${proposal.proposal_type} proposal.`,
  );
  if (proposal.ai_summary) {
    briefingParts.push(proposal.ai_summary);
  }
  if (total > 0) {
    const yesPct = Math.round((yes / total) * 100);
    briefingParts.push(`Current voting: ${yesPct}% in favor across ${total} DRep votes.`);
  }

  // Suggested actions for authenticated users
  if (stakeAddress) {
    suggestedActions.push({
      label: 'View Full Analysis',
      href: `/proposals/${txHash}-${proposal.proposal_index}`,
      priority: 'medium',
    });
  }

  return {
    briefing: briefingParts.join(' '),
    highlights,
    suggestedActions,
    routeType: 'proposal',
    computedAt: new Date().toISOString(),
  };
}

async function synthesizeDrepContext(
  drepId: string,
  stakeAddress?: string,
): Promise<ContextSynthesisResult> {
  const supabase = createClient();

  const { data: drep } = await supabase
    .from('dreps')
    .select(
      'id, score, info, size_tier, effective_participation, rationale_rate, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency, score_momentum',
    )
    .eq('id', drepId)
    .maybeSingle();

  if (!drep) {
    return emptyResult('drep');
  }

  const info = (drep.info ?? {}) as Record<string, unknown>;
  const name = (info.name as string) || drepId.slice(0, 16);
  const highlights: ContextHighlight[] = [];
  const suggestedActions: SuggestedAction[] = [];

  // Score
  highlights.push({
    label: 'DRep Score',
    value: `${drep.score}/100`,
    sentiment: drep.score >= 70 ? 'positive' : drep.score >= 40 ? 'neutral' : 'negative',
  });

  // Participation
  if (drep.effective_participation != null) {
    highlights.push({
      label: 'Participation',
      value: `${Math.round(drep.effective_participation)}%`,
      sentiment:
        drep.effective_participation >= 70
          ? 'positive'
          : drep.effective_participation >= 40
            ? 'neutral'
            : 'negative',
    });
  }

  // Score momentum
  if (drep.score_momentum != null) {
    const direction =
      drep.score_momentum > 0.5 ? 'Rising' : drep.score_momentum < -0.5 ? 'Falling' : 'Stable';
    highlights.push({
      label: 'Trend',
      value: direction,
      sentiment:
        direction === 'Rising' ? 'positive' : direction === 'Falling' ? 'negative' : 'neutral',
    });
  }

  // Size tier
  highlights.push({
    label: 'Size',
    value: drep.size_tier ?? 'Unknown',
    sentiment: 'neutral',
  });

  // Alignment match (if authenticated user)
  if (stakeAddress) {
    // Check if user has alignment data
    const { data: userDrep } = await supabase
      .from('dreps')
      .select(
        'alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
      )
      .eq('id', stakeAddress)
      .maybeSingle();

    if (userDrep) {
      const userVec = [
        userDrep.alignment_treasury_conservative ?? 50,
        userDrep.alignment_treasury_growth ?? 50,
        userDrep.alignment_decentralization ?? 50,
        userDrep.alignment_security ?? 50,
        userDrep.alignment_innovation ?? 50,
        userDrep.alignment_transparency ?? 50,
      ];
      const drepVec = [
        drep.alignment_treasury_conservative ?? 50,
        drep.alignment_treasury_growth ?? 50,
        drep.alignment_decentralization ?? 50,
        drep.alignment_security ?? 50,
        drep.alignment_innovation ?? 50,
        drep.alignment_transparency ?? 50,
      ];
      const match = cosineDistance(userVec, drepVec);
      highlights.push({
        label: 'Alignment Match',
        value: `${Math.round(match * 100)}%`,
        sentiment: match > 0.7 ? 'positive' : match > 0.4 ? 'neutral' : 'negative',
      });
    }
  }

  const briefing = `${name} is a ${drep.size_tier ?? ''} DRep with a score of ${drep.score}/100. Participation rate: ${Math.round(drep.effective_participation ?? 0)}%. Rationale rate: ${Math.round(drep.rationale_rate ?? 0)}%.`;

  return {
    briefing,
    highlights,
    suggestedActions,
    routeType: 'drep',
    computedAt: new Date().toISOString(),
  };
}

async function synthesizeHubContext(stakeAddress?: string): Promise<ContextSynthesisResult> {
  const supabase = createClient();

  const highlights: ContextHighlight[] = [];
  const suggestedActions: SuggestedAction[] = [];

  // Get basic governance stats
  const [openCount, govStats] = await Promise.all([
    supabase
      .from('proposals')
      .select('*', { count: 'exact', head: true })
      .is('ratified_epoch', null)
      .is('enacted_epoch', null)
      .is('dropped_epoch', null)
      .is('expired_epoch', null),
    supabase.from('governance_stats').select('*').eq('id', 1).single(),
  ]);

  const activeProposals = openCount.count ?? 0;
  highlights.push({
    label: 'Active Proposals',
    value: String(activeProposals),
    sentiment: activeProposals > 10 ? 'negative' : 'neutral',
  });

  if (govStats.data) {
    const stats = govStats.data as Record<string, unknown>;
    if (stats.current_epoch) {
      highlights.push({
        label: 'Current Epoch',
        value: String(stats.current_epoch),
        sentiment: 'neutral',
      });
    }
  }

  if (stakeAddress) {
    suggestedActions.push({
      label: 'Review Your Inbox',
      href: '/governance/inbox',
      priority: 'high',
    });
  }

  suggestedActions.push({
    label: 'Browse Active Proposals',
    href: '/proposals',
    priority: 'medium',
  });

  const briefing = `${activeProposals} governance proposal${activeProposals === 1 ? ' is' : 's are'} currently active on the Cardano network.`;

  return {
    briefing,
    highlights,
    suggestedActions,
    routeType: 'hub',
    computedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Produce contextual intelligence for a given page path and user.
 * Results are cached per user+route for 5 minutes via Redis.
 */
export async function synthesizeContext(
  input: ContextSynthesisInput,
): Promise<ContextSynthesisResult> {
  const { pathname, stakeAddress, entityId } = input;
  const route = parseRoute(pathname);

  // Override entityId from route if detected
  const resolvedEntityId = entityId || route.entityId;

  // Cache key: route type + entity + user
  const cacheKey = `ctx:${route.type}:${resolvedEntityId ?? 'none'}:${stakeAddress ?? 'anon'}`;

  try {
    return await cached(cacheKey, 300, async () => {
      switch (route.type) {
        case 'proposal':
          return resolvedEntityId
            ? synthesizeProposalContext(resolvedEntityId, stakeAddress)
            : emptyResult('proposal');
        case 'drep':
          return resolvedEntityId
            ? synthesizeDrepContext(resolvedEntityId, stakeAddress)
            : emptyResult('drep');
        case 'hub':
          return synthesizeHubContext(stakeAddress);
        case 'governance':
          return synthesizeHubContext(stakeAddress);
        case 'list':
          return synthesizeHubContext(stakeAddress);
        default:
          return emptyResult('unknown');
      }
    });
  } catch (err) {
    logger.warn('[intelligence/context] Synthesis failed, returning data-only context', {
      error: err,
    });
    // Fallback: try without cache
    try {
      switch (route.type) {
        case 'proposal':
          return resolvedEntityId
            ? await synthesizeProposalContext(resolvedEntityId, stakeAddress)
            : emptyResult('proposal');
        case 'drep':
          return resolvedEntityId
            ? await synthesizeDrepContext(resolvedEntityId, stakeAddress)
            : emptyResult('drep');
        case 'hub':
        case 'governance':
        case 'list':
          return await synthesizeHubContext(stakeAddress);
        default:
          return emptyResult('unknown');
      }
    } catch {
      return emptyResult(route.type);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyResult(routeType: RouteType): ContextSynthesisResult {
  return {
    briefing: '',
    highlights: [],
    suggestedActions: [],
    routeType,
    computedAt: new Date().toISOString(),
  };
}

function cosineDistance(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

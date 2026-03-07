import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { computeInterBodyAlignment } from '@/lib/interBodyAlignment';
import { generateText } from '@/lib/ai';
import { cached } from '@/lib/redis';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const NARRATIVE_TTL = 86_400; // 24 hours

/**
 * GET /api/governance/inter-body-narrative?txHash=X&index=Y
 *
 * Returns an AI-generated narrative explaining inter-body governance dynamics
 * for a specific proposal. Only generates when alignment < 85%.
 */
export const GET = withRouteHandler(async (request: NextRequest) => {
  const txHash = request.nextUrl.searchParams.get('txHash');
  const indexStr = request.nextUrl.searchParams.get('index');

  if (!txHash || !indexStr) {
    return NextResponse.json({ error: 'txHash and index required' }, { status: 400 });
  }

  const index = parseInt(indexStr, 10);
  if (isNaN(index)) {
    return NextResponse.json({ error: 'index must be a number' }, { status: 400 });
  }

  const cacheKey = `interbody-narrative:${txHash}:${index}`;

  const narrative = await cached<string | null>(cacheKey, NARRATIVE_TTL, async () => {
    const alignment = await computeInterBodyAlignment(txHash, index);

    // Only generate narrative when there's meaningful divergence
    if (alignment.bodiesVoting < 2 || alignment.alignmentScore >= 85) {
      return null;
    }

    // Get proposal title/type for context
    const supabase = createClient();
    const { data: proposal } = await supabase
      .from('proposals')
      .select('title, proposal_type')
      .eq('tx_hash', txHash)
      .eq('proposal_index', index)
      .single();

    // Get citizen sentiment if available
    const { data: sentimentRow } = await supabase
      .from('engagement_signal_aggregations')
      .select('data')
      .eq('entity_type', 'proposal')
      .eq('entity_id', `${txHash}:${index}`)
      .eq('signal_type', 'sentiment')
      .maybeSingle();

    const sentiment = sentimentRow?.data as {
      support: number;
      oppose: number;
      unsure: number;
      total: number;
    } | null;

    const { drep, spo, cc } = alignment;
    const proposalTitle = proposal?.title || 'this proposal';
    const proposalType = proposal?.proposal_type || 'governance action';

    const prompt = buildNarrativePrompt({
      proposalTitle,
      proposalType,
      alignmentScore: alignment.alignmentScore,
      drep,
      spo,
      cc,
      sentiment,
    });

    return generateText(prompt, {
      model: 'FAST',
      maxTokens: 300,
      temperature: 0.3,
      system:
        'You are a governance analyst for Cardano. Write concise, insightful analysis of governance dynamics. Be specific about what the voting patterns suggest. Never use markdown. Write 2-3 sentences max.',
    });
  });

  if (!narrative) {
    return NextResponse.json(
      { narrative: null },
      { headers: { 'Cache-Control': 'public, s-maxage=3600' } },
    );
  }

  return NextResponse.json(
    { narrative },
    { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800' } },
  );
});

function buildNarrativePrompt({
  proposalTitle,
  proposalType,
  alignmentScore,
  drep,
  spo,
  cc,
  sentiment,
}: {
  proposalTitle: string;
  proposalType: string;
  alignmentScore: number;
  drep: { yes: number; no: number; abstain: number; total: number; yesPct: number };
  spo: { yes: number; no: number; abstain: number; total: number; yesPct: number };
  cc: { yes: number; no: number; abstain: number; total: number; yesPct: number };
  sentiment: { support: number; oppose: number; unsure: number; total: number } | null;
}): string {
  const parts: string[] = [
    `Proposal: "${proposalTitle}" (${proposalType})`,
    `Inter-body alignment: ${alignmentScore}%`,
    '',
    'Voting breakdown:',
  ];

  if (drep.total > 0) {
    parts.push(
      `- DReps: ${drep.yes} Yes, ${drep.no} No, ${drep.abstain} Abstain (${drep.total} total, ${drep.yesPct}% Yes)`,
    );
  }
  if (spo.total > 0) {
    parts.push(
      `- SPOs: ${spo.yes} Yes, ${spo.no} No, ${spo.abstain} Abstain (${spo.total} total, ${spo.yesPct}% Yes)`,
    );
  }
  if (cc.total > 0) {
    parts.push(
      `- CC: ${cc.yes} Yes, ${cc.no} No, ${cc.abstain} Abstain (${cc.total} total, ${cc.yesPct}% Yes)`,
    );
  }

  if (sentiment && sentiment.total > 0) {
    const supportPct = Math.round((sentiment.support / sentiment.total) * 100);
    parts.push(
      '',
      `Citizen sentiment: ${sentiment.support} support, ${sentiment.oppose} oppose, ${sentiment.unsure} unsure (${sentiment.total} citizens, ${supportPct}% support)`,
    );
  }

  parts.push(
    '',
    'Explain the governance dynamics: why these bodies might vote differently, what the pattern suggests about this proposal, and any tension between representative votes and citizen sentiment. Be specific and analytical.',
  );

  return parts.join('\n');
}

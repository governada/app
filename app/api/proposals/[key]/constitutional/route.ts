/**
 * GET /api/proposals/[key]/constitutional
 *
 * Constitutional article mapping for a proposal. Returns relevant
 * constitutional articles and their relationship to the proposal.
 *
 * Uses proposal classifications and AI-generated analysis when available.
 * Falls back to type-based heuristic mapping when AI data is not present.
 *
 * The [key] param is formatted as "{txHash}-{proposalIndex}".
 *
 * TODO: When `proposal_constitutional_refs` table is created (via Supabase
 * migration), read precomputed refs from there instead of computing on the fly.
 */

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConstitutionalRef {
  article: string;
  section: string | null;
  relevance: 'high' | 'medium' | 'low';
  reason: string;
}

interface ConstitutionalMapping {
  proposalTxHash: string;
  proposalIndex: number;
  refs: ConstitutionalRef[];
  source: 'precomputed' | 'heuristic';
  computedAt: string;
}

// ---------------------------------------------------------------------------
// Heuristic article mapping (by proposal type)
// ---------------------------------------------------------------------------

const TYPE_ARTICLE_MAP: Record<string, ConstitutionalRef[]> = {
  TreasuryWithdrawals: [
    {
      article: 'Article III',
      section: 'Section 7',
      relevance: 'high',
      reason:
        'Treasury withdrawals require constitutional compliance with fiscal governance provisions.',
    },
    {
      article: 'Article VI',
      section: null,
      relevance: 'medium',
      reason: 'Governance actions involving treasury must follow the governance framework.',
    },
  ],
  ParameterChange: [
    {
      article: 'Article V',
      section: null,
      relevance: 'high',
      reason: 'Protocol parameter changes must align with technical governance guardrails.',
    },
    {
      article: 'Article III',
      section: 'Section 5',
      relevance: 'medium',
      reason: 'Parameter changes should maintain system stability and security.',
    },
  ],
  HardForkInitiation: [
    {
      article: 'Article V',
      section: null,
      relevance: 'high',
      reason: 'Hard forks require broad consensus under the governance framework.',
    },
    {
      article: 'Article III',
      section: 'Section 5',
      relevance: 'high',
      reason: 'Hard forks must not compromise network security or decentralization.',
    },
  ],
  NewConstitution: [
    {
      article: 'Article VII',
      section: null,
      relevance: 'high',
      reason:
        'Constitutional amendments must follow the amendment process defined in the Constitution.',
    },
  ],
  UpdateConstitution: [
    {
      article: 'Article VII',
      section: null,
      relevance: 'high',
      reason: 'Constitutional updates must follow the amendment process.',
    },
  ],
  NoConfidence: [
    {
      article: 'Article IV',
      section: null,
      relevance: 'high',
      reason: 'No-confidence motions are a constitutional mechanism for governance accountability.',
    },
    {
      article: 'Article VI',
      section: null,
      relevance: 'medium',
      reason: 'Must comply with the governance action procedures.',
    },
  ],
  NewCommittee: [
    {
      article: 'Article IV',
      section: null,
      relevance: 'high',
      reason: 'Committee changes must follow constitutional provisions for committee governance.',
    },
  ],
  NewConstitutionalCommittee: [
    {
      article: 'Article IV',
      section: null,
      relevance: 'high',
      reason: 'New committee elections must follow the constitutional framework.',
    },
  ],
  InfoAction: [
    {
      article: 'Article VI',
      section: null,
      relevance: 'low',
      reason: 'Info actions are advisory and do not directly modify protocol state.',
    },
  ],
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const GET = withRouteHandler(async (request) => {
  const url = new URL(request.url);
  // Extract key from path: /api/proposals/[key]/constitutional
  const pathParts = url.pathname.split('/');
  const proposalIdx = pathParts.findIndex((p) => p === 'proposals');
  const key = proposalIdx >= 0 ? pathParts[proposalIdx + 1] : null;

  if (!key) {
    return NextResponse.json({ error: 'Proposal key required' }, { status: 400 });
  }

  // Parse key as txHash-proposalIndex
  const lastDash = key.lastIndexOf('-');
  const txHash = lastDash > 0 ? key.slice(0, lastDash) : key;
  const proposalIndex = lastDash > 0 ? parseInt(key.slice(lastDash + 1), 10) : 0;

  const supabase = createClient();

  // TODO: Check precomputed `proposal_constitutional_refs` table when it exists
  // const { data: precomputed } = await supabase
  //   .from('proposal_constitutional_refs')
  //   .select('*')
  //   .eq('proposal_tx_hash', txHash)
  //   .eq('proposal_index', proposalIndex);
  //
  // if (precomputed && precomputed.length > 0) {
  //   return NextResponse.json({ ... precomputed refs ..., source: 'precomputed' });
  // }

  // Fetch proposal type for heuristic mapping
  const { data: proposal } = await supabase
    .from('proposals')
    .select('proposal_type')
    .eq('tx_hash', txHash)
    .eq('proposal_index', proposalIndex)
    .maybeSingle();

  if (!proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  }

  // Heuristic mapping based on proposal type
  const refs = TYPE_ARTICLE_MAP[proposal.proposal_type] ?? [
    {
      article: 'Article VI',
      section: null,
      relevance: 'low' as const,
      reason: 'All governance actions are subject to the governance framework.',
    },
  ];

  const result: ConstitutionalMapping = {
    proposalTxHash: txHash,
    proposalIndex,
    refs,
    source: 'heuristic',
    computedAt: new Date().toISOString(),
  };

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
  });
});

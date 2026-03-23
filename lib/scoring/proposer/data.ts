/**
 * Proposer Score — Data Access Layer
 *
 * Read functions for proposer scores, used by UI components.
 * All reads use the public Supabase client (RLS-protected).
 */

import { createClient } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProposerSummary {
  id: string;
  displayName: string;
  type: 'individual' | 'organization' | 'institutional';
  proposalCount: number;
  enactedCount: number;
  droppedCount: number;
  compositeScore: number | null;
  trackRecordScore: number | null;
  proposalQualityScore: number | null;
  fiscalResponsibilityScore: number | null;
  governanceCitizenshipScore: number | null;
  confidence: number;
  tier: string;
}

// ---------------------------------------------------------------------------
// Read functions
// ---------------------------------------------------------------------------

/**
 * Get the proposer(s) for a specific proposal.
 * Returns null if no proposer is linked (proposal has no author metadata).
 */
export async function getProposalProposers(
  txHash: string,
  proposalIndex: number,
): Promise<ProposerSummary[]> {
  const supabase = createClient();

  const { data: links } = await supabase
    .from('proposal_proposers')
    .select('proposer_id')
    .eq('proposal_tx_hash', txHash)
    .eq('proposal_index', proposalIndex);

  if (!links?.length) return [];

  const proposerIds = links.map((l) => l.proposer_id);

  const { data: proposers } = await supabase.from('proposers').select('*').in('id', proposerIds);

  if (!proposers?.length) return [];

  return proposers.map(mapProposer);
}

/**
 * Get a single proposer by ID.
 */
export async function getProposer(proposerId: string): Promise<ProposerSummary | null> {
  const supabase = createClient();

  const { data } = await supabase.from('proposers').select('*').eq('id', proposerId).single();

  if (!data) return null;
  return mapProposer(data);
}

/**
 * Get all proposals by a specific proposer, for showing their track record.
 */
export async function getProposerProposals(proposerId: string): Promise<
  {
    txHash: string;
    proposalIndex: number;
    title: string | null;
    proposalType: string;
    proposedEpoch: number | null;
    enacted: boolean;
    dropped: boolean;
    withdrawalAmount: number | null;
  }[]
> {
  const supabase = createClient();

  const { data: links } = await supabase
    .from('proposal_proposers')
    .select('proposal_tx_hash, proposal_index')
    .eq('proposer_id', proposerId);

  if (!links?.length) return [];

  const txHashes = links.map((l) => l.proposal_tx_hash);

  const { data: proposals } = await supabase
    .from('proposals')
    .select(
      'tx_hash, proposal_index, title, proposal_type, proposed_epoch, enacted_epoch, dropped_epoch, expired_epoch, ratified_epoch, withdrawal_amount',
    )
    .in('tx_hash', txHashes)
    .order('proposed_epoch', { ascending: false });

  if (!proposals?.length) return [];

  return proposals.map((p) => ({
    txHash: p.tx_hash,
    proposalIndex: p.proposal_index,
    title: p.title,
    proposalType: p.proposal_type,
    proposedEpoch: p.proposed_epoch,
    enacted: !!(p.enacted_epoch || p.ratified_epoch),
    dropped: !!(p.dropped_epoch || (p.expired_epoch && !p.enacted_epoch && !p.ratified_epoch)),
    withdrawalAmount: p.withdrawal_amount ? Number(p.withdrawal_amount) : null,
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapProposer(row: Record<string, unknown>): ProposerSummary {
  return {
    id: row.id as string,
    displayName: row.display_name as string,
    type: row.type as 'individual' | 'organization' | 'institutional',
    proposalCount: row.proposal_count as number,
    enactedCount: row.enacted_count as number,
    droppedCount: row.dropped_count as number,
    compositeScore: row.composite_score as number | null,
    trackRecordScore: row.track_record_score as number | null,
    proposalQualityScore: row.proposal_quality_score as number | null,
    fiscalResponsibilityScore: row.fiscal_responsibility_score as number | null,
    governanceCitizenshipScore: row.governance_citizenship_score as number | null,
    confidence: row.confidence as number,
    tier: row.tier as string,
  };
}

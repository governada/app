/**
 * Proposal Monitoring API — returns voting progress, deposit status,
 * and recent vote activity for a submitted governance action.
 *
 * GET /api/workspace/proposals/monitor?txHash=...&proposalIndex=...
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { GOVERNANCE_ACTION_DEPOSIT_LOVELACE } from '@/lib/governance/constants';
import { getVotingBodies } from '@/lib/governance/votingBodies';
import { getGovernanceThresholdForProposal } from '@/lib/governanceThresholds';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { logger } from '@/lib/logger';
import type { ProposalMonitorData } from '@/lib/workspace/monitor-types';

export const dynamic = 'force-dynamic';

const CC_APPROVAL_THRESHOLD = 2 / 3;
const STANDARD_SPO_APPROVAL_THRESHOLD = 0.51;
const INFO_ACTION_APPROVAL_THRESHOLD = 1;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveStatus(proposal: {
  ratified_epoch: number | null;
  enacted_epoch: number | null;
  expired_epoch: number | null;
  dropped_epoch: number | null;
}): ProposalMonitorData['status'] {
  if (proposal.enacted_epoch != null) return 'enacted';
  if (proposal.ratified_epoch != null) return 'ratified';
  if (proposal.expired_epoch != null) return 'expired';
  if (proposal.dropped_epoch != null) return 'dropped';
  return 'voting';
}

function deriveDepositStatus(
  status: ProposalMonitorData['status'],
): ProposalMonitorData['deposit']['status'] {
  if (status === 'voting') return 'locked';
  if (status === 'dropped') return 'at_risk';
  return 'returned';
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const GET = withRouteHandler(async (request: NextRequest) => {
  const txHash = request.nextUrl.searchParams.get('txHash');
  const proposalIndexStr = request.nextUrl.searchParams.get('proposalIndex');

  if (!txHash || proposalIndexStr == null) {
    return NextResponse.json(
      { error: 'Missing txHash or proposalIndex query parameter' },
      { status: 400 },
    );
  }

  const proposalIndex = parseInt(proposalIndexStr, 10);
  if (isNaN(proposalIndex)) {
    return NextResponse.json({ error: 'Invalid proposalIndex' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

  // ── 1. Fetch proposal lifecycle data ─────────────────────────────────
  const { data: proposal, error: pError } = await supabase
    .from('proposals')
    .select('*')
    .eq('tx_hash', txHash)
    .eq('proposal_index', proposalIndex)
    .maybeSingle();

  if (pError) {
    logger.error('[monitor] Failed to fetch proposal', { error: pError });
    return NextResponse.json({ error: 'Failed to fetch proposal' }, { status: 500 });
  }

  if (!proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  }

  const status = deriveStatus(proposal);
  const eligibleBodies = new Set(
    getVotingBodies(
      proposal.proposal_type,
      (proposal.param_changes as Record<string, unknown> | null) ?? null,
    ),
  );
  const drepThreshold =
    proposal.proposal_type === 'InfoAction'
      ? INFO_ACTION_APPROVAL_THRESHOLD
      : (
          await getGovernanceThresholdForProposal({
            proposalType: proposal.proposal_type,
            paramChanges: (proposal.param_changes as Record<string, unknown> | null) ?? null,
          })
        ).threshold;

  if (drepThreshold == null) {
    logger.error('[monitor] Missing DRep threshold configuration', {
      proposalType: proposal.proposal_type,
      txHash,
      proposalIndex,
    });
    return NextResponse.json(
      { error: 'Unsupported proposal threshold configuration' },
      { status: 500 },
    );
  }

  // ── 2. Fetch latest voting summary ───────────────────────────────────
  const { data: summaryRows } = await supabase
    .from('proposal_voting_summary')
    .select('*')
    .eq('proposal_tx_hash', txHash)
    .eq('proposal_index', proposalIndex)
    .order('epoch_no', { ascending: false })
    .limit(1);

  const summary = summaryRows?.[0] ?? null;

  // Build voting tallies
  const drepYesPower = summary?.drep_yes_vote_power ?? 0;
  const drepNoPower = summary?.drep_no_vote_power ?? 0;
  const drepAbstainPower = summary?.drep_abstain_vote_power ?? 0;

  const voting: ProposalMonitorData['voting'] = {
    drep: {
      yesCount: summary?.drep_yes_votes_cast ?? 0,
      yesVotePower: drepYesPower,
      noCount: summary?.drep_no_votes_cast ?? 0,
      noVotePower: drepNoPower,
      abstainCount: summary?.drep_abstain_votes_cast ?? 0,
      abstainVotePower: drepAbstainPower,
      threshold: drepThreshold,
    },
  };

  if (eligibleBodies.has('spo')) {
    voting.spo = {
      yesCount: summary?.pool_yes_votes_cast ?? 0,
      yesVotePower: summary?.pool_yes_vote_power ?? 0,
      noCount: summary?.pool_no_votes_cast ?? 0,
      noVotePower: summary?.pool_no_vote_power ?? 0,
      abstainCount: summary?.pool_abstain_votes_cast ?? 0,
      abstainVotePower: summary?.pool_abstain_vote_power ?? 0,
      threshold:
        proposal.proposal_type === 'InfoAction'
          ? INFO_ACTION_APPROVAL_THRESHOLD
          : STANDARD_SPO_APPROVAL_THRESHOLD,
    };
  }

  if (eligibleBodies.has('cc')) {
    voting.cc = {
      yesCount: summary?.committee_yes_votes_cast ?? 0,
      noCount: summary?.committee_no_votes_cast ?? 0,
      abstainCount: summary?.committee_abstain_votes_cast ?? 0,
      threshold: CC_APPROVAL_THRESHOLD,
    };
  }

  // ── 3. Fetch recent vote activity ────────────────────────────────────
  const { data: recentVoteRows } = await supabase
    .from('drep_votes')
    .select('drep_id, vote, epoch_no, block_time, meta_url')
    .eq('proposal_tx_hash', txHash)
    .eq('proposal_index', proposalIndex)
    .order('block_time', { ascending: false })
    .limit(10);

  const recentVotes: ProposalMonitorData['recentVotes'] =
    recentVoteRows?.map((v) => ({
      voterId: v.drep_id,
      voterType: 'drep' as const,
      vote: v.vote as 'Yes' | 'No' | 'Abstain',
      epochNo: v.epoch_no ?? blockTimeToEpoch(v.block_time),
      hasRationale: !!v.meta_url,
    })) ?? [];

  // ── 4. Compute deposit info ──────────────────────────────────────────
  const depositStatus = deriveDepositStatus(status);

  // ── 5. Compute epochs remaining ──────────────────────────────────────
  const expirationEpoch = proposal.expiration_epoch;
  const epochsRemaining =
    status === 'voting' && expirationEpoch != null
      ? Math.max(0, expirationEpoch - currentEpoch)
      : null;

  // ── 6. Assemble response ─────────────────────────────────────────────
  const monitorData: ProposalMonitorData = {
    txHash: proposal.tx_hash,
    proposalIndex: proposal.proposal_index,
    title: proposal.title ?? 'Untitled Proposal',
    proposalType: proposal.proposal_type,

    status,
    proposedEpoch: proposal.proposed_epoch,
    ratifiedEpoch: proposal.ratified_epoch,
    enactedEpoch: proposal.enacted_epoch,
    expiredEpoch: proposal.expired_epoch,
    droppedEpoch: proposal.dropped_epoch,
    expirationEpoch: proposal.expiration_epoch,

    voting,
    recentVotes,

    deposit: {
      amount: GOVERNANCE_ACTION_DEPOSIT_LOVELACE,
      status: depositStatus,
      returnAddress: null, // Not stored in proposals table; safe to omit
    },

    currentEpoch,
    epochsRemaining,
  };

  return NextResponse.json(monitorData);
});

import type { SupabaseClient } from '@supabase/supabase-js';
import { inngest } from '@/lib/inngest';
import { logger } from '@/lib/logger';
import { errMsg } from '@/lib/sync-utils';
import { fetchProposalVotingSummary } from '@/utils/koios';
import { getProposalPriority } from '@/utils/proposalPriority';

export type ProposalSyncOpenRef = {
  txHash: string;
  index: number;
};

export type ProposalSyncFollowUpResult = {
  voteSyncsTriggered: number;
  summaryCount: number;
  pushSent: number;
  warnings: string[];
};

type ProposalSyncFollowUpParams = {
  supabase: SupabaseClient;
  openProposals: ProposalSyncOpenRef[];
};

/**
 * Handles the post-ingest proposal sync side effects:
 * vote sync fan-out, voting summary refresh, and critical notifications.
 */
export async function runProposalSyncFollowUps({
  supabase,
  openProposals,
}: ProposalSyncFollowUpParams): Promise<ProposalSyncFollowUpResult> {
  const warnings: string[] = [];
  let voteSyncsTriggered = 0;
  let summaryCount = 0;
  let pushSent = 0;

  if (openProposals.length === 0) {
    return { voteSyncsTriggered, summaryCount, pushSent, warnings };
  }

  try {
    await inngest.send({
      name: 'drepscore/sync.votes',
      data: {
        source: 'sync.proposals',
        openProposalCount: openProposals.length,
      },
    });
    voteSyncsTriggered = 1;
    logger.info('[proposals] Triggered incremental vote sync', {
      openProposals: openProposals.length,
    });
  } catch (err) {
    warnings.push(`Vote sync trigger: ${errMsg(err)}`);
    logger.warn('[proposals] Vote sync trigger failed (non-fatal)', { error: errMsg(err) });
  }

  try {
    const { data: openWithId } = await supabase
      .from('proposals')
      .select('tx_hash, proposal_index, proposal_id')
      .is('ratified_epoch', null)
      .is('enacted_epoch', null)
      .is('dropped_epoch', null)
      .is('expired_epoch', null)
      .not('proposal_id', 'is', null);

    const proposals = openWithId || [];

    for (let i = 0; i < proposals.length; i += 5) {
      const chunk = proposals.slice(i, i + 5);
      const results = await Promise.allSettled(
        chunk.map(async (p) => {
          const summary = await fetchProposalVotingSummary(p.proposal_id);
          if (!summary) return false;
          await supabase.from('proposal_voting_summary').upsert(
            {
              proposal_tx_hash: p.tx_hash,
              proposal_index: p.proposal_index,
              epoch_no: summary.epoch_no,
              drep_yes_votes_cast: summary.drep_yes_votes_cast,
              drep_yes_vote_power: parseInt(summary.drep_active_yes_vote_power || '0', 10),
              drep_no_votes_cast: summary.drep_no_votes_cast,
              drep_no_vote_power: parseInt(summary.drep_active_no_vote_power || '0', 10),
              drep_abstain_votes_cast: summary.drep_abstain_votes_cast,
              drep_abstain_vote_power: parseInt(
                summary.drep_active_abstain_vote_power || '0',
                10,
              ),
              drep_always_abstain_power: parseInt(
                summary.drep_always_abstain_vote_power || '0',
                10,
              ),
              drep_always_no_confidence_power: parseInt(
                summary.drep_always_no_confidence_vote_power || '0',
                10,
              ),
              pool_yes_votes_cast: summary.pool_yes_votes_cast,
              pool_yes_vote_power: parseInt(summary.pool_active_yes_vote_power || '0', 10),
              pool_no_votes_cast: summary.pool_no_votes_cast,
              pool_no_vote_power: parseInt(summary.pool_active_no_vote_power || '0', 10),
              pool_abstain_votes_cast: summary.pool_abstain_votes_cast,
              pool_abstain_vote_power: parseInt(summary.pool_active_abstain_vote_power || '0', 10),
              committee_yes_votes_cast: summary.committee_yes_votes_cast,
              committee_no_votes_cast: summary.committee_no_votes_cast,
              committee_abstain_votes_cast: summary.committee_abstain_votes_cast,
              fetched_at: new Date().toISOString(),
            },
            { onConflict: 'proposal_tx_hash,proposal_index' },
          );
          return true;
        }),
      );
      summaryCount += results.filter((r) => r.status === 'fulfilled' && r.value).length;
    }

    if (summaryCount > 0) {
      logger.info('[proposals] Voting summaries refreshed', { count: summaryCount });
    }
  } catch (err) {
    logger.warn('[proposals] Voting summary refresh error', { error: errMsg(err) });
  }

  try {
    const { data: openCritical } = await supabase
      .from('proposals')
      .select('tx_hash, proposal_index, title, proposal_type')
      .is('ratified_epoch', null)
      .is('enacted_epoch', null)
      .is('dropped_epoch', null)
      .is('expired_epoch', null);

    const critical = (openCritical || []).filter(
      (p: Record<string, unknown>) =>
        getProposalPriority(p.proposal_type as string) === 'critical',
    );

    if (critical.length > 0) {
      const newest = critical[0];
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://governada.io';
      const { broadcastEvent, broadcastDiscord } = await import('@/lib/notifications');
      const event = {
        eventType: 'critical-proposal-open' as const,
        title: 'Critical Proposal Open',
        body:
          (newest.title as string) || 'A critical governance proposal requires DRep attention.',
        url: `${baseUrl}/proposals/${newest.tx_hash}/${newest.proposal_index}`,
        metadata: { txHash: newest.tx_hash, index: newest.proposal_index },
      };
      await broadcastDiscord(event).catch(() => {});
      pushSent = await broadcastEvent(event);
    }
  } catch (err) {
    logger.warn('[proposals] Notification broadcast skipped', { error: err });
  }

  return { voteSyncsTriggered, summaryCount, pushSent, warnings };
}

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { cached } from '@/lib/redis';
import type { ActivityEvent } from '@/lib/intelligence/idleActivity';
import type { GlobeCommand } from '@/lib/globe/types';

export const dynamic = 'force-dynamic';

const CACHE_KEY = 'governance:activity:recent';
const CACHE_TTL = 300; // 5 minutes

export const GET = withRouteHandler(async () => {
  const events = await cached<ActivityEvent[]>(CACHE_KEY, CACHE_TTL, fetchRecentActivity);
  return NextResponse.json(events);
});

async function fetchRecentActivity(): Promise<ActivityEvent[]> {
  const supabase = createClient();
  const events: ActivityEvent[] = [];

  // 1. Recent notable votes (proposal_vote)
  const { data: recentVotes } = await supabase
    .from('drep_votes')
    .select(
      'drep_id, vote, proposal_tx_hash, proposal_index, block_time, proposals!inner(title, type)',
    )
    .order('block_time', { ascending: false })
    .limit(10);

  if (recentVotes && recentVotes.length > 0) {
    // Group by proposal — find the proposal with most recent votes
    const proposalVoteCounts = new Map<
      string,
      { count: number; title: string; hash: string; index: number; time: string }
    >();
    for (const v of recentVotes) {
      const key = `${v.proposal_tx_hash}_${v.proposal_index}`;
      const existing = proposalVoteCounts.get(key);
      const proposal = v.proposals as unknown as { title: string; type: string } | null;
      if (!existing) {
        proposalVoteCounts.set(key, {
          count: 1,
          title: proposal?.title ?? 'Governance Proposal',
          hash: v.proposal_tx_hash,
          index: v.proposal_index,
          time: v.block_time,
        });
      } else {
        existing.count++;
      }
    }

    // Pick the proposal with most recent activity
    const top = [...proposalVoteCounts.values()].sort(
      (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
    )[0];

    if (top) {
      const globeCmd: GlobeCommand = {
        type: 'voteSplit',
        proposalRef: `${top.hash}_${top.index}`,
      };
      events.push({
        type: 'proposal_vote',
        headline: `${top.count} new vote${top.count > 1 ? 's' : ''} on "${truncate(top.title, 50)}"`,
        subLabel: 'Proposal',
        entityId: top.hash,
        entityType: 'proposal',
        globeCommand: globeCmd,
        timestamp: top.time,
        icon: 'vote',
      });
    }
  }

  // 2. GHI change (ghi_change)
  const { data: ghiSnapshots } = await supabase
    .from('ghi_snapshots')
    .select('epoch_no, score, band')
    .order('epoch_no', { ascending: false })
    .limit(2);

  if (ghiSnapshots && ghiSnapshots.length >= 2) {
    const current = ghiSnapshots[0];
    const previous = ghiSnapshots[1];
    const delta = Math.round(current.score - previous.score);
    if (Math.abs(delta) >= 1) {
      events.push({
        type: 'ghi_change',
        headline: `Governance health ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta)} points to ${Math.round(current.score)}`,
        subLabel: `Epoch ${current.epoch_no} · ${current.band}`,
        globeCommand: {
          type: 'highlight',
          alignment: [50, 50, 50, 50, 50, 50],
          threshold: 250,
          noZoom: true,
        },
        timestamp: new Date().toISOString(),
        icon: 'health',
      });
    }
  }

  // 3. Score milestones (score_milestone) — DReps crossing 80-point threshold
  const { data: highScorers } = await supabase
    .from('dreps')
    .select('id, score, info')
    .gte('score', 80)
    .order('score', { ascending: false })
    .limit(3);

  if (highScorers && highScorers.length > 0) {
    const drep = highScorers[0];
    const info = drep.info as Record<string, unknown> | null;
    const name = (info?.name as string) || (info?.handle as string) || drep.id.slice(0, 12) + '...';
    events.push({
      type: 'score_milestone',
      headline: `${name} leads with a score of ${Math.round(drep.score ?? 0)}`,
      subLabel: 'Top representative',
      entityId: drep.id,
      entityType: 'drep',
      globeCommand: { type: 'flyTo', nodeId: `drep_${drep.id}` },
      timestamp: new Date().toISOString(),
      icon: 'milestone',
    });
  }

  // 4. Threshold approach — proposals close to passing
  const { data: activeProposals } = await supabase
    .from('proposals')
    .select('tx_hash, index, title, type, status')
    .in('status', ['active', 'voting'])
    .limit(20);

  if (activeProposals && activeProposals.length > 0) {
    // Pick the most recently added active proposal
    const proposal = activeProposals[0];
    events.push({
      type: 'threshold_approach',
      headline: `"${truncate(proposal.title ?? 'Proposal', 50)}" is accepting votes`,
      subLabel: proposal.type ?? 'Proposal',
      entityId: proposal.tx_hash,
      entityType: 'proposal',
      globeCommand: {
        type: 'flyTo',
        nodeId: `proposal_${proposal.tx_hash}_${proposal.index}`,
      },
      timestamp: new Date().toISOString(),
      icon: 'threshold',
    });
  }

  // Sort by timestamp desc, return top 5
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return events.slice(0, 5);
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

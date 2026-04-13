import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSend, mockFetchProposalVotingSummary, mockBroadcastEvent, mockBroadcastDiscord, mockGetProposalPriority } =
  vi.hoisted(() => ({
    mockSend: vi.fn(),
    mockFetchProposalVotingSummary: vi.fn(),
    mockBroadcastEvent: vi.fn(),
    mockBroadcastDiscord: vi.fn(),
    mockGetProposalPriority: vi.fn(),
  }));

vi.mock('@/lib/inngest', () => ({
  inngest: {
    send: mockSend,
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/sync-utils', () => ({
  errMsg: (error: unknown) => (error instanceof Error ? error.message : String(error)),
}));

vi.mock('@/utils/koios', () => ({
  fetchProposalVotingSummary: mockFetchProposalVotingSummary,
}));

vi.mock('@/utils/proposalPriority', () => ({
  getProposalPriority: mockGetProposalPriority,
}));

vi.mock('@/lib/notifications', () => ({
  broadcastEvent: mockBroadcastEvent,
  broadcastDiscord: mockBroadcastDiscord,
}));

import { runProposalSyncFollowUps } from '@/lib/sync/proposals-followups';

function makeSupabase(openWithId: Array<Record<string, unknown>>, openCritical: Array<Record<string, unknown>>) {
  const results = [openWithId, openCritical];
  const proposalsQuery = {
    select: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve(resolve({ data: results.shift() ?? [], error: null })),
  };
  const summaryQuery = {
    upsert: vi.fn().mockResolvedValue({ error: null }),
  };

  return {
    from: vi.fn((table: string) =>
      table === 'proposal_voting_summary' ? summaryQuery : proposalsQuery,
    ),
    proposalsQuery,
    summaryQuery,
  };
}

describe('runProposalSyncFollowUps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProposalPriority.mockReturnValue('critical');
    mockFetchProposalVotingSummary.mockResolvedValue({
      epoch_no: 321,
      drep_yes_votes_cast: 2,
      drep_active_yes_vote_power: '100',
      drep_no_votes_cast: 1,
      drep_active_no_vote_power: '50',
      drep_abstain_votes_cast: 0,
      drep_active_abstain_vote_power: '0',
      drep_always_abstain_vote_power: '0',
      drep_always_no_confidence_vote_power: '0',
      pool_yes_votes_cast: 1,
      pool_active_yes_vote_power: '25',
      pool_no_votes_cast: 0,
      pool_active_no_vote_power: '0',
      pool_abstain_votes_cast: 0,
      pool_active_abstain_vote_power: '0',
      committee_yes_votes_cast: 0,
      committee_no_votes_cast: 0,
      committee_abstain_votes_cast: 0,
    });
    mockBroadcastDiscord.mockResolvedValue(undefined);
    mockBroadcastEvent.mockResolvedValue(9);
    mockSend.mockResolvedValue({ ids: ['evt_1'] });
  });

  it('runs vote sync, summary refresh, and critical notifications for open proposals', async () => {
    const supabase = makeSupabase(
      [
        {
          tx_hash: 'tx1',
          proposal_index: 0,
          proposal_id: 'gov1',
        },
      ],
      [
        {
          tx_hash: 'tx1',
          proposal_index: 0,
          title: 'Critical proposal',
          proposal_type: 'ParameterChange',
        },
      ],
    );

    const result = await runProposalSyncFollowUps({
      supabase: supabase as never,
      openProposals: [{ txHash: 'tx1', index: 0 }],
    });

    expect(result).toEqual({
      voteSyncsTriggered: 1,
      summaryCount: 1,
      pushSent: 9,
      warnings: [],
    });
    expect(mockSend).toHaveBeenCalledWith({
      name: 'drepscore/sync.votes',
      data: {
        source: 'sync.proposals',
        openProposalCount: 1,
      },
    });
    expect(mockFetchProposalVotingSummary).toHaveBeenCalledWith('gov1');
    expect(supabase.summaryQuery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        proposal_tx_hash: 'tx1',
        proposal_index: 0,
        epoch_no: 321,
        drep_yes_vote_power: 100,
        drep_no_vote_power: 50,
      }),
      { onConflict: 'proposal_tx_hash,proposal_index' },
    );
    expect(mockBroadcastDiscord).toHaveBeenCalledTimes(1);
    expect(mockBroadcastEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'critical-proposal-open',
        metadata: { txHash: 'tx1', index: 0 },
      }),
    );
  });

  it('keeps later follow-ups running when vote sync trigger fails', async () => {
    const supabase = makeSupabase(
      [
        {
          tx_hash: 'tx2',
          proposal_index: 1,
          proposal_id: 'gov2',
        },
      ],
      [
        {
          tx_hash: 'tx2',
          proposal_index: 1,
          title: 'Critical proposal',
          proposal_type: 'ParameterChange',
        },
      ],
    );
    mockSend.mockRejectedValueOnce(new Error('inngest unavailable'));

    const result = await runProposalSyncFollowUps({
      supabase: supabase as never,
      openProposals: [{ txHash: 'tx2', index: 1 }],
    });

    expect(result.voteSyncsTriggered).toBe(0);
    expect(result.summaryCount).toBe(1);
    expect(result.pushSent).toBe(9);
    expect(result.warnings).toEqual(['Vote sync trigger: inngest unavailable']);
    expect(mockFetchProposalVotingSummary).toHaveBeenCalledWith('gov2');
    expect(mockBroadcastEvent).toHaveBeenCalledTimes(1);
  });
});

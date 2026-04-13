import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildDrepPhilosophyText,
  computeAlignmentMatchPercent,
  fetchDrepPersonalContextSeed,
  fetchGovernanceAlignmentProfile,
  fetchGovernanceDrepSnapshot,
  resolveClaimedDrepIdForWallet,
} from '@/lib/governance/drepContext';

const getDRepTreasuryTrackRecordMock = vi.fn();

vi.mock('@/lib/treasury', () => ({
  getDRepTreasuryTrackRecord: (...args: unknown[]) => getDRepTreasuryTrackRecordMock(...args),
}));

function createSupabaseStub(tableResults: Record<string, unknown>) {
  return {
    from(table: string) {
      const payload = tableResults[table];
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => Promise.resolve({ data: Array.isArray(payload) ? payload : [], error: null }),
        maybeSingle: async () => ({ data: payload ?? null, error: null }),
      };
      return chain;
    },
  };
}

describe('governance/drepContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds a normalized DRep snapshot with treasury context', async () => {
    getDRepTreasuryTrackRecordMock.mockResolvedValue({
      totalProposals: 2,
      totalAdaVotedOn: 1_500_000,
      approvedCount: 1,
      approvedAda: 1_000_000,
      opposedCount: 1,
      opposedAda: 500_000,
      abstainedCount: 0,
      accountabilityStats: { delivered: 1, partial: 0, notDelivered: 0, pending: 0 },
      judgmentScore: 80,
      votes: [],
    });

    const supabase = createSupabaseStub({
      dreps: {
        id: 'drep1xyz',
        score: 84,
        info: { name: 'Signal Steward' },
        size_tier: 'Medium',
        effective_participation: 73,
        rationale_rate: 61,
        alignment_treasury_conservative: 80,
        alignment_treasury_growth: 20,
        alignment_decentralization: 66,
        alignment_security: 59,
        alignment_innovation: 41,
        alignment_transparency: 77,
        score_momentum: 0.9,
      },
    });

    await expect(fetchGovernanceDrepSnapshot(supabase as never, 'drep1xyz')).resolves.toEqual({
      id: 'drep1xyz',
      name: 'Signal Steward',
      score: 84,
      sizeTier: 'Medium',
      effectiveParticipation: 73,
      rationaleRate: 61,
      scoreMomentum: 0.9,
      alignmentScores: {
        treasuryConservative: 80,
        treasuryGrowth: 20,
        decentralization: 66,
        security: 59,
        innovation: 41,
        transparency: 77,
      },
      treasuryTrackRecord: expect.objectContaining({
        totalProposals: 2,
        approvedAda: 1_000_000,
      }),
    });
  });

  it('returns null for a missing DRep snapshot', async () => {
    getDRepTreasuryTrackRecordMock.mockResolvedValue(null);
    const supabase = createSupabaseStub({ dreps: null });

    await expect(fetchGovernanceDrepSnapshot(supabase as never, 'missing')).resolves.toBeNull();
  });

  it('loads the viewer alignment profile from user_governance_profiles', async () => {
    const supabase = createSupabaseStub({
      user_governance_profiles: {
        personality_label: 'Balanced Steward',
        alignment_scores: {
          treasury_conservative: 75,
          treasury_growth: 25,
          decentralization: 65,
          security: 55,
          innovation: 40,
          transparency: 70,
        },
      },
    });

    await expect(fetchGovernanceAlignmentProfile(supabase as never, 'stake_test1')).resolves.toEqual({
      personalityLabel: 'Balanced Steward',
      alignmentScores: {
        treasuryConservative: 75,
        treasuryGrowth: 25,
        decentralization: 65,
        security: 55,
        innovation: 40,
        transparency: 70,
      },
    });
  });

  it('computes an alignment match percentage when viewer scores are present', () => {
    const match = computeAlignmentMatchPercent(
      {
        personalityLabel: 'Balanced Steward',
        alignmentScores: {
          treasuryConservative: 80,
          treasuryGrowth: 20,
          decentralization: 66,
          security: 59,
          innovation: 41,
          transparency: 77,
        },
      },
      {
        treasuryConservative: 80,
        treasuryGrowth: 20,
        decentralization: 66,
        security: 59,
        innovation: 41,
        transparency: 77,
      },
    );

    expect(match).toBe(100);
    expect(
      computeAlignmentMatchPercent(
        { personalityLabel: null, alignmentScores: null },
        {
          treasuryConservative: 80,
          treasuryGrowth: 20,
          decentralization: 66,
          security: 59,
          innovation: 41,
          transparency: 77,
        },
      ),
    ).toBeNull();
  });

  it('resolves a claimed DRep and builds DRep personal context from the wallet owner', async () => {
    const supabase = createSupabaseStub({
      users: { claimed_drep_id: 'drep1claimed' },
      dreps: {
        metadata: {
          objectives: 'Improve review quality',
          motivations: 'Raise constitutional literacy',
          qualifications: 'Served on 3 review panels',
        },
      },
      drep_votes: [
        { vote: 'Yes', proposals: { title: 'Treasury Blueprint' } },
        { vote: 'No', proposals: { title: 'Parameter Change 12' } },
      ],
    });

    await expect(resolveClaimedDrepIdForWallet(supabase as never, 'stake_test1')).resolves.toBe(
      'drep1claimed',
    );
    await expect(fetchDrepPersonalContextSeed(supabase as never, 'stake_test1')).resolves.toEqual({
      drepId: 'drep1claimed',
      philosophy:
        'Objectives: Improve review quality\nMotivations: Raise constitutional literacy\nQualifications: Served on 3 review panels',
      recentVotes: [
        { proposalTitle: 'Treasury Blueprint', vote: 'Yes', rationaleSnippet: null },
        { proposalTitle: 'Parameter Change 12', vote: 'No', rationaleSnippet: null },
      ],
    });
  });

  it('returns empty DRep personal context when no wallet-linked DRep exists', async () => {
    const supabase = createSupabaseStub({ users: null });

    await expect(fetchDrepPersonalContextSeed(supabase as never, 'stake_test1')).resolves.toEqual({
      drepId: null,
      philosophy: null,
      recentVotes: [],
    });
  });

  it('formats DRep philosophy text from metadata fields only', () => {
    expect(
      buildDrepPhilosophyText({
        objectives: 'Improve participation',
        motivations: 'Protect treasury discipline',
      }),
    ).toBe('Objectives: Improve participation\nMotivations: Protect treasury discipline');
    expect(buildDrepPhilosophyText(null)).toBeNull();
  });
});

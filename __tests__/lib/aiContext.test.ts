import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assemblePersonalContext, formatPersonalContext } from '@/lib/ai/context';

const getSupabaseAdminMock = vi.fn();
const fetchDrepPersonalContextSeedMock = vi.fn();
const fetchGovernanceAlignmentProfileMock = vi.fn();
const loggerErrorMock = vi.fn();

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => getSupabaseAdminMock(),
}));

vi.mock('@/lib/governance/drepContext', () => ({
  fetchDrepPersonalContextSeed: (...args: unknown[]) => fetchDrepPersonalContextSeedMock(...args),
  fetchGovernanceAlignmentProfile: (...args: unknown[]) =>
    fetchGovernanceAlignmentProfileMock(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: (...args: unknown[]) => loggerErrorMock(...args),
  },
}));

describe('ai/context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseAdminMock.mockReturnValue({});
  });

  it('assembles DRep personal context from the shared DRep context seam', async () => {
    fetchDrepPersonalContextSeedMock.mockResolvedValue({
      drepId: 'drep1claimed',
      philosophy: 'Objectives: Improve review quality',
      recentVotes: [{ proposalTitle: 'Treasury Blueprint', vote: 'Yes', rationaleSnippet: null }],
    });
    fetchGovernanceAlignmentProfileMock.mockResolvedValue({
      personalityLabel: 'Balanced Steward',
      alignmentScores: {
        treasuryConservative: 70,
        treasuryGrowth: 30,
      },
    });

    await expect(assemblePersonalContext('stake_test1', 'drep')).resolves.toEqual({
      role: 'drep',
      philosophy: 'Objectives: Improve review quality',
      recentVotes: [{ proposalTitle: 'Treasury Blueprint', vote: 'Yes', rationaleSnippet: null }],
      personalityLabel: 'Balanced Steward',
      alignmentScores: {
        treasuryConservative: 70,
        treasuryGrowth: 30,
      },
    });
  });

  it('formats the assembled personal context for prompt injection', () => {
    const formatted = formatPersonalContext({
      role: 'drep',
      philosophy: 'Objectives: Improve review quality',
      recentVotes: [{ proposalTitle: 'Treasury Blueprint', vote: 'Yes', rationaleSnippet: null }],
      personalityLabel: 'Balanced Steward',
      alignmentScores: {
        treasuryConservative: 70,
        treasuryGrowth: 30,
      },
    });

    expect(formatted).toContain('Role: DREP');
    expect(formatted).toContain('Governance Philosophy:');
    expect(formatted).toContain('Governance Personality: Balanced Steward');
    expect(formatted).toContain('Yes on "Treasury Blueprint"');
  });
});

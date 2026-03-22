import { describe, it, expect, vi } from 'vitest';

vi.mock('@/utils/display', () => ({
  isValidatedSocialLink: () => true,
}));

import {
  computeSpoDeliberationQuality,
  computeSpoVoteDiversity,
  computeSpoDissentRate,
  computeSpoTypeBreadth,
  computeCoverageEntropy,
} from '@/lib/scoring/spoDeliberationQuality';
import type { SpoDeliberationVoteData } from '@/lib/scoring/spoDeliberationQuality';

const NOW = Math.floor(Date.now() / 1000);
const ONE_DAY = 86400;

function makeDelibVote(overrides: Partial<SpoDeliberationVoteData> = {}): SpoDeliberationVoteData {
  return {
    proposalKey: 'p1',
    vote: 'Yes',
    blockTime: NOW - ONE_DAY,
    proposalBlockTime: NOW - 3 * ONE_DAY,
    proposalType: 'TreasuryWithdrawals',
    importanceWeight: 2,
    hasRationale: false,
    ...overrides,
  };
}

const ALL_TYPES = new Set([
  'TreasuryWithdrawals',
  'ParameterChange',
  'HardForkInitiation',
  'InfoAction',
  'NoConfidence',
  'NewConstitution',
]);

describe('computeSpoDeliberationQuality (V3.2)', () => {
  // ── Vote Diversity (35%) ──

  it('penalizes rubber-stamping (all Yes votes)', () => {
    const allYes = Array.from({ length: 8 }, (_, i) =>
      makeDelibVote({
        proposalKey: `p${i}`,
        vote: 'Yes',
        proposalType: [
          'TreasuryWithdrawals',
          'ParameterChange',
          'HardForkInitiation',
          'InfoAction',
        ][i % 4],
      }),
    );

    const mixed = Array.from({ length: 8 }, (_, i) =>
      makeDelibVote({
        proposalKey: `p${i}`,
        vote: i % 3 === 0 ? 'No' : 'Yes',
        proposalType: [
          'TreasuryWithdrawals',
          'ParameterChange',
          'HardForkInitiation',
          'InfoAction',
        ][i % 4],
      }),
    );

    const allYesScore = computeSpoVoteDiversity(allYes);
    const mixedScore = computeSpoVoteDiversity(mixed);
    expect(mixedScore).toBeGreaterThan(allYesScore);
  });

  it('applies abstain penalty when >60% abstain', () => {
    // 7 abstains + 1 Yes + 1 No + 1 Yes = 70% abstain
    const highAbstain = Array.from({ length: 10 }, (_, i) =>
      makeDelibVote({
        proposalKey: `p${i}`,
        vote: i < 7 ? 'Abstain' : i < 9 ? 'Yes' : 'No',
        proposalType: ['TreasuryWithdrawals', 'ParameterChange'][i % 2],
      }),
    );

    // 2 abstains + 4 Yes + 4 No = 20% abstain
    const lowAbstain = Array.from({ length: 10 }, (_, i) =>
      makeDelibVote({
        proposalKey: `p${i}`,
        vote: i < 2 ? 'Abstain' : i < 6 ? 'Yes' : 'No',
        proposalType: ['TreasuryWithdrawals', 'ParameterChange'][i % 2],
      }),
    );

    const highScore = computeSpoVoteDiversity(highAbstain);
    const lowScore = computeSpoVoteDiversity(lowAbstain);
    expect(lowScore).toBeGreaterThan(highScore);
  });

  // ── Dissent Rate (30%) ──

  it('rewards moderate dissent (15-40%)', () => {
    // 25% dissent: 2 No against Yes majority, 6 Yes
    const moderateDissent = Array.from({ length: 8 }, (_, i) =>
      makeDelibVote({
        proposalKey: `p${i}`,
        vote: i < 2 ? 'No' : 'Yes',
        spoMajorityVote: 'Yes',
        proposalType: ['TreasuryWithdrawals', 'ParameterChange'][i % 2],
      }),
    );

    // 0% dissent: all follow majority
    const zeroDissent = Array.from({ length: 8 }, (_, i) =>
      makeDelibVote({
        proposalKey: `p${i}`,
        vote: 'Yes',
        spoMajorityVote: 'Yes',
        proposalType: ['TreasuryWithdrawals', 'ParameterChange'][i % 2],
      }),
    );

    const moderateScore = computeSpoDissentRate(moderateDissent);
    const zeroScore = computeSpoDissentRate(zeroDissent);
    expect(moderateScore).toBeGreaterThan(zeroScore);
  });

  it('returns neutral 50 when majority data unavailable', () => {
    const noMajority = Array.from({ length: 8 }, (_, i) => makeDelibVote({ proposalKey: `p${i}` }));
    const score = computeSpoDissentRate(noMajority);
    expect(score).toBe(50);
  });

  // ── Type Breadth (20%) ──

  it('rewards diverse proposal type coverage', () => {
    const diverse = Array.from({ length: 8 }, (_, i) =>
      makeDelibVote({
        proposalKey: `p${i}`,
        proposalType: [...ALL_TYPES][i % ALL_TYPES.size],
      }),
    );

    const narrow = Array.from({ length: 8 }, (_, i) =>
      makeDelibVote({
        proposalKey: `p${i}`,
        proposalType: 'TreasuryWithdrawals',
      }),
    );

    expect(computeSpoTypeBreadth(diverse, ALL_TYPES)).toBeGreaterThan(
      computeSpoTypeBreadth(narrow, ALL_TYPES),
    );
  });

  // ── Coverage Entropy (15%) ──

  it('rewards balanced proposal type distribution', () => {
    // Balanced: 2 votes per type
    const balanced = Array.from({ length: 8 }, (_, i) =>
      makeDelibVote({
        proposalKey: `p${i}`,
        proposalType: [
          'TreasuryWithdrawals',
          'ParameterChange',
          'HardForkInitiation',
          'InfoAction',
        ][i % 4],
      }),
    );

    // Skewed: 7 on one type, 1 on another
    const skewed = [
      ...Array.from({ length: 7 }, (_, i) =>
        makeDelibVote({ proposalKey: `p${i}`, proposalType: 'TreasuryWithdrawals' }),
      ),
      makeDelibVote({ proposalKey: 'p7', proposalType: 'ParameterChange' }),
    ];

    expect(computeCoverageEntropy(balanced, ALL_TYPES)).toBeGreaterThan(
      computeCoverageEntropy(skewed, ALL_TYPES),
    );
  });

  // ── Composite ──

  it('returns empty map for no pools', () => {
    const result = computeSpoDeliberationQuality(new Map(), ALL_TYPES, NOW);
    expect(result.size).toBe(0);
  });

  it('produces scores in 0-100 range', () => {
    const pools = new Map<string, SpoDeliberationVoteData[]>();
    for (let p = 0; p < 5; p++) {
      pools.set(
        `pool${p}`,
        Array.from({ length: 10 }, (_, i) =>
          makeDelibVote({
            proposalKey: `p${i}`,
            vote: (['Yes', 'No', 'Yes', 'Abstain', 'No'] as const)[i % 5],
            proposalType: ['TreasuryWithdrawals', 'ParameterChange', 'HardForkInitiation'][i % 3],
            spoMajorityVote: 'Yes',
          }),
        ),
      );
    }

    const scores = computeSpoDeliberationQuality(pools, ALL_TYPES, NOW);
    for (const [, score] of scores) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

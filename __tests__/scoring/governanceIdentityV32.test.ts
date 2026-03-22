import { describe, it, expect, vi } from 'vitest';

vi.mock('@/utils/display', () => ({
  isValidatedSocialLink: (uri: string) => {
    const knownDomains = ['twitter.com', 'x.com', 'github.com', 'linkedin.com'];
    try {
      const url = new URL(uri);
      return knownDomains.some((d) => url.hostname === d || url.hostname === `www.${d}`);
    } catch {
      return false;
    }
  },
}));

import { computeGovernanceIdentity } from '@/lib/scoring/governanceIdentity';
import { computeStalenessFactor, computeDelegationHealth } from '@/lib/scoring/governanceIdentity';
import type { DelegationSnapshotData } from '@/lib/scoring/types';
import { makeProfile, makeEmptyProfile, NOW, ONE_DAY } from '../fixtures/scoring';

describe('V3.2 Governance Identity — Delegation Health', () => {
  it('uses delegation health signals when snapshot history is available', () => {
    const profile = makeProfile({
      drepId: 'drep_health',
      delegatorCount: 100,
    });

    const snapshots = new Map<string, DelegationSnapshotData>([
      [
        'drep_health',
        {
          epochs: [
            {
              epoch: 500,
              delegatorCount: 90,
              totalPowerLovelace: 5_000_000_000,
              newDelegators: 10,
              lostDelegators: 2,
            },
            {
              epoch: 501,
              delegatorCount: 95,
              totalPowerLovelace: 5_500_000_000,
              newDelegators: 8,
              lostDelegators: 3,
            },
            {
              epoch: 502,
              delegatorCount: 100,
              totalPowerLovelace: 6_000_000_000,
              newDelegators: 7,
              lostDelegators: 2,
            },
          ],
        },
      ],
    ]);

    const scores = computeGovernanceIdentity(new Map([['drep_health', profile]]), snapshots, NOW);

    // Should produce a valid score
    const score = scores.get('drep_health')!;
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('falls back to delegator count tiers when no snapshot history', () => {
    const profile = makeProfile({
      drepId: 'drep_fallback',
      delegatorCount: 100,
    });

    // No snapshots at all
    const scoresNoSnap = computeGovernanceIdentity(
      new Map([['drep_fallback', profile]]),
      undefined,
      NOW,
    );

    // Empty snapshots map
    const scoresEmptySnap = computeGovernanceIdentity(
      new Map([['drep_fallback', profile]]),
      new Map(),
      NOW,
    );

    // Both should produce the same score (fallback path)
    expect(scoresNoSnap.get('drep_fallback')).toBe(scoresEmptySnap.get('drep_fallback'));
    expect(scoresNoSnap.get('drep_fallback')!).toBeGreaterThan(0);
  });

  it('falls back when only 1 snapshot epoch exists (below minimum)', () => {
    const profile = makeProfile({
      drepId: 'drep_single',
      delegatorCount: 50,
    });

    const snapshots = new Map<string, DelegationSnapshotData>([
      [
        'drep_single',
        {
          epochs: [
            {
              epoch: 500,
              delegatorCount: 50,
              totalPowerLovelace: 2_000_000_000,
              newDelegators: null,
              lostDelegators: null,
            },
          ],
        },
      ],
    ]);

    const scoresWithSnap = computeGovernanceIdentity(
      new Map([['drep_single', profile]]),
      snapshots,
      NOW,
    );

    const scoresNoSnap = computeGovernanceIdentity(
      new Map([['drep_single', profile]]),
      undefined,
      NOW,
    );

    // Should be the same (both use fallback)
    expect(scoresWithSnap.get('drep_single')).toBe(scoresNoSnap.get('drep_single'));
  });

  it('computes delegation health correctly with full data', () => {
    const snapshot: DelegationSnapshotData = {
      epochs: [
        {
          epoch: 498,
          delegatorCount: 80,
          totalPowerLovelace: 4_000_000_000,
          newDelegators: 5,
          lostDelegators: 2,
        },
        {
          epoch: 499,
          delegatorCount: 85,
          totalPowerLovelace: 4_500_000_000,
          newDelegators: 7,
          lostDelegators: 2,
        },
        {
          epoch: 500,
          delegatorCount: 90,
          totalPowerLovelace: 5_000_000_000,
          newDelegators: 8,
          lostDelegators: 3,
        },
      ],
    };

    const score = computeDelegationHealth(snapshot, 90);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('handles 0 delegators edge case', () => {
    const profile = makeProfile({
      drepId: 'drep_zero',
      delegatorCount: 0,
    });

    const scores = computeGovernanceIdentity(new Map([['drep_zero', profile]]), undefined, NOW);

    // 0 delegators → 0 community presence
    expect(scores.get('drep_zero')!).toBeGreaterThanOrEqual(0);
  });

  it('handles single delegator edge case', () => {
    const profile = makeProfile({
      drepId: 'drep_one',
      delegatorCount: 1,
    });

    const scores = computeGovernanceIdentity(new Map([['drep_one', profile]]), undefined, NOW);

    // 1 delegator → tier score of 20, community presence = 20 * 0.4 = 8
    expect(scores.get('drep_one')!).toBeGreaterThan(0);
  });

  it('rewards high retention rate', () => {
    const highRetention: DelegationSnapshotData = {
      epochs: [
        {
          epoch: 500,
          delegatorCount: 100,
          totalPowerLovelace: 5_000_000_000,
          newDelegators: 5,
          lostDelegators: 1,
        },
        {
          epoch: 501,
          delegatorCount: 104,
          totalPowerLovelace: 5_200_000_000,
          newDelegators: 5,
          lostDelegators: 1,
        },
      ],
    };

    const lowRetention: DelegationSnapshotData = {
      epochs: [
        {
          epoch: 500,
          delegatorCount: 100,
          totalPowerLovelace: 5_000_000_000,
          newDelegators: 5,
          lostDelegators: 1,
        },
        {
          epoch: 501,
          delegatorCount: 60,
          totalPowerLovelace: 3_000_000_000,
          newDelegators: 10,
          lostDelegators: 50,
        },
      ],
    };

    const highScore = computeDelegationHealth(highRetention, 104);
    const lowScore = computeDelegationHealth(lowRetention, 60);

    expect(highScore).toBeGreaterThan(lowScore);
  });
});

describe('V3.2 Governance Identity — Profile Staleness', () => {
  it('returns 1.0x for fresh profile (0-180 days)', () => {
    const freshUpdate = NOW - 30 * ONE_DAY; // 30 days ago
    expect(computeStalenessFactor(freshUpdate, NOW)).toBe(1.0);
  });

  it('returns 1.0x at exactly 180 days', () => {
    const update = NOW - 180 * ONE_DAY;
    expect(computeStalenessFactor(update, NOW)).toBe(1.0);
  });

  it('returns ~0.75x at 270 days (midpoint of decay)', () => {
    const update = NOW - 270 * ONE_DAY;
    const factor = computeStalenessFactor(update, NOW);
    expect(factor).toBeCloseTo(0.75, 1);
  });

  it('returns 0.5x at 360+ days', () => {
    const update = NOW - 400 * ONE_DAY;
    expect(computeStalenessFactor(update, NOW)).toBe(0.5);
  });

  it('returns 0.5x at exactly 360 days', () => {
    const update = NOW - 360 * ONE_DAY;
    expect(computeStalenessFactor(update, NOW)).toBe(0.5);
  });

  it('returns 1.0x when updatedAt is null (assume fresh)', () => {
    expect(computeStalenessFactor(null, NOW)).toBe(1.0);
  });

  it('applies staleness decay to profile quality score', () => {
    const freshProfile = makeProfile({
      drepId: 'fresh',
      delegatorCount: 50,
      updatedAt: NOW - 30 * ONE_DAY, // 30 days ago
    });
    const staleProfile = makeProfile({
      drepId: 'stale',
      delegatorCount: 50,
      updatedAt: NOW - 400 * ONE_DAY, // 400 days ago
    });

    const scores = computeGovernanceIdentity(
      new Map([
        ['fresh', freshProfile],
        ['stale', staleProfile],
      ]),
      undefined,
      NOW,
    );

    // Fresh should score higher than stale (same profile content, different freshness)
    expect(scores.get('fresh')!).toBeGreaterThan(scores.get('stale')!);
  });

  it('staleness does not affect community presence, only profile quality', () => {
    const freshEmpty = makeEmptyProfile('fresh_empty');
    freshEmpty.updatedAt = NOW;

    const staleEmpty = makeEmptyProfile('stale_empty');
    staleEmpty.updatedAt = NOW - 400 * ONE_DAY;

    const scores = computeGovernanceIdentity(
      new Map([
        ['fresh_empty', freshEmpty],
        ['stale_empty', staleEmpty],
      ]),
      undefined,
      NOW,
    );

    // Both have null metadata → profile quality = 0 regardless of staleness
    // Both have 0 delegators → community presence = 0
    expect(scores.get('fresh_empty')).toBe(0);
    expect(scores.get('stale_empty')).toBe(0);
  });
});

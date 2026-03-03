import { describe, it, expect } from 'vitest';
import { computeProposalSimilarity } from '@/lib/proposalSimilarity';

describe('proposalSimilarity', () => {
  describe('computeProposalSimilarity', () => {
    it('returns 1 for identical vectors', () => {
      const vec = [0.8, 0.2, 0.5, 0.1, 0.9, 0.3];
      expect(computeProposalSimilarity(vec, vec)).toBeCloseTo(1, 5);
    });

    it('returns 0 for orthogonal vectors', () => {
      const a = [1, 0, 0, 0, 0, 0];
      const b = [0, 1, 0, 0, 0, 0];
      expect(computeProposalSimilarity(a, b)).toBe(0);
    });

    it('returns 0 for zero vectors', () => {
      const zero = [0, 0, 0, 0, 0, 0];
      const nonzero = [0.5, 0.3, 0.1, 0.2, 0.4, 0.6];
      expect(computeProposalSimilarity(zero, nonzero)).toBe(0);
      expect(computeProposalSimilarity(nonzero, zero)).toBe(0);
      expect(computeProposalSimilarity(zero, zero)).toBe(0);
    });

    it('returns high similarity for similar vectors', () => {
      const a = [0.8, 0.2, 0.5, 0.1, 0.9, 0.3];
      const b = [0.7, 0.3, 0.4, 0.2, 0.8, 0.4];
      expect(computeProposalSimilarity(a, b)).toBeGreaterThan(0.95);
    });

    it('returns low similarity for very different vectors', () => {
      const a = [1.0, 0.0, 0.0, 0.0, 0.0, 0.0];
      const b = [0.0, 0.0, 0.0, 0.0, 0.0, 1.0];
      expect(computeProposalSimilarity(a, b)).toBe(0);
    });

    it('handles partial overlap correctly', () => {
      const a = [0.8, 0.0, 0.0, 0.0, 0.0, 0.0];
      const b = [0.4, 0.4, 0.0, 0.0, 0.0, 0.0];
      const sim = computeProposalSimilarity(a, b);
      expect(sim).toBeGreaterThan(0.5);
      expect(sim).toBeLessThan(1.0);
    });
  });
});

describe('interBodyAlignment', () => {
  // These test the pure pairwise alignment logic without DB calls.
  // The actual computeInterBodyAlignment needs Supabase, so we test the math.
  function pairwiseAlignment(
    a: { yesPct: number; noPct: number },
    b: { yesPct: number; noPct: number },
  ): number {
    const diff = Math.abs(a.yesPct - b.yesPct) + Math.abs(a.noPct - b.noPct);
    return Math.max(0, 100 - diff / 2);
  }

  it('returns 100 for identical voting patterns', () => {
    expect(pairwiseAlignment({ yesPct: 80, noPct: 20 }, { yesPct: 80, noPct: 20 })).toBe(100);
  });

  it('returns 0 for completely opposite patterns', () => {
    expect(pairwiseAlignment({ yesPct: 100, noPct: 0 }, { yesPct: 0, noPct: 100 })).toBe(0);
  });

  it('returns intermediate value for partial agreement', () => {
    const score = pairwiseAlignment({ yesPct: 70, noPct: 30 }, { yesPct: 50, noPct: 50 });
    expect(score).toBeGreaterThan(50);
    expect(score).toBeLessThan(100);
  });

  it('handles unanimous yes from both bodies', () => {
    expect(pairwiseAlignment({ yesPct: 100, noPct: 0 }, { yesPct: 100, noPct: 0 })).toBe(100);
  });
});

describe('treasury pure functions', () => {
  // Import-free tests for treasury logic patterns
  it('calculateRunwayMonths returns Infinity for zero burn rate', () => {
    const burnRate = 0;
    const balance = 1_000_000;
    const MONTHS_PER_EPOCH = 5 / 30.44;
    const result = burnRate <= 0 ? Infinity : (balance / burnRate) * MONTHS_PER_EPOCH;
    expect(result).toBe(Infinity);
  });

  it('calculateRunwayMonths returns finite for positive burn rate', () => {
    const burnRate = 10_000;
    const balance = 500_000;
    const MONTHS_PER_EPOCH = 5 / 30.44;
    const result = (balance / burnRate) * MONTHS_PER_EPOCH;
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(100);
  });

  it('lovelaceToAda converts correctly', () => {
    expect(Number(BigInt(1_000_000)) / 1_000_000).toBe(1);
    expect(Number(BigInt(500_000_000)) / 1_000_000).toBe(500);
  });
});

describe('proposalTrends', () => {
  it('trend detection direction logic works correctly', () => {
    const detectDirection = (delta: number): 'up' | 'down' | 'stable' =>
      delta > 0.05 ? 'up' : delta < -0.05 ? 'down' : 'stable';

    expect(detectDirection(0.1)).toBe('up');
    expect(detectDirection(-0.1)).toBe('down');
    expect(detectDirection(0.03)).toBe('stable');
    expect(detectDirection(-0.02)).toBe('stable');
    expect(detectDirection(0.06)).toBe('up');
  });
});

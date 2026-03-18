import { describe, test, expect } from 'vitest';
import {
  computeDiscriminativePower,
  computeSpecificity,
  computeCentroid,
  computePairwiseDiversity,
} from '@/lib/embeddings/quality';
import { cosineSimilarity } from '@/lib/embeddings/query';

describe('cosineSimilarity', () => {
  test('identical vectors have similarity 1', () => {
    const a = [1, 0, 0];
    expect(cosineSimilarity(a, a)).toBeCloseTo(1, 5);
  });

  test('orthogonal vectors have similarity 0', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  test('opposite vectors have similarity -1', () => {
    const a = [1, 0, 0];
    const b = [-1, 0, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5);
  });

  test('known values', () => {
    const a = [1, 2, 3];
    const b = [4, 5, 6];
    // dot = 4+10+18 = 32, normA = sqrt(14), normB = sqrt(77)
    const expected = 32 / (Math.sqrt(14) * Math.sqrt(77));
    expect(cosineSimilarity(a, b)).toBeCloseTo(expected, 5);
  });

  test('zero vector returns 0', () => {
    const a = [0, 0, 0];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  test('throws on dimension mismatch', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow('same dimensions');
  });
});

describe('computeCentroid', () => {
  test('single vector returns itself', () => {
    const result = computeCentroid([[1, 2, 3]]);
    expect(result).toEqual([1, 2, 3]);
  });

  test('average of two vectors', () => {
    const result = computeCentroid([
      [0, 0, 4],
      [2, 4, 0],
    ]);
    expect(result).toEqual([1, 2, 2]);
  });

  test('empty input returns empty', () => {
    expect(computeCentroid([])).toEqual([]);
  });

  test('three vectors averaged correctly', () => {
    const result = computeCentroid([
      [3, 0, 0],
      [0, 3, 0],
      [0, 0, 3],
    ]);
    expect(result).toEqual([1, 1, 1]);
  });
});

describe('computeDiscriminativePower', () => {
  test('identical sample embeddings return 0', () => {
    const query = [1, 0, 0];
    const samples = [
      [0, 1, 0],
      [0, 1, 0],
      [0, 1, 0],
    ];
    expect(computeDiscriminativePower(query, samples)).toBe(0);
  });

  test('diverse samples return higher value', () => {
    const query = [1, 0, 0];
    const samples = [
      [1, 0, 0], // sim = 1
      [0, 1, 0], // sim = 0
      [-1, 0, 0], // sim = -1
    ];
    const result = computeDiscriminativePower(query, samples);
    expect(result).toBeGreaterThan(0);
  });

  test('single sample returns 0', () => {
    expect(computeDiscriminativePower([1, 0], [[0, 1]])).toBe(0);
  });

  test('empty samples return 0', () => {
    expect(computeDiscriminativePower([1, 0], [])).toBe(0);
  });
});

describe('computeSpecificity', () => {
  test('vector at centroid has low specificity', () => {
    const references = [
      [1, 1, 0],
      [1, -1, 0],
    ];
    const centroid = computeCentroid(references); // [1, 0, 0]
    const specificity = computeSpecificity(centroid, references);
    // centroid is close to [1, 0, 0], similarity to centroid should be high
    // so specificity (1 - sim) should be low
    expect(specificity).toBeLessThan(0.5);
  });

  test('vector far from centroid has higher specificity', () => {
    const references = [
      [1, 0, 0],
      [1, 0, 0],
    ];
    const farVector = [0, 0, 1]; // orthogonal to centroid
    const specificity = computeSpecificity(farVector, references);
    expect(specificity).toBeCloseTo(1, 1); // 1 - 0 = 1
  });

  test('empty references returns 0', () => {
    expect(computeSpecificity([1, 0], [])).toBe(0);
  });
});

describe('computePairwiseDiversity', () => {
  test('identical embeddings return 0', () => {
    const embeddings = [
      [1, 0, 0],
      [1, 0, 0],
      [1, 0, 0],
    ];
    expect(computePairwiseDiversity(embeddings)).toBe(0);
  });

  test('orthogonal embeddings return 1', () => {
    const embeddings = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    // Each pair has cos_sim = 0, so distance = 1 - 0 = 1
    expect(computePairwiseDiversity(embeddings)).toBeCloseTo(1, 5);
  });

  test('single embedding returns 0', () => {
    expect(computePairwiseDiversity([[1, 2, 3]])).toBe(0);
  });

  test('empty input returns 0', () => {
    expect(computePairwiseDiversity([])).toBe(0);
  });

  test('mixed similarities return intermediate value', () => {
    const embeddings = [
      [1, 0, 0],
      [1, 0, 0], // identical to first
      [0, 1, 0], // orthogonal
    ];
    // Pairs: (0,1)=0, (0,2)=1, (1,2)=1 -> avg = 2/3
    const result = computePairwiseDiversity(embeddings);
    expect(result).toBeCloseTo(2 / 3, 5);
  });
});

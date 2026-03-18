/**
 * Quality and analysis functions for embedding vectors.
 * Used by scoring models and anti-gaming detection.
 */

import { cosineSimilarity } from './query';

/**
 * Compute discriminative power of a query embedding against a sample of entity embeddings.
 * High variance = more discriminative (can distinguish between entities).
 */
export function computeDiscriminativePower(
  queryEmbedding: number[],
  sampleEmbeddings: number[][],
): number {
  if (sampleEmbeddings.length < 2) return 0;

  const similarities = sampleEmbeddings.map((e) => cosineSimilarity(queryEmbedding, e));
  const mean = similarities.reduce((a, b) => a + b, 0) / similarities.length;
  const variance = similarities.reduce((sum, s) => sum + (s - mean) ** 2, 0) / similarities.length;

  // Normalize to 0-1 range (typical variance for cosine similarities is 0-0.1)
  return Math.min(variance * 10, 1);
}

/**
 * Compute specificity: how far an embedding deviates from the centroid of a set.
 * Higher = more specific/unique positioning.
 */
export function computeSpecificity(embedding: number[], referenceEmbeddings: number[][]): number {
  if (referenceEmbeddings.length === 0) return 0;

  const centroid = computeCentroid(referenceEmbeddings);
  const similarity = cosineSimilarity(embedding, centroid);

  // Invert: closer to centroid = less specific
  return 1 - similarity;
}

/**
 * Compute the centroid (mean) of a set of embeddings.
 */
export function computeCentroid(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return [];

  const dims = embeddings[0].length;
  const centroid = new Array<number>(dims).fill(0);

  for (const embedding of embeddings) {
    for (let i = 0; i < dims; i++) {
      centroid[i] += embedding[i];
    }
  }

  for (let i = 0; i < dims; i++) {
    centroid[i] /= embeddings.length;
  }

  return centroid;
}

/**
 * Compute pairwise diversity: average distance between all pairs in a set.
 * Higher = more diverse perspectives.
 */
export function computePairwiseDiversity(embeddings: number[][]): number {
  if (embeddings.length < 2) return 0;

  let totalDistance = 0;
  let pairs = 0;

  for (let i = 0; i < embeddings.length; i++) {
    for (let j = i + 1; j < embeddings.length; j++) {
      totalDistance += 1 - cosineSimilarity(embeddings[i], embeddings[j]);
      pairs++;
    }
  }

  return pairs > 0 ? totalDistance / pairs : 0;
}

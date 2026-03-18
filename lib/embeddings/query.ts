/**
 * Semantic search and query functions for the embedding store.
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import type { EmbeddingEntityType, SemanticSearchResult } from './types';
import { generateEmbedding } from './provider';

/**
 * Search for similar entities using text query -> embedding -> vector similarity.
 */
export async function semanticSearch(
  queryText: string,
  entityType: EmbeddingEntityType,
  options: {
    threshold?: number;
    limit?: number;
    filterMetadata?: Record<string, unknown>;
  } = {},
): Promise<SemanticSearchResult[]> {
  const { threshold = 0.5, limit = 10, filterMetadata } = options;

  const queryEmbedding = await generateEmbedding(queryText);

  return semanticSearchByVector(queryEmbedding, entityType, {
    threshold,
    limit,
    filterMetadata,
  });
}

/**
 * Search using a pre-computed embedding vector (avoids re-embedding).
 */
export async function semanticSearchByVector(
  queryEmbedding: number[],
  entityType: EmbeddingEntityType,
  options: {
    threshold?: number;
    limit?: number;
    filterMetadata?: Record<string, unknown>;
  } = {},
): Promise<SemanticSearchResult[]> {
  const { threshold = 0.5, limit = 10, filterMetadata } = options;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.rpc('match_embeddings', {
    query_embedding: JSON.stringify(queryEmbedding),
    match_entity_type: entityType,
    match_threshold: threshold,
    match_count: limit,
    filter_metadata: filterMetadata ?? null,
  });

  if (error) throw new Error(`Semantic search failed: ${error.message}`);

  return (data ?? []) as SemanticSearchResult[];
}

/**
 * Get the stored embedding vector for a specific entity.
 */
export async function getEntityEmbedding(
  entityType: EmbeddingEntityType,
  entityId: string,
  secondaryId?: string,
): Promise<number[] | null> {
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from('embeddings')
    .select('embedding')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);

  if (secondaryId) {
    query = query.eq('secondary_id', secondaryId);
  } else {
    query = query.is('secondary_id', null);
  }

  const { data } = await query.single();
  return (data?.embedding as unknown as number[]) ?? null;
}

/**
 * Compute cosine similarity between two embedding vectors (client-side).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('Vectors must have same dimensions');
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Hybrid search combining semantic similarity with structured scoring.
 * Merges vector search results with pre-computed structured scores
 * using a weighted linear combination.
 */
export async function hybridSearch(
  queryText: string,
  entityType: EmbeddingEntityType,
  structuredResults: { entityId: string; score: number }[],
  options: {
    semanticWeight?: number;
    threshold?: number;
    limit?: number;
  } = {},
): Promise<{ entityId: string; score: number; semanticScore: number; structuredScore: number }[]> {
  const { semanticWeight = 0.5, threshold = 0.3, limit = 10 } = options;
  const structuredWeight = 1 - semanticWeight;

  // Get semantic results
  const semanticResults = await semanticSearch(queryText, entityType, {
    threshold,
    limit: limit * 2, // fetch more to improve overlap
  });

  const semanticMap = new Map(semanticResults.map((r) => [r.entity_id, r.similarity]));
  const structuredMap = new Map(structuredResults.map((r) => [r.entityId, r.score]));

  // Merge all entity IDs
  const allIds = new Set([...semanticMap.keys(), ...structuredMap.keys()]);

  const merged = [...allIds].map((entityId) => {
    const semanticScore = semanticMap.get(entityId) ?? 0;
    const structuredScore = structuredMap.get(entityId) ?? 0;
    return {
      entityId,
      score: semanticWeight * semanticScore + structuredWeight * structuredScore,
      semanticScore,
      structuredScore,
    };
  });

  return merged.sort((a, b) => b.score - a.score).slice(0, limit);
}

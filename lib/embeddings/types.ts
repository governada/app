export type EmbeddingEntityType =
  | 'proposal'
  | 'rationale'
  | 'drep_profile'
  | 'user_preference'
  | 'proposal_draft'
  | 'review_annotation';

export interface EmbeddingRow {
  id: number;
  entity_type: EmbeddingEntityType;
  entity_id: string;
  secondary_id: string | null;
  embedding: number[];
  content_hash: string;
  model: string;
  dimensions: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SemanticSearchResult {
  id: number;
  entity_type: EmbeddingEntityType;
  entity_id: string;
  secondary_id: string | null;
  similarity: number;
  metadata: Record<string, unknown>;
}

export interface EmbeddingProviderConfig {
  model: string;
  dimensions: number;
  batchSize: number;
}

export const DEFAULT_CONFIG: EmbeddingProviderConfig = {
  model: 'text-embedding-3-large',
  // pgvector HNSW index max = 2000 dims. text-embedding-3-large supports
  // 1536 via Matryoshka truncation — same model, no quality loss at <10K rows.
  dimensions: 1536,
  batchSize: 100,
};

export interface ComposedDocument {
  entityType: EmbeddingEntityType;
  entityId: string;
  secondaryId?: string;
  text: string;
  contentHash: string;
  metadata?: Record<string, unknown>;
}

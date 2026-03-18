// Public API for the embeddings module
export type {
  EmbeddingEntityType,
  EmbeddingRow,
  SemanticSearchResult,
  EmbeddingProviderConfig,
  ComposedDocument,
} from './types';

export { DEFAULT_CONFIG } from './types';

export { generateEmbedding, generateEmbeddings } from './provider';

export {
  composeProposal,
  composeRationale,
  composeDrepProfile,
  composeUserPreference,
  composeProposalDraft,
  composeReviewAnnotation,
} from './compose';

export { generateAndStoreEmbeddings } from './generate';

export {
  semanticSearch,
  semanticSearchByVector,
  getEntityEmbedding,
  cosineSimilarity,
  hybridSearch,
} from './query';

export {
  computeDiscriminativePower,
  computeSpecificity,
  computeCentroid,
  computePairwiseDiversity,
} from './quality';

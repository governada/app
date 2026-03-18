/**
 * Embedding provider using OpenAI text-embedding-3-large.
 *
 * Mirrors the pattern from lib/ai/provider.ts:
 * - Singleton client with lazy init
 * - Graceful error handling
 * - Batch support
 */

import OpenAI from 'openai';
import { DEFAULT_CONFIG, type EmbeddingProviderConfig } from './types';
import { logger } from '@/lib/logger';

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * Generate a single embedding vector for the given text.
 */
export async function generateEmbedding(
  text: string,
  config: EmbeddingProviderConfig = DEFAULT_CONFIG,
): Promise<number[]> {
  const client = getClient();
  const response = await client.embeddings.create({
    model: config.model,
    input: text,
    dimensions: config.dimensions,
  });
  return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in a single API call.
 * OpenAI supports batch embedding natively; results are sorted by index.
 */
export async function generateEmbeddings(
  texts: string[],
  config: EmbeddingProviderConfig = DEFAULT_CONFIG,
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const client = getClient();

  // Process in batches to stay within API limits
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += config.batchSize) {
    const batch = texts.slice(i, i + config.batchSize);

    try {
      const response = await client.embeddings.create({
        model: config.model,
        input: batch,
        dimensions: config.dimensions,
      });

      // Sort by index to maintain order within batch
      const sorted = response.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
      results.push(...sorted);
    } catch (err) {
      logger.error('[Embeddings] Batch embedding failed', {
        error: err,
        batchStart: i,
        batchSize: batch.length,
      });
      throw err;
    }
  }

  return results;
}

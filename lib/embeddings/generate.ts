/**
 * Batch embedding generation with staleness detection.
 * Compares content hashes to skip unchanged entities.
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { ComposedDocument } from './types';
import { generateEmbeddings } from './provider';

/**
 * Store embeddings for composed documents, skipping unchanged ones.
 * Returns count of newly generated embeddings.
 */
export async function generateAndStoreEmbeddings(documents: ComposedDocument[]): Promise<number> {
  if (documents.length === 0) return 0;

  const supabase = getSupabaseAdmin();

  // Fetch existing embeddings for these entities to check content hashes
  const { data: existing } = await supabase
    .from('embeddings')
    .select('entity_type, entity_id, secondary_id, content_hash')
    .in('entity_type', [...new Set(documents.map((d) => d.entityType))])
    .in('entity_id', [...new Set(documents.map((d) => d.entityId))]);

  const existingMap = new Map(
    (existing ?? []).map((e) => [
      `${e.entity_type}:${e.entity_id}:${e.secondary_id ?? ''}`,
      e.content_hash,
    ]),
  );

  // Filter to only stale/new documents
  const staleDocuments = documents.filter((d) => {
    const key = `${d.entityType}:${d.entityId}:${d.secondaryId ?? ''}`;
    return existingMap.get(key) !== d.contentHash;
  });

  if (staleDocuments.length === 0) return 0;

  logger.info('[Embeddings] Generating embeddings', {
    total: documents.length,
    stale: staleDocuments.length,
    skipped: documents.length - staleDocuments.length,
  });

  // Generate embeddings in batches of 100
  const BATCH_SIZE = 100;
  let generated = 0;

  for (let i = 0; i < staleDocuments.length; i += BATCH_SIZE) {
    const batch = staleDocuments.slice(i, i + BATCH_SIZE);
    const texts = batch.map((d) => d.text);
    const embeddings = await generateEmbeddings(texts);

    // Upsert each embedding
    for (let j = 0; j < batch.length; j++) {
      const doc = batch[j];
      const row = {
        entity_type: doc.entityType,
        entity_id: doc.entityId,
        secondary_id: doc.secondaryId ?? null,
        embedding: JSON.stringify(embeddings[j]),
        content_hash: doc.contentHash,
        model: 'text-embedding-3-large',
        dimensions: 3072,
        metadata: doc.metadata ?? {},
        updated_at: new Date().toISOString(),
      };

      // Partial unique indexes can't be used with onConflict in Supabase,
      // so we use delete + insert for reliable upserts.
      if (row.secondary_id) {
        await supabase
          .from('embeddings')
          .delete()
          .eq('entity_type', row.entity_type)
          .eq('entity_id', row.entity_id)
          .eq('secondary_id', row.secondary_id);
      } else {
        await supabase
          .from('embeddings')
          .delete()
          .eq('entity_type', row.entity_type)
          .eq('entity_id', row.entity_id)
          .is('secondary_id', null);
      }

      const { error } = await supabase.from('embeddings').insert(row);
      if (error) {
        logger.error('[Embeddings] Insert failed', {
          error: error.message,
          entityType: doc.entityType,
          entityId: doc.entityId,
        });
      }
    }

    generated += batch.length;
  }

  logger.info('[Embeddings] Generation complete', { generated });
  return generated;
}

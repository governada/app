/**
 * Batch Embedding Generation — Inngest cron function.
 *
 * Runs every 6 hours. Generates embeddings for:
 * 1. Proposals (title + abstract + type + AI summary)
 * 2. Rationales (vote direction + rationale text + context)
 * 3. DRep profiles (objectives + motivations + alignment + sample rationales)
 *
 * Then precomputes proposal-proposal similarity cache (top 5 per proposal).
 *
 * Gated behind `semantic_embeddings` feature flag.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getFeatureFlag } from '@/lib/featureFlags';
import { logger } from '@/lib/logger';
import { composeProposal, composeRationale, composeDrepProfile } from '@/lib/embeddings/compose';
import { generateAndStoreEmbeddings } from '@/lib/embeddings/generate';

export const generateEmbeddings = inngest.createFunction(
  {
    id: 'generate-embeddings',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"embeddings"' },
  },
  { cron: '0 */6 * * *' },
  async ({ step }) => {
    // Step 1: Check feature flag
    const enabled = await step.run('check-flag', async () => {
      return getFeatureFlag('semantic_embeddings', false);
    });

    if (!enabled) return { skipped: true, reason: 'feature flag disabled' };

    // Step 2: Generate proposal embeddings
    const proposalResult = await step.run('embed-proposals', async () => {
      const supabase = getSupabaseAdmin();

      const { data: proposals } = await supabase
        .from('proposals')
        .select('tx_hash, index, title, abstract, proposal_type, ai_summary')
        .not('title', 'is', null)
        .limit(500);

      if (!proposals?.length) return { generated: 0, total: 0 };

      const documents = proposals
        .map((p) =>
          composeProposal({
            tx_hash: p.tx_hash,
            index: p.index,
            title: p.title,
            abstract: p.abstract,
            proposal_type: p.proposal_type,
            ai_summary: p.ai_summary,
          }),
        )
        .filter((d) => d.text.length > 20);

      const generated = await generateAndStoreEmbeddings(documents);
      return { generated, total: documents.length };
    });

    // Step 3: Generate rationale embeddings
    const rationaleResult = await step.run('embed-rationales', async () => {
      const supabase = getSupabaseAdmin();

      // Get rationales with their vote context
      const { data: rationales } = await supabase
        .from('vote_rationales')
        .select(
          `
          vote_tx_hash,
          voter_id,
          rationale_text,
          drep_votes!inner(
            proposal_tx_hash,
            proposal_index,
            vote,
            proposals!inner(title, proposal_type)
          )
        `,
        )
        .not('rationale_text', 'is', null)
        .limit(1000);

      if (!rationales?.length) return { generated: 0, total: 0 };

      // Get DRep names for context
      const voterIds = [...new Set(rationales.map((r) => r.voter_id))];
      const { data: dreps } = await supabase.from('dreps').select('id, name').in('id', voterIds);

      const drepNameMap = new Map((dreps ?? []).map((d) => [d.id, d.name]));

      const documents = rationales
        .map((r) => {
          // drep_votes is returned as an array from the join
          const vote = Array.isArray(r.drep_votes) ? r.drep_votes[0] : r.drep_votes;
          if (!vote) return null;

          const proposal = Array.isArray(vote.proposals) ? vote.proposals[0] : vote.proposals;

          return composeRationale({
            tx_hash: r.vote_tx_hash,
            index: vote.proposal_index ?? 0,
            voter_id: r.voter_id,
            rationale_text: r.rationale_text,
            vote_direction: vote.vote,
            proposal_title: proposal?.title ?? null,
            proposal_type: proposal?.proposal_type ?? null,
            drep_name: drepNameMap.get(r.voter_id) ?? null,
          });
        })
        .filter((d): d is NonNullable<typeof d> => d !== null && d.text.length > 20);

      const generated = await generateAndStoreEmbeddings(documents);
      return { generated, total: documents.length };
    });

    // Step 4: Generate DRep profile embeddings
    const drepResult = await step.run('embed-drep-profiles', async () => {
      const supabase = getSupabaseAdmin();

      const { data: dreps } = await supabase
        .from('dreps')
        .select('id, name, objectives, motivations, alignment_narrative, personality_label')
        .or('objectives.not.is.null,motivations.not.is.null')
        .limit(500);

      if (!dreps?.length) return { generated: 0, total: 0 };

      const documents = dreps
        .map((d) =>
          composeDrepProfile({
            drep_id: d.id,
            name: d.name,
            objectives: d.objectives,
            motivations: d.motivations,
            alignment_narrative: d.alignment_narrative,
            personality_label: d.personality_label,
          }),
        )
        .filter((d) => d.text.length > 20);

      const generated = await generateAndStoreEmbeddings(documents);
      return { generated, total: documents.length };
    });

    // Step 5: Precompute proposal-proposal similarity cache
    const cacheResult = await step.run('precompute-similarity-cache', async () => {
      const supabase = getSupabaseAdmin();

      // Get all proposal embeddings
      const { data: proposalEmbeddings } = await supabase
        .from('embeddings')
        .select('entity_id, embedding')
        .eq('entity_type', 'proposal')
        .limit(500);

      if (!proposalEmbeddings?.length || proposalEmbeddings.length < 2) {
        return { cached: 0 };
      }

      let cached = 0;

      // For each proposal, find top 5 most similar proposals via RPC
      for (const pe of proposalEmbeddings) {
        const { data: similar } = await supabase.rpc('match_embeddings', {
          query_embedding: pe.embedding,
          match_entity_type: 'proposal',
          match_threshold: 0.3,
          match_count: 6, // +1 because it includes itself
          filter_metadata: null,
        });

        if (!similar?.length) continue;

        // Filter out self-match and take top 5
        const matches = similar
          .filter((s: { entity_id: string }) => s.entity_id !== pe.entity_id)
          .slice(0, 5);

        for (const match of matches) {
          const row = {
            source_entity_type: 'proposal',
            source_entity_id: pe.entity_id,
            target_entity_type: 'proposal',
            target_entity_id: match.entity_id,
            similarity: match.similarity,
            computed_at: new Date().toISOString(),
          };

          // Upsert (the table has a unique constraint)
          await supabase.from('semantic_similarity_cache').upsert(row, {
            onConflict: 'source_entity_type,source_entity_id,target_entity_type,target_entity_id',
          });
          cached++;
        }
      }

      return { cached };
    });

    logger.info('[generate-embeddings] Batch complete', {
      proposals: proposalResult,
      rationales: rationaleResult,
      dreps: drepResult,
      cache: cacheResult,
    });

    return {
      proposals: proposalResult,
      rationales: rationaleResult,
      dreps: drepResult,
      cache: cacheResult,
    };
  },
);

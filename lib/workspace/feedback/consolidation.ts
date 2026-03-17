/**
 * Feedback Consolidation Engine
 *
 * Fetches all public annotations for a proposal and clusters them
 * into semantic themes using AI. Generates distilled summaries,
 * selects key voices, and upserts results to the
 * proposal_feedback_themes table.
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { generateJSON } from '@/lib/ai';
import { logger } from '@/lib/logger';

const log = logger.withContext('FeedbackConsolidation');

/** Minimum annotations required before clustering is worthwhile */
const MIN_ANNOTATIONS_FOR_CLUSTERING = 3;

interface AnnotationRow {
  id: string;
  user_id: string;
  annotation_text: string;
  created_at: string;
}

interface AIThemeCluster {
  summary: string;
  category: 'concern' | 'support' | 'question' | 'suggestion';
  annotationIds: string[];
  keyVoiceIds: string[];
}

interface ClusteringResult {
  themes: AIThemeCluster[];
}

/**
 * Consolidate all public annotations for a proposal into feedback themes.
 *
 * 1. Fetch all public annotations
 * 2. If fewer than MIN_ANNOTATIONS_FOR_CLUSTERING, create one theme per annotation
 * 3. Otherwise, send to Claude for semantic clustering
 * 4. For each cluster: generate summary, select key voices, count endorsements
 * 5. Upsert to proposal_feedback_themes
 */
export async function consolidateFeedback(
  proposalTxHash: string,
  proposalIndex: number,
): Promise<{ status: string; themeCount: number }> {
  const supabase = getSupabaseAdmin();

  // 1. Fetch all public annotations for this proposal
  const { data: annotations, error: fetchError } = await supabase
    .from('proposal_annotations')
    .select('id, user_id, annotation_text, created_at')
    .eq('proposal_tx_hash', proposalTxHash)
    .eq('proposal_index', proposalIndex)
    .eq('is_public', true)
    .order('created_at', { ascending: true });

  if (fetchError) {
    log.error('Failed to fetch annotations', {
      proposalTxHash,
      proposalIndex,
      error: fetchError,
    });
    return { status: 'error', themeCount: 0 };
  }

  const rows = (annotations ?? []) as AnnotationRow[];

  if (rows.length === 0) {
    log.info('No public annotations to consolidate', { proposalTxHash, proposalIndex });
    return { status: 'skipped', themeCount: 0 };
  }

  // 2. Handle small annotation counts: each is its own theme
  if (rows.length < MIN_ANNOTATIONS_FOR_CLUSTERING) {
    const themes = rows.map((row) => ({
      summary: row.annotation_text.slice(0, 300),
      category: inferCategoryFromText(row.annotation_text),
      annotationIds: [row.id],
      keyVoiceIds: [row.id],
    }));

    await upsertThemes(supabase, proposalTxHash, proposalIndex, themes, rows);
    log.info('Created individual themes (below clustering threshold)', {
      proposalTxHash,
      proposalIndex,
      count: themes.length,
    });
    return { status: 'individual', themeCount: themes.length };
  }

  // 3. Use AI to cluster annotations
  const prompt = buildClusteringPrompt(rows);

  const aiResult = await generateJSON<ClusteringResult>(prompt, {
    model: 'FAST',
    maxTokens: 2048,
    system: `You are a governance feedback analyst for the Cardano blockchain. Your job is to cluster reviewer comments into meaningful themes. Be precise with annotation IDs — only use IDs from the provided list. Always return valid JSON.`,
  });

  if (!aiResult || !aiResult.themes || aiResult.themes.length === 0) {
    log.warn('AI returned no themes, falling back to individual themes', {
      proposalTxHash,
      proposalIndex,
    });
    // Fallback: each annotation is its own theme
    const fallbackThemes = rows.map((row) => ({
      summary: row.annotation_text.slice(0, 300),
      category: inferCategoryFromText(row.annotation_text),
      annotationIds: [row.id],
      keyVoiceIds: [row.id],
    }));
    await upsertThemes(supabase, proposalTxHash, proposalIndex, fallbackThemes, rows);
    return { status: 'fallback', themeCount: fallbackThemes.length };
  }

  // 4. Validate AI output — ensure annotation IDs are real
  const validIds = new Set(rows.map((r) => r.id));
  const validatedThemes = aiResult.themes
    .map((theme) => ({
      ...theme,
      annotationIds: theme.annotationIds.filter((id) => validIds.has(id)),
      keyVoiceIds: theme.keyVoiceIds.filter((id) => validIds.has(id)),
    }))
    .filter((theme) => theme.annotationIds.length > 0);

  if (validatedThemes.length === 0) {
    log.warn('No valid themes after ID validation', { proposalTxHash, proposalIndex });
    return { status: 'error', themeCount: 0 };
  }

  // 5. Upsert themes
  await upsertThemes(supabase, proposalTxHash, proposalIndex, validatedThemes, rows);

  log.info('Feedback consolidated', {
    proposalTxHash,
    proposalIndex,
    themeCount: validatedThemes.length,
    annotationCount: rows.length,
  });

  return { status: 'consolidated', themeCount: validatedThemes.length };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildClusteringPrompt(rows: AnnotationRow[]): string {
  const annotationList = rows
    .map((row, i) => `[${i + 1}] ID="${row.id}"\n${row.annotation_text}`)
    .join('\n\n');

  return `Group these ${rows.length} review comments on a governance proposal into 2-7 themes based on semantic similarity.

For each theme provide:
- summary: A concise 1-3 sentence summary of the shared concern/point
- category: One of "concern", "support", "question", "suggestion"
- annotationIds: Array of the ID strings for annotations in this cluster
- keyVoiceIds: 2-3 IDs of the most articulate/representative annotations

If all annotations are unique with no overlap, each can be its own theme.

Return JSON in this exact format:
{
  "themes": [
    {
      "summary": "...",
      "category": "concern",
      "annotationIds": ["id1", "id2"],
      "keyVoiceIds": ["id1"]
    }
  ]
}

Here are the annotations:

${annotationList}`;
}

/**
 * Simple heuristic category inference for cases where AI is not used
 * (e.g., fewer than 3 annotations).
 */
function inferCategoryFromText(text: string): 'concern' | 'support' | 'question' | 'suggestion' {
  const lower = text.toLowerCase();
  if (lower.includes('?') || lower.includes('how') || lower.includes('why')) {
    return 'question';
  }
  if (
    lower.includes('concern') ||
    lower.includes('risk') ||
    lower.includes('problem') ||
    lower.includes('issue')
  ) {
    return 'concern';
  }
  if (
    lower.includes('suggest') ||
    lower.includes('should') ||
    lower.includes('recommend') ||
    lower.includes('consider')
  ) {
    return 'suggestion';
  }
  if (
    lower.includes('support') ||
    lower.includes('agree') ||
    lower.includes('strong') ||
    lower.includes('well')
  ) {
    return 'support';
  }
  return 'concern'; // default
}

interface KeyVoice {
  reviewerId: string;
  text: string;
  timestamp: string;
}

/**
 * Upsert themes to the database. Deletes existing themes for this proposal
 * and re-creates them from the clustering result.
 */
async function upsertThemes(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  proposalTxHash: string,
  proposalIndex: number,
  themes: AIThemeCluster[],
  allAnnotations: AnnotationRow[],
): Promise<void> {
  const annotationMap = new Map(allAnnotations.map((a) => [a.id, a]));

  // Delete existing themes for this proposal (full reconsolidation)
  const { error: deleteError } = await supabase
    .from('proposal_feedback_themes')
    .delete()
    .eq('proposal_tx_hash', proposalTxHash)
    .eq('proposal_index', proposalIndex);

  if (deleteError) {
    log.error('Failed to delete old themes', { error: deleteError });
    // Continue anyway — inserts might still work
  }

  // Fetch existing endorsement counts per theme (carry forward)
  // Since we deleted themes, endorsements cascade; new themes start at 0

  const now = new Date().toISOString();

  for (const theme of themes) {
    // Build key voices from the annotation data
    const keyVoices: KeyVoice[] = theme.keyVoiceIds
      .map((id) => {
        const ann = annotationMap.get(id);
        if (!ann) return null;
        return {
          reviewerId: ann.user_id,
          text: ann.annotation_text.slice(0, 500),
          timestamp: ann.created_at,
        };
      })
      .filter((v): v is KeyVoice => v !== null);

    const { error: insertError } = await supabase.from('proposal_feedback_themes').insert({
      proposal_tx_hash: proposalTxHash,
      proposal_index: proposalIndex,
      theme_summary: theme.summary,
      theme_category: theme.category,
      endorsement_count: theme.annotationIds.length,
      key_voices: keyVoices,
      novel_contributions: [],
      linked_annotation_ids: theme.annotationIds,
      addressed_status: 'open',
      addressed_reason: null,
      created_at: now,
      updated_at: now,
    });

    if (insertError) {
      log.error('Failed to insert theme', {
        proposalTxHash,
        proposalIndex,
        summary: theme.summary.slice(0, 80),
        error: insertError,
      });
    }
  }
}

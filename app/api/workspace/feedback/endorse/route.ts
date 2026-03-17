/**
 * Feedback Theme Endorsement API
 *
 * POST: Endorse a feedback theme (+1), optionally with additional context.
 *       Runs novelty check on additional context if provided.
 *       Prevents duplicate endorsements (same user + theme).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { classifyNovelty } from '@/lib/workspace/feedback/novelty';
import type { FeedbackTheme } from '@/lib/workspace/feedback/types';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const EndorseSchema = z.object({
  themeId: z.string().uuid(),
  additionalContext: z.string().max(2000).optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ThemeRow {
  id: string;
  proposal_tx_hash: string;
  proposal_index: number;
  theme_summary: string;
  theme_category: string;
  endorsement_count: number;
  key_voices: unknown;
  novel_contributions: unknown;
  addressed_status: string;
  addressed_reason: string | null;
  linked_annotation_ids: unknown;
}

function rowToFeedbackTheme(row: ThemeRow): FeedbackTheme {
  return {
    id: row.id,
    summary: row.theme_summary,
    category: row.theme_category as FeedbackTheme['category'],
    endorsementCount: row.endorsement_count ?? 0,
    keyVoices: (row.key_voices as FeedbackTheme['keyVoices']) ?? [],
    novelContributions: (row.novel_contributions as FeedbackTheme['novelContributions']) ?? [],
    addressedStatus: row.addressed_status as FeedbackTheme['addressedStatus'],
    addressedReason: row.addressed_reason ?? undefined,
    linkedAnnotationIds: (row.linked_annotation_ids as string[]) ?? [],
  };
}

// ---------------------------------------------------------------------------
// POST — endorse a theme
// ---------------------------------------------------------------------------

export const POST = withRouteHandler(
  async (request, ctx) => {
    const userId = ctx.userId;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = EndorseSchema.parse(body);
    const supabase = getSupabaseAdmin();

    // Check the theme exists
    const { data: themeRow, error: themeError } = await supabase
      .from('proposal_feedback_themes')
      .select('*')
      .eq('id', parsed.themeId)
      .maybeSingle();

    if (themeError || !themeRow) {
      return NextResponse.json({ error: 'Theme not found' }, { status: 404 });
    }

    // Check for duplicate endorsement
    const { count: existingCount } = await supabase
      .from('proposal_theme_endorsements')
      .select('id', { count: 'exact', head: true })
      .eq('theme_id', parsed.themeId)
      .eq('reviewer_user_id', userId);

    if (existingCount && existingCount > 0) {
      return NextResponse.json({ error: 'Already endorsed this theme' }, { status: 409 });
    }

    // If additional context provided, check novelty
    let isNovel = false;
    if (parsed.additionalContext && parsed.additionalContext.trim().length > 0) {
      // Fetch all themes for this proposal to check novelty against
      const typedRow = themeRow as unknown as ThemeRow;
      const { data: allThemeRows } = await supabase
        .from('proposal_feedback_themes')
        .select('*')
        .eq('proposal_tx_hash', typedRow.proposal_tx_hash)
        .eq('proposal_index', typedRow.proposal_index);

      const allThemes = (allThemeRows ?? []).map((r) =>
        rowToFeedbackTheme(r as unknown as ThemeRow),
      );
      const noveltyResult = await classifyNovelty(parsed.additionalContext, allThemes);
      isNovel = noveltyResult.isNovel;
    }

    // Insert endorsement
    const { error: insertError } = await supabase.from('proposal_theme_endorsements').insert({
      theme_id: parsed.themeId,
      reviewer_user_id: userId,
      additional_context: parsed.additionalContext ?? null,
      is_novel: isNovel,
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      return NextResponse.json({ error: 'Failed to create endorsement' }, { status: 500 });
    }

    // Increment endorsement count on the theme
    const typedRow = themeRow as unknown as ThemeRow;
    const newCount = (typedRow.endorsement_count ?? 0) + 1;

    // If novel contribution, add to the theme's novel_contributions array
    const updates: Record<string, unknown> = {
      endorsement_count: newCount,
      updated_at: new Date().toISOString(),
    };

    if (isNovel && parsed.additionalContext) {
      const currentNovel =
        (typedRow.novel_contributions as FeedbackTheme['novelContributions']) ?? [];
      updates.novel_contributions = [
        ...currentNovel,
        {
          reviewerId: userId,
          text: parsed.additionalContext.slice(0, 500),
          timestamp: new Date().toISOString(),
        },
      ];
    }

    await supabase.from('proposal_feedback_themes').update(updates).eq('id', parsed.themeId);

    return NextResponse.json({
      endorsed: true,
      isNovel,
      newEndorsementCount: newCount,
    });
  },
  { auth: 'required', rateLimit: { max: 30, window: 60 } },
);

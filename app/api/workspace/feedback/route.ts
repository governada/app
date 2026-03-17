/**
 * Feedback Themes API — consolidated community feedback for proposals.
 *
 * GET: Returns FeedbackTheme[] for a proposal, respecting sealed period.
 */

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { FeedbackTheme } from '@/lib/workspace/feedback/types';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default sealed period: 48 hours from community_review_started_at */
const DEFAULT_SEALED_HOURS = 48;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ThemeRow {
  id: string;
  theme_summary: string;
  theme_category: string;
  endorsement_count: number;
  key_voices: unknown;
  novel_contributions: unknown;
  addressed_status: string;
  addressed_reason: string | null;
  linked_annotation_ids: unknown;
  created_at: string;
  updated_at: string;
}

interface KeyVoice {
  reviewerId: string;
  text: string;
  timestamp: string;
}

interface NovelContribution {
  reviewerId: string;
  text: string;
  timestamp: string;
}

function rowToTheme(row: ThemeRow): FeedbackTheme {
  return {
    id: row.id,
    summary: row.theme_summary,
    category: row.theme_category as FeedbackTheme['category'],
    endorsementCount: row.endorsement_count ?? 0,
    keyVoices: (row.key_voices as KeyVoice[]) ?? [],
    novelContributions: (row.novel_contributions as NovelContribution[]) ?? [],
    addressedStatus: row.addressed_status as FeedbackTheme['addressedStatus'],
    addressedReason: row.addressed_reason ?? undefined,
    linkedAnnotationIds: (row.linked_annotation_ids as string[]) ?? [],
  };
}

/**
 * Check if the requesting user is still in the sealed period.
 *
 * Sealed = user hasn't submitted their first annotation AND the proposal
 * is within its sealed window (48h from community_review_started_at or
 * assessment_sealed_until).
 */
async function isSealed(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  proposalTxHash: string,
  proposalIndex: number,
  userId: string | undefined,
): Promise<boolean> {
  // Anonymous users: always sealed (they can't submit annotations)
  if (!userId) return true;

  // Check if user has any annotation on this proposal
  const { count } = await supabase
    .from('proposal_annotations')
    .select('id', { count: 'exact', head: true })
    .eq('proposal_tx_hash', proposalTxHash)
    .eq('proposal_index', proposalIndex)
    .eq('user_id', userId);

  // If user has submitted at least one annotation, sealed period is over for them
  if (count && count > 0) return false;

  // Check time-based sealed period from proposal metadata
  // Look for assessment_sealed_until or community_review_started_at
  const { data: proposal } = await supabase
    .from('proposals')
    .select('meta_json')
    .eq('tx_hash', proposalTxHash)
    .eq('proposal_index', proposalIndex)
    .maybeSingle();

  // Also check draft table for community_review_started_at
  const { data: drafts } = await supabase
    .from('proposal_drafts')
    .select('community_review_started_at')
    .eq('submitted_tx_hash', proposalTxHash)
    .limit(1);

  const draft = drafts?.[0];
  if (draft?.community_review_started_at) {
    const sealedUntil = new Date(draft.community_review_started_at);
    sealedUntil.setHours(sealedUntil.getHours() + DEFAULT_SEALED_HOURS);
    if (new Date() < sealedUntil) return true;
  }

  // If no timing info available, check meta_json for assessment_sealed_until
  const metaJson = proposal?.meta_json as Record<string, unknown> | null;
  if (metaJson?.assessment_sealed_until) {
    const sealedUntil = new Date(metaJson.assessment_sealed_until as string);
    if (new Date() < sealedUntil) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// GET — fetch feedback themes for a proposal
// ---------------------------------------------------------------------------

export const GET = withRouteHandler(
  async (request, ctx) => {
    const { searchParams } = request.nextUrl;
    const proposalTxHash = searchParams.get('proposalTxHash');
    const proposalIndex = searchParams.get('proposalIndex');

    if (!proposalTxHash || proposalIndex === null) {
      return NextResponse.json(
        { error: 'Missing proposalTxHash or proposalIndex' },
        { status: 400 },
      );
    }

    const idx = Number(proposalIndex);
    const supabase = getSupabaseAdmin();

    // Check sealed period
    const sealed = await isSealed(supabase, proposalTxHash, idx, ctx.userId);
    if (sealed) {
      return NextResponse.json({
        themes: [],
        isSealed: true,
      });
    }

    // Fetch themes
    const { data, error } = await supabase
      .from('proposal_feedback_themes')
      .select('*')
      .eq('proposal_tx_hash', proposalTxHash)
      .eq('proposal_index', idx)
      .order('endorsement_count', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch feedback themes' }, { status: 500 });
    }

    const themes = (data ?? []).map((row) => rowToTheme(row as unknown as ThemeRow));

    return NextResponse.json({
      themes,
      isSealed: false,
    });
  },
  { auth: 'optional' },
);

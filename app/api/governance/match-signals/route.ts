export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { logger } from '@/lib/logger';

/**
 * POST /api/governance/match-signals
 *
 * Stores anonymous matching preference signals for community intelligence.
 * Called fire-and-forget from the client after match completion.
 * Data is stored in community_intelligence_snapshots as snapshot_type 'match_signal'.
 */

interface MatchSignalBody {
  topicSelections: Record<string, boolean>;
  importanceWeights?: Record<string, string>;
  alignmentVector: number[];
  archetype: string;
  matchedDrepIds: string[];
  expandedDrepIds?: string[];
  freeformTopics?: string[];
}

function validateBody(body: unknown): body is MatchSignalBody {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;

  // alignmentVector: must be array of 6 numbers 0-100
  if (!Array.isArray(b.alignmentVector)) return false;
  if (b.alignmentVector.length !== 6) return false;
  if (!b.alignmentVector.every((v: unknown) => typeof v === 'number' && v >= 0 && v <= 100))
    return false;

  // archetype: non-empty string
  if (typeof b.archetype !== 'string' || b.archetype.trim().length === 0) return false;

  // topicSelections: must be object
  if (!b.topicSelections || typeof b.topicSelections !== 'object') return false;

  // matchedDrepIds: must be array of strings
  if (!Array.isArray(b.matchedDrepIds)) return false;
  if (!b.matchedDrepIds.every((v: unknown) => typeof v === 'string')) return false;

  // Optional fields
  if (b.importanceWeights !== undefined && typeof b.importanceWeights !== 'object') return false;
  if (b.expandedDrepIds !== undefined) {
    if (!Array.isArray(b.expandedDrepIds)) return false;
    if (!b.expandedDrepIds.every((v: unknown) => typeof v === 'string')) return false;
  }
  if (b.freeformTopics !== undefined) {
    if (!Array.isArray(b.freeformTopics)) return false;
    if (!b.freeformTopics.every((v: unknown) => typeof v === 'string')) return false;
  }

  return true;
}

export const POST = withRouteHandler(
  async (request: NextRequest) => {
    const body = await request.json();

    if (!validateBody(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const epoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));
    const supabase = getSupabaseAdmin();

    const signalData = {
      topicSelections: body.topicSelections,
      importanceWeights: body.importanceWeights ?? null,
      alignmentVector: body.alignmentVector,
      archetype: body.archetype,
      matchedDrepIds: body.matchedDrepIds,
      expandedDrepIds: body.expandedDrepIds ?? [],
      freeformTopics: body.freeformTopics ?? [],
      timestamp: new Date().toISOString(),
    };

    // Insert as a new row (not upsert) — each match session is a unique signal
    const { error } = await supabase.from('community_intelligence_snapshots').insert({
      snapshot_type: 'match_signal',
      epoch,
      data: signalData,
      computed_at: new Date().toISOString(),
    });

    if (error) {
      logger.error('[MatchSignals] Failed to store signal', { error: error.message });
      return NextResponse.json({ error: 'Failed to store signal' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  },
  {
    rateLimit: { max: 10, window: 3600 }, // 10 signals per hour per IP
  },
);

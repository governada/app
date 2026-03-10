/**
 * Quick Match API — converts 3 value-based answers into an alignment vector
 * and matches against DRep (or SPO) alignment scores using Euclidean distance.
 * No wallet/auth required. Supports match_type: 'drep' | 'spo'.
 */

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  extractAlignments,
  getPersonalityLabel,
  getDominantDimension,
  getIdentityColor,
} from '@/lib/drepIdentity';
import type { AlignmentScores, AlignmentDimension } from '@/lib/drepIdentity';
import { computeDimensionAgreement } from '@/lib/matching/dimensionAgreement';
import { calculateProgressiveConfidence } from '@/lib/matching/confidence';
import { ANSWER_VECTORS } from '@/lib/matching/answerVectors';
import { captureServerEvent } from '@/lib/posthog-server';

export const dynamic = 'force-dynamic';

/** Minimum thresholds for match quality — below these, results are noise */
const MIN_MATCH_SCORE = 40;
const MIN_ENTITY_SCORE = 60;

const DIMENSIONS: AlignmentDimension[] = [
  'treasuryConservative',
  'treasuryGrowth',
  'decentralization',
  'security',
  'innovation',
  'transparency',
];

function euclideanDistance(a: AlignmentScores, b: AlignmentScores): number {
  let sum = 0;
  for (const dim of DIMENSIONS) {
    const diff = (a[dim] ?? 50) - (b[dim] ?? 50);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function distanceToScore(distance: number): number {
  // Max possible distance = sqrt(6 * 100^2) ≈ 245
  const maxDist = 245;
  return Math.max(0, Math.round((1 - distance / maxDist) * 100));
}

export const POST = withRouteHandler(async (request) => {
  let body: {
    treasury?: string;
    protocol?: string;
    transparency?: string;
    match_type?: 'drep' | 'spo';
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { treasury, protocol, transparency, match_type = 'drep' } = body;

  if (!treasury || !ANSWER_VECTORS.treasury[treasury]) {
    return NextResponse.json({ error: 'Invalid treasury answer' }, { status: 400 });
  }
  if (!protocol || !ANSWER_VECTORS.protocol[protocol]) {
    return NextResponse.json({ error: 'Invalid protocol answer' }, { status: 400 });
  }
  if (!transparency || !ANSWER_VECTORS.transparency[transparency]) {
    return NextResponse.json({ error: 'Invalid transparency answer' }, { status: 400 });
  }

  // Build user alignment vector from answers
  const userAlignments: AlignmentScores = {
    treasuryConservative: 50,
    treasuryGrowth: 50,
    decentralization: 50,
    security: 50,
    innovation: 50,
    transparency: 50,
  };

  for (const [, dimScores] of [
    ['treasury', ANSWER_VECTORS.treasury[treasury]],
    ['protocol', ANSWER_VECTORS.protocol[protocol]],
    ['transparency', ANSWER_VECTORS.transparency[transparency]],
  ] as [string, Partial<AlignmentScores>][]) {
    for (const dim of DIMENSIONS) {
      if (dimScores[dim] !== undefined) {
        userAlignments[dim] = dimScores[dim]!;
      }
    }
  }

  const supabase = getSupabaseAdmin();

  if (match_type === 'spo') {
    // SPO matching — query pools table
    const { data: pools } = await supabase
      .from('pools')
      .select(
        'pool_id, ticker, pool_name, governance_score, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
      )
      .not('alignment_treasury_conservative', 'is', null);

    if (!pools?.length) {
      return NextResponse.json({
        matches: [],
        nearMisses: [],
        userAlignments,
        personalityLabel: null,
        matchType: 'spo',
      });
    }

    const allRankedSPO = pools
      .map((p) => {
        const spoAlignments = extractAlignments(p);
        const distance = euclideanDistance(userAlignments, spoAlignments);
        const dimAgreement = computeDimensionAgreement(userAlignments, spoAlignments);
        return {
          entityId: p.pool_id as string,
          entityName: (p.ticker as string) || (p.pool_name as string) || null,
          entityScore: Number(p.governance_score) || 0,
          matchScore: distanceToScore(distance),
          alignments: spoAlignments,
          dominantDimension: getDominantDimension(spoAlignments),
          agreeDimensions: dimAgreement.agreeDimensions,
          differDimensions: dimAgreement.differDimensions,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore || b.entityScore - a.entityScore);

    const ranked = allRankedSPO
      .filter((r) => r.matchScore >= MIN_MATCH_SCORE && r.entityScore >= MIN_ENTITY_SCORE)
      .slice(0, 5);

    // Near-misses: top results that didn't meet thresholds (for empty state guidance)
    const spoNearMisses =
      ranked.length === 0 ? allRankedSPO.filter((r) => !ranked.includes(r)).slice(0, 3) : [];

    const personalityLabel = getPersonalityLabel(userAlignments);
    const dominant = getDominantDimension(userAlignments);
    const identityColor = getIdentityColor(dominant);

    // Baseline confidence from 3 quiz answers
    const spoConfidenceBreakdown = calculateProgressiveConfidence({
      quizAnswerCount: 3,
      pollVoteCount: 0,
      proposalTypesVoted: 0,
      engagementActionCount: 0,
      hasDelegation: false,
    });

    captureServerEvent('quick_match_completed', {
      treasury,
      protocol,
      transparency,
      match_type: 'spo',
      personality_label: personalityLabel,
      top_match_score: ranked[0]?.matchScore ?? null,
      matches_count: ranked.length,
    });

    const formatMatch = (r: (typeof allRankedSPO)[number]) => ({
      drepId: r.entityId,
      drepName: r.entityName,
      drepScore: r.entityScore,
      matchScore: r.matchScore,
      alignments: r.alignments,
      identityColor: getIdentityColor(r.dominantDimension).hex,
      personalityLabel: getPersonalityLabel(r.alignments),
      agreeDimensions: r.agreeDimensions,
      differDimensions: r.differDimensions,
    });

    return NextResponse.json({
      matches: ranked.map(formatMatch),
      nearMisses: spoNearMisses.map(formatMatch),
      userAlignments,
      personalityLabel,
      identityColor: identityColor.hex,
      matchType: 'spo',
      confidenceBreakdown: spoConfidenceBreakdown,
    });
  }

  // DRep matching (default)
  const { data: dreps } = await supabase
    .from('dreps')
    .select(
      'id, info, score, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
    )
    .not('alignment_treasury_conservative', 'is', null);

  if (!dreps?.length) {
    return NextResponse.json({
      matches: [],
      nearMisses: [],
      userAlignments,
      personalityLabel: null,
      matchType: 'drep',
    });
  }

  const allRanked = dreps
    .map((d) => {
      const drepAlignments = extractAlignments(d);
      const distance = euclideanDistance(userAlignments, drepAlignments);
      const dimAgreement = computeDimensionAgreement(userAlignments, drepAlignments);
      return {
        drepId: d.id,
        drepName: ((d.info as Record<string, unknown>)?.name as string) || null,
        drepScore: Number(d.score) || 0,
        matchScore: distanceToScore(distance),
        alignments: drepAlignments,
        dominantDimension: getDominantDimension(drepAlignments),
        agreeDimensions: dimAgreement.agreeDimensions,
        differDimensions: dimAgreement.differDimensions,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore || b.drepScore - a.drepScore);

  // Apply quality thresholds before selecting top results
  const qualified = allRanked.filter(
    (r) => r.matchScore >= MIN_MATCH_SCORE && r.drepScore >= MIN_ENTITY_SCORE,
  );
  // Prefer named DReps in results; fall back to unnamed if fewer than 3 named
  const namedRanked = qualified.filter((r) => r.drepName);
  const topRanked = (namedRanked.length >= 3 ? namedRanked : qualified).slice(0, 5);

  // Near-misses: top results that didn't meet thresholds (for empty state guidance)
  const topRankedIds = new Set(topRanked.map((r) => r.drepId));
  const nearMisses =
    topRanked.length === 0
      ? allRanked.filter((r) => !topRankedIds.has(r.drepId) && r.drepName).slice(0, 3)
      : [];

  const personalityLabel = getPersonalityLabel(userAlignments);
  const dominant = getDominantDimension(userAlignments);
  const identityColor = getIdentityColor(dominant);

  // Baseline confidence from 3 quiz answers (no other data yet for anonymous users)
  const confidenceBreakdown = calculateProgressiveConfidence({
    quizAnswerCount: 3,
    pollVoteCount: 0,
    proposalTypesVoted: 0,
    engagementActionCount: 0,
    hasDelegation: false,
  });

  captureServerEvent('quick_match_completed', {
    treasury,
    protocol,
    transparency,
    match_type: 'drep',
    personality_label: personalityLabel,
    top_match_score: topRanked[0]?.matchScore ?? null,
    matches_count: topRanked.length,
  });

  const formatDrepMatch = (r: (typeof allRanked)[number]) => ({
    drepId: r.drepId,
    drepName: r.drepName,
    drepScore: r.drepScore,
    matchScore: r.matchScore,
    alignments: r.alignments,
    identityColor: getIdentityColor(r.dominantDimension).hex,
    personalityLabel: getPersonalityLabel(r.alignments),
    agreeDimensions: r.agreeDimensions,
    differDimensions: r.differDimensions,
  });

  return NextResponse.json({
    matches: topRanked.map(formatDrepMatch),
    nearMisses: nearMisses.map(formatDrepMatch),
    userAlignments,
    personalityLabel,
    identityColor: identityColor.hex,
    matchType: 'drep',
    confidenceBreakdown,
  });
});

/**
 * GET /api/intelligence/annotations
 *
 * Returns contextual Seneca annotations for a given page context.
 * Lightweight, no AI — computes annotations from database state.
 *
 * Query params:
 * - pageContext: 'drep' | 'proposal' | 'delegation' | 'hub'
 * - entityId?: string (DRep ID or proposal hash)
 *
 * Feature-flagged behind `ambient_annotations`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { getFeatureFlag } from '@/lib/featureFlags';

export const dynamic = 'force-dynamic';

export interface SenecaAnnotationData {
  id: string;
  type: 'alignment_drift' | 'vote_context' | 'score_change' | 'delegation_nudge';
  text: string;
  variant: 'info' | 'warning' | 'success' | 'neutral';
  /** Optional entity reference for linking */
  entityRef?: { type: 'drep' | 'proposal'; id: string };
  /** Provenance chain steps */
  provenance: Array<{ label: string; detail: string }>;
}

interface AnnotationsResponse {
  annotations: SenecaAnnotationData[];
  pageContext: string;
}

export const GET = withRouteHandler(
  async (request: NextRequest, { userId }: RouteContext) => {
    const flagEnabled = await getFeatureFlag('ambient_annotations');
    if (!flagEnabled) {
      return NextResponse.json({ annotations: [], pageContext: '' } satisfies AnnotationsResponse);
    }

    const { searchParams } = new URL(request.url);
    const pageContext = searchParams.get('pageContext') ?? '';
    const entityId = searchParams.get('entityId') ?? undefined;

    const supabase = getSupabaseAdmin();
    const annotations: SenecaAnnotationData[] = [];

    // Get user's delegation context if authenticated
    let delegatedDrepId: string | null = null;
    let stakeAddress: string | null = null;
    if (userId) {
      const { data: wallet } = await supabase
        .from('user_wallets')
        .select('stake_address, drep_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      delegatedDrepId = wallet?.drep_id ?? null;
      stakeAddress = wallet?.stake_address ?? null;
    }

    switch (pageContext) {
      case 'drep': {
        if (!entityId) break;

        // Annotation: How user's DRep voted on recent proposals (if viewing a different DRep)
        if (delegatedDrepId && entityId !== delegatedDrepId) {
          const { data: drepData } = await supabase
            .from('dreps')
            .select('name, ticker, composite_score')
            .eq('drep_id', entityId)
            .limit(1)
            .maybeSingle();

          const { data: delegatedData } = await supabase
            .from('dreps')
            .select('name, ticker, composite_score')
            .eq('drep_id', delegatedDrepId)
            .limit(1)
            .maybeSingle();

          if (drepData && delegatedData) {
            const scoreDiff =
              (drepData.composite_score ?? 0) - (delegatedData.composite_score ?? 0);
            if (Math.abs(scoreDiff) >= 5) {
              const drepName = drepData.name || drepData.ticker || 'This DRep';
              const delegatedName =
                delegatedData.name || delegatedData.ticker || 'your current DRep';
              annotations.push({
                id: `score-compare-${entityId}`,
                type: 'score_change',
                text:
                  scoreDiff > 0
                    ? `${drepName} scores ${Math.abs(Math.round(scoreDiff))} points higher than ${delegatedName}.`
                    : `${drepName} scores ${Math.abs(Math.round(scoreDiff))} points lower than ${delegatedName}.`,
                variant: scoreDiff > 0 ? 'info' : 'neutral',
                entityRef: { type: 'drep', id: entityId },
                provenance: [
                  { label: 'Source', detail: 'Governada composite score (V3)' },
                  {
                    label: 'Comparison',
                    detail: `${drepName}: ${Math.round(drepData.composite_score ?? 0)} vs ${delegatedName}: ${Math.round(delegatedData.composite_score ?? 0)}`,
                  },
                ],
              });
            }
          }
        }

        // Annotation: Score change for this DRep
        const { data: scoreHistory } = await supabase
          .from('drep_score_history')
          .select('score, snapshot_date')
          .eq('drep_id', entityId)
          .order('snapshot_date', { ascending: false })
          .limit(2);

        if (scoreHistory && scoreHistory.length >= 2) {
          const delta = scoreHistory[0].score - scoreHistory[1].score;
          if (Math.abs(delta) >= 3) {
            annotations.push({
              id: `score-change-${entityId}`,
              type: 'score_change',
              text:
                delta > 0
                  ? `Score improved +${Math.round(delta)} points recently.`
                  : `Score dropped ${Math.round(delta)} points recently.`,
              variant: delta > 0 ? 'success' : 'warning',
              entityRef: { type: 'drep', id: entityId },
              provenance: [
                { label: 'Source', detail: 'Governada scoring model (V3)' },
                {
                  label: 'Change',
                  detail: `${Math.round(scoreHistory[1].score)} → ${Math.round(scoreHistory[0].score)} (${delta > 0 ? '+' : ''}${Math.round(delta)})`,
                },
              ],
            });
          }
        }
        break;
      }

      case 'proposal': {
        if (!entityId || !delegatedDrepId) break;

        // Annotation: How user's DRep voted on this proposal
        const { data: vote } = await supabase
          .from('votes')
          .select('vote, rationale')
          .eq('drep_id', delegatedDrepId)
          .eq('tx_hash', entityId)
          .limit(1)
          .maybeSingle();

        if (vote) {
          const { data: drep } = await supabase
            .from('dreps')
            .select('name, ticker')
            .eq('drep_id', delegatedDrepId)
            .limit(1)
            .maybeSingle();

          const drepName = drep?.name || drep?.ticker || 'Your DRep';
          const voteLabel = vote.vote === 'Yes' ? 'Yes' : vote.vote === 'No' ? 'No' : 'Abstain';
          annotations.push({
            id: `drep-vote-${entityId}`,
            type: 'vote_context',
            text: `${drepName} voted **${voteLabel}**${vote.rationale ? ' — rationale provided.' : '.'}`,
            variant: vote.vote === 'Yes' ? 'success' : vote.vote === 'No' ? 'warning' : 'neutral',
            entityRef: { type: 'drep', id: delegatedDrepId },
            provenance: [
              { label: 'Source', detail: 'On-chain vote record' },
              { label: 'Vote', detail: `${drepName}: ${voteLabel}` },
              ...(vote.rationale
                ? [{ label: 'Rationale', detail: vote.rationale.slice(0, 150) }]
                : []),
            ],
          });
        }
        break;
      }

      case 'delegation':
      case 'hub': {
        if (!stakeAddress || !delegatedDrepId) {
          // Nudge: not delegating
          if (stakeAddress) {
            annotations.push({
              id: 'delegation-nudge',
              type: 'delegation_nudge',
              text: 'Nobody represents your ADA in governance yet. Find your match.',
              variant: 'info',
              provenance: [
                { label: 'Source', detail: 'Wallet delegation status' },
                { label: 'Status', detail: 'No active delegation detected' },
              ],
            });
          }
          break;
        }

        // Check DRep score trend
        const { data: scores } = await supabase
          .from('drep_score_history')
          .select('score, snapshot_date')
          .eq('drep_id', delegatedDrepId)
          .order('snapshot_date', { ascending: false })
          .limit(2);

        if (scores && scores.length >= 2) {
          const delta = scores[0].score - scores[1].score;
          if (Math.abs(delta) >= 3) {
            const { data: drep } = await supabase
              .from('dreps')
              .select('name, ticker')
              .eq('drep_id', delegatedDrepId)
              .limit(1)
              .maybeSingle();
            const name = drep?.name || drep?.ticker || 'Your DRep';
            annotations.push({
              id: `delegation-score-${delegatedDrepId}`,
              type: 'score_change',
              text:
                delta > 0
                  ? `${name} is trending up (+${Math.round(delta)} points).`
                  : `${name}'s score dropped ${Math.round(delta)} points. Worth reviewing.`,
              variant: delta > 0 ? 'success' : 'warning',
              entityRef: { type: 'drep', id: delegatedDrepId },
              provenance: [
                { label: 'Source', detail: 'Governada scoring model (V3)' },
                {
                  label: 'Change',
                  detail: `${Math.round(scores[1].score)} → ${Math.round(scores[0].score)}`,
                },
              ],
            });
          }
        }
        break;
      }
    }

    return NextResponse.json({
      annotations: annotations.slice(0, 3),
      pageContext,
    } satisfies AnnotationsResponse);
  },
  { auth: 'optional', rateLimit: { max: 30, window: 60 } },
);

/**
 * POST /api/briefs/generate — Admin trigger for manual/test brief generation.
 */
import { NextRequest, NextResponse } from 'next/server';

import {
  assembleDRepBriefContext,
  assembleHolderBriefContext,
  generateDRepBrief,
  generateHolderBrief,
  storeBrief,
} from '@/lib/governanceBrief';
import { notifyUser } from '@/lib/notifications';
import { getSupabaseAdmin } from '@/lib/supabase';
import { captureServerEvent } from '@/lib/posthog-server';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

export const POST = withRouteHandler(async (request: NextRequest, ctx: RouteContext) => {
  const wallet = ctx.wallet!;
  const supabase = getSupabaseAdmin();

  const { data: user } = await supabase
    .from('users')
    .select('claimed_drep_id, delegation_history')
    .eq('wallet_address', wallet)
    .single();

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const isDRep = !!user.claimed_drep_id;

  let brief;
  if (isDRep) {
    const briefCtx = await assembleDRepBriefContext(user.claimed_drep_id!, wallet);
    if (!briefCtx)
      return NextResponse.json({ error: 'Could not assemble DRep context' }, { status: 500 });
    brief = generateDRepBrief(briefCtx);
    await storeBrief(wallet, 'drep', brief, briefCtx.epoch);
  } else {
    const history = user.delegation_history as Array<{ drepId: string }> | null;
    const currentDrep = history?.length ? history[history.length - 1].drepId : null;
    const briefCtx = await assembleHolderBriefContext(wallet, currentDrep);
    brief = generateHolderBrief(briefCtx);
    await storeBrief(wallet, 'holder', brief, briefCtx.epoch);
  }

  await notifyUser(wallet, {
    eventType: 'governance-brief',
    fallback: {
      title: 'Your Weekly Governance Brief',
      body: brief.greeting,
      url: '/dashboard',
    },
    data: {
      briefType: isDRep ? 'drep' : 'holder',
      greeting: brief.greeting,
      sections: brief.sections,
      ctaText: brief.ctaText,
      ctaUrl: brief.ctaUrl,
    },
  });

  captureServerEvent(
    'brief_generation_requested',
    { wallet_address: wallet, brief_type: isDRep ? 'drep' : 'holder' },
    wallet,
  );

  return NextResponse.json({ ok: true, brief });
}, { auth: 'required', rateLimit: { max: 5, window: 60 } });

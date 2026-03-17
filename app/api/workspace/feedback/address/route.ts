/**
 * Feedback Theme Address API — proposer responds to a feedback theme.
 *
 * POST: Update a theme's addressed status (addressed/deferred/dismissed).
 *       Only the proposal owner can call this.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const AddressThemeSchema = z.object({
  themeId: z.string().uuid(),
  action: z.enum(['addressed', 'deferred', 'dismissed']),
  reason: z.string().max(2000).optional(),
});

// ---------------------------------------------------------------------------
// POST — proposer addresses a feedback theme
// ---------------------------------------------------------------------------

export const POST = withRouteHandler(
  async (request, ctx) => {
    const userId = ctx.userId;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = AddressThemeSchema.parse(body);
    const supabase = getSupabaseAdmin();

    // Fetch the theme to get proposal identifiers
    const { data: themeRow, error: themeError } = await supabase
      .from('proposal_feedback_themes')
      .select('id, proposal_tx_hash, proposal_index')
      .eq('id', parsed.themeId)
      .maybeSingle();

    if (themeError || !themeRow) {
      return NextResponse.json({ error: 'Theme not found' }, { status: 404 });
    }

    const txHash = themeRow.proposal_tx_hash as string;

    // Verify the user is the proposal owner
    // Check proposal_drafts table (for drafted proposals)
    const { data: draft } = await supabase
      .from('proposal_drafts')
      .select('owner_stake_address')
      .eq('submitted_tx_hash', txHash)
      .maybeSingle();

    // Check user's stake addresses
    const { data: userWallets } = await supabase
      .from('user_wallets')
      .select('stake_address')
      .eq('user_id', userId);

    const userStakeAddresses = new Set(
      (userWallets ?? []).map((w) => (w as { stake_address: string }).stake_address),
    );

    const isOwner = draft?.owner_stake_address
      ? userStakeAddresses.has(draft.owner_stake_address as string)
      : false;

    if (!isOwner) {
      return NextResponse.json(
        { error: 'Only the proposal owner can address feedback themes' },
        { status: 403 },
      );
    }

    // Update theme status
    const { error: updateError } = await supabase
      .from('proposal_feedback_themes')
      .update({
        addressed_status: parsed.action,
        addressed_reason: parsed.reason ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.themeId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update theme status' }, { status: 500 });
    }

    return NextResponse.json({
      updated: true,
      themeId: parsed.themeId,
      action: parsed.action,
    });
  },
  { auth: 'required' },
);

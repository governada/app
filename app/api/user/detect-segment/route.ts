import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { detectUserSegment } from '@/lib/walletDetection';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/detect-segment?stakeAddress=stake1...
 * Detects user segment (citizen, spo, drep, cc) from their stake address.
 */
export const GET = withRouteHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const stakeAddress = searchParams.get('stakeAddress');

  if (!stakeAddress) {
    return NextResponse.json({ error: 'Required: stakeAddress' }, { status: 400 });
  }

  const result = await detectUserSegment(stakeAddress);

  // Check CC membership: match stake address against cc_members hot/cold credentials
  if (result.segment === 'citizen') {
    const supabase = createClient();
    const { data: ccMatch } = await supabase
      .from('cc_members')
      .select('cc_hot_id')
      .or(`cc_hot_id.eq.${stakeAddress},cc_cold_id.eq.${stakeAddress}`)
      .limit(1);

    if (ccMatch && ccMatch.length > 0) {
      result.segment = 'cc';
    }
  }

  return NextResponse.json(result);
});

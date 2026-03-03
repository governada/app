import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { validateSessionToken } from '@/lib/supabaseAuth';
import { captureServerEvent } from '@/lib/posthog-server';
import { logger } from '@/lib/logger';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { DrepPhilosophySchema } from '@/lib/api/schemas/drep';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ drepId: string }> },
) {
  const { drepId } = await params;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('governance_philosophy')
    .select('philosophy_text, updated_at')
    .eq('drep_id', drepId)
    .single();

  return NextResponse.json(data || { philosophy_text: null });
}

export const POST = withRouteHandler(async (request: NextRequest, { requestId }: RouteContext) => {
  const drepId = request.nextUrl.pathname.split('/')[3];
  const body = await request.json();
  const { sessionToken, philosophyText } = DrepPhilosophySchema.parse(body);

  const parsed = await validateSessionToken(sessionToken);
  if (!parsed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase
    .from('users')
    .select('claimed_drep_id')
    .eq('wallet_address', parsed.walletAddress)
    .single();

  if (!user || user.claimed_drep_id !== drepId) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('governance_philosophy')
    .upsert({ drep_id: drepId, philosophy_text: philosophyText }, { onConflict: 'drep_id' })
    .select()
    .single();

  if (error) {
    logger.error('Error', { context: 'philosophy-post', error: error?.message });
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }

  captureServerEvent('philosophy_updated', { drep_id: drepId }, drepId);

  return NextResponse.json(data);
}, { auth: 'none', rateLimit: { max: 20, window: 60 } });

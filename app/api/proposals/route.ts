import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('proposals')
      .select('tx_hash, proposal_index, title, status, proposal_type')
      .order('proposed_epoch', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ proposals: [] }, { status: 500 });
    }

    const proposals = (data || []).map((p) => ({
      txHash: p.tx_hash,
      index: p.proposal_index,
      title: p.title,
      status: p.status,
      type: p.proposal_type,
    }));

    return NextResponse.json({ proposals });
  } catch {
    return NextResponse.json({ proposals: [] }, { status: 500 });
  }
}

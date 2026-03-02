import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get('wallet');
    if (!wallet) {
      return NextResponse.json({ lastVisit: null });
    }

    const supabase = createClient();
    const { data } = await supabase
      .from('users')
      .select('last_visit_at')
      .eq('wallet_address', wallet)
      .single();

    return NextResponse.json({ lastVisit: data?.last_visit_at || null });
  } catch {
    return NextResponse.json({ lastVisit: null });
  }
}

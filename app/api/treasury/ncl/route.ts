import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getNclUtilization } from '@/lib/treasury';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(
  async () => {
    const ncl = await getNclUtilization();

    if (!ncl) {
      return NextResponse.json(
        { error: 'No active NCL period', ncl: null },
        { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300' } },
      );
    }

    return NextResponse.json(
      { ncl },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300' } },
    );
  },
  { rateLimit: { max: 60, window: 60 } },
);

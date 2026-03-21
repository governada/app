import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getTreasurySpendingByCategory, getSpendingTrend } from '@/lib/treasury-categories';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(
  async () => {
    const [categories, trend] = await Promise.all([
      getTreasurySpendingByCategory(),
      getSpendingTrend(),
    ]);

    return NextResponse.json(
      { categories, trend },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=3600',
        },
      },
    );
  },
  { rateLimit: { max: 60, window: 60 } },
);

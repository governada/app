import { NextResponse } from 'next/server';
import { getSpendingEffectiveness } from '@/lib/treasury';
import { getFeatureFlag } from '@/lib/featureFlags';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const enabled = await getFeatureFlag('treasury_intelligence', true);
    if (!enabled) {
      return NextResponse.json({ error: 'Feature not available' }, { status: 404 });
    }

    const effectiveness = await getSpendingEffectiveness();

    return NextResponse.json(effectiveness, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (error) {
    console.error('[treasury/effectiveness] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch spending effectiveness' },
      { status: 500 },
    );
  }
}

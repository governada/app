import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/supabaseAuth';
import { isAdminWallet } from '@/lib/adminAuth';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST: Check if the authenticated wallet is an admin.
 * Requires a valid session token via Authorization header.
 */
export const POST = withRouteHandler(async (request) => {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      logger.warn('Admin check: auth failed (no valid session)', { context: 'admin-check' });
      return auth;
    }

    const result = isAdminWallet(auth.wallet);
    logger.info('Admin check', {
      context: 'admin-check',
      wallet: auth.wallet.slice(0, 15) + '...',
      isAdmin: result,
      adminWalletsConfigured: !!(process.env.ADMIN_WALLETS || '').trim(),
    });
    return NextResponse.json({ isAdmin: result });
  } catch {
    return NextResponse.json({ isAdmin: false });
  }
});

import { NextRequest, NextResponse } from 'next/server';
import { checkSignature, DataSignature } from '@meshsdk/core';
import { createSessionToken, SESSION_MAX_AGE_SECONDS } from '@/lib/supabaseAuth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifyNonce } from '@/lib/nonce';
import { captureServerEvent } from '@/lib/posthog-server';
import { logger } from '@/lib/logger';
import { ZodError } from 'zod';
import { WalletAuthSchema } from '@/lib/api/schemas/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = WalletAuthSchema.parse(await request.json());
    } catch (e) {
      if (e instanceof ZodError)
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      throw e;
    }
    const { address, nonce, nonceSignature, signature, key } = body;

    const nonceValid = await verifyNonce(nonce, nonceSignature);
    if (!nonceValid) {
      return NextResponse.json({ error: 'Invalid or expired nonce' }, { status: 401 });
    }

    const dataSignature: DataSignature = { signature, key };

    // Must verify against hex-encoded nonce (same format that was signed on client)
    const hexPayload = Array.from(new TextEncoder().encode(nonce))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    let isValid = false;
    try {
      isValid = await checkSignature(hexPayload, dataSignature, address);
    } catch (sigError) {
      logger.error('Signature verification error', { context: 'auth/wallet', error: sigError });
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
    }

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { error: upsertError } = await supabase.from('users').upsert(
      {
        wallet_address: address,
        last_active: new Date().toISOString(),
      },
      { onConflict: 'wallet_address' },
    );

    if (upsertError) {
      logger.error('User upsert error', { context: 'auth/wallet', error: upsertError?.message });
      return NextResponse.json({ error: 'Failed to create user record' }, { status: 500 });
    }

    const sessionToken = await createSessionToken(address);

    const response = NextResponse.json({
      sessionToken,
      address,
    });

    response.cookies.set('drepscore_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    captureServerEvent('wallet_authenticated_server', { wallet_address: address }, address);

    return response;
  } catch (error) {
    logger.error('Auth error', { context: 'auth/wallet', error: error });
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}

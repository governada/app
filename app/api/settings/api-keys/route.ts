/**
 * BYOK API key management endpoint.
 *
 * GET  — List user's stored API keys (masked).
 * POST — Add/upsert an API key (encrypted at rest).
 * DELETE — Remove a stored API key by provider.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { encryptApiKey, getKeyPrefix } from '@/lib/ai/encryption';
import { AddApiKeySchema } from '@/lib/api/schemas/workspace';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — list keys (masked)
// ---------------------------------------------------------------------------

export const GET = withRouteHandler(
  async (_request: NextRequest, { userId }: RouteContext) => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('encrypted_api_keys')
      .select('id, provider, key_prefix, created_at')
      .eq('user_id', userId!)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch keys' }, { status: 500 });
    }

    const keys = (data ?? []).map((row) => ({
      id: row.id,
      provider: row.provider,
      keyPrefix: row.key_prefix,
      createdAt: row.created_at,
    }));

    return NextResponse.json({ keys });
  },
  { auth: 'required' },
);

// ---------------------------------------------------------------------------
// POST — add / upsert key
// ---------------------------------------------------------------------------

export const POST = withRouteHandler(
  async (request: NextRequest, { userId }: RouteContext) => {
    const body = await request.json();
    const { provider, apiKey } = AddApiKeySchema.parse(body);

    const encrypted = encryptApiKey(apiKey);
    const prefix = getKeyPrefix(apiKey);

    const supabase = getSupabaseAdmin();

    // Upsert: one key per user per provider
    const { error } = await supabase.from('encrypted_api_keys').upsert(
      {
        user_id: userId!,
        provider,
        encrypted_key: encrypted,
        key_prefix: prefix,
      },
      { onConflict: 'user_id,provider' },
    );

    if (error) {
      return NextResponse.json({ error: 'Failed to store key' }, { status: 500 });
    }

    return NextResponse.json({ success: true, provider, keyPrefix: prefix });
  },
  { auth: 'required', rateLimit: { max: 10, window: 60 } },
);

// ---------------------------------------------------------------------------
// DELETE — remove key by provider
// ---------------------------------------------------------------------------

export const DELETE = withRouteHandler(
  async (request: NextRequest, { userId }: RouteContext) => {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');

    if (!provider) {
      return NextResponse.json({ error: 'provider query param is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('encrypted_api_keys')
      .delete()
      .eq('user_id', userId!)
      .eq('provider', provider);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete key' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  },
  { auth: 'required' },
);

/**
 * BYOK API key test endpoint.
 *
 * POST — Test a stored key by making a minimal Anthropic API call.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { decryptApiKey } from '@/lib/ai/encryption';
import { generateTextWithModel, MODELS } from '@/lib/ai';

export const dynamic = 'force-dynamic';

const TestKeySchema = z.object({
  provider: z.string().min(1),
});

export const POST = withRouteHandler(
  async (request: NextRequest, { userId }: RouteContext) => {
    const body = await request.json();
    const { provider } = TestKeySchema.parse(body);

    const supabase = getSupabaseAdmin();
    const { data: keyRow, error: fetchError } = await supabase
      .from('encrypted_api_keys')
      .select('encrypted_key')
      .eq('user_id', userId!)
      .eq('provider', provider)
      .maybeSingle();

    if (fetchError || !keyRow) {
      return NextResponse.json(
        { success: false, error: 'No key found for this provider' },
        { status: 404 },
      );
    }

    const apiKey = decryptApiKey(keyRow.encrypted_key);

    try {
      if (provider === 'anthropic') {
        const { text } = await generateTextWithModel('ping', MODELS.FAST, {
          maxTokens: 5,
          apiKey,
        });
        return NextResponse.json({ success: true, model: text !== null ? MODELS.FAST : null });
      }

      // OpenAI placeholder — validate by calling models endpoint
      if (provider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!res.ok) {
          return NextResponse.json(
            { success: false, error: `OpenAI returned ${res.status}` },
            { status: 200 },
          );
        }
        return NextResponse.json({ success: true, model: 'openai' });
      }

      return NextResponse.json(
        { success: false, error: `Unsupported provider: ${provider}` },
        { status: 400 },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json({ success: false, error: message }, { status: 200 });
    }
  },
  { auth: 'required', rateLimit: { max: 5, window: 60 } },
);

/**
 * AI provider with BYOK support, multi-model routing, and provenance logging.
 *
 * Extends lib/ai.ts (which handles model selection + multi-provider routing)
 * to support:
 * - BYOK: user-provided API keys from encrypted_api_keys table
 * - Multi-provider: routes to Anthropic or OpenAI based on model ID
 * - Provenance: every AI call logged to ai_activity_log
 * - Personal context: user's governance philosophy injected into prompts
 *
 * Usage:
 *   const ai = await createAIProvider({ userId: 'xxx' });
 *   const result = await ai.generateText('prompt', { system: '...' });
 *   // result includes provenance metadata
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { decryptApiKey } from '@/lib/ai/encryption';
import { logger } from '@/lib/logger';
import {
  MODELS,
  type GenerateOptions,
  generateTextWithModel,
  getProviderForModel,
  resolveModel,
} from '@/lib/ai';

interface ProviderOptions {
  /** User ID for BYOK key lookup. If omitted, uses platform key. */
  userId?: string;
  /** Stake address for provenance logging */
  stakeAddress?: string;
}

interface AIResult<T> {
  data: T | null;
  provenance: {
    model: string;
    provider: 'anthropic' | 'openai';
    keySource: 'platform' | 'byok';
    tokensUsed?: number;
  };
}

interface AIProvider {
  generateText: (prompt: string, options?: GenerateOptions) => Promise<AIResult<string>>;
  generateJSON: <T = unknown>(prompt: string, options?: GenerateOptions) => Promise<AIResult<T>>;
  /** Generate text with a specific model ID (bypasses ModelKey lookup). */
  generateTextWithModel: (
    prompt: string,
    modelId: string,
    options?: { maxTokens?: number; temperature?: number; system?: string },
  ) => Promise<AIResult<string>>;
  keySource: 'platform' | 'byok';
  /** Log a skill invocation to provenance */
  logActivity: (params: {
    skillName: string;
    proposalTxHash?: string;
    proposalIndex?: number;
    draftId?: string;
    inputSummary?: string;
  }) => Promise<void>;
}

/**
 * Create an AI provider with optional BYOK support.
 * Supports both Anthropic and OpenAI models via automatic routing.
 */
export async function createAIProvider(options: ProviderOptions = {}): Promise<AIProvider> {
  let anthropicKey: string | undefined;
  let openaiKey: string | undefined;
  let keySource: 'platform' | 'byok' = 'platform';

  // Check for BYOK keys
  if (options.userId) {
    try {
      const supabase = getSupabaseAdmin();
      const { data: keys } = await supabase
        .from('encrypted_api_keys')
        .select('encrypted_key, provider')
        .eq('user_id', options.userId)
        .in('provider', ['anthropic', 'openai']);

      if (keys && keys.length > 0) {
        for (const keyRow of keys) {
          if (keyRow.encrypted_key) {
            const decrypted = decryptApiKey(keyRow.encrypted_key);
            if (keyRow.provider === 'anthropic') {
              anthropicKey = decrypted;
              keySource = 'byok';
            } else if (keyRow.provider === 'openai') {
              openaiKey = decrypted;
              keySource = 'byok';
            }
          }
        }
      }
    } catch (err) {
      logger.error('[AI Provider] Failed to fetch BYOK keys, falling back to platform', {
        error: err,
      });
    }
  }

  function getApiKeyForModel(modelId: string): string | undefined {
    const provider = getProviderForModel(modelId);
    return provider === 'openai' ? openaiKey : anthropicKey;
  }

  async function callAI(
    prompt: string,
    modelId: string,
    opts: { maxTokens?: number; temperature?: number; system?: string } = {},
  ): Promise<{
    text: string | null;
    tokensUsed?: number;
    model: string;
    provider: 'anthropic' | 'openai';
  }> {
    const provider = getProviderForModel(modelId);
    const apiKey = getApiKeyForModel(modelId);

    const result = await generateTextWithModel(prompt, modelId, {
      maxTokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature,
      system: opts.system,
      apiKey,
    });

    return {
      text: result.text,
      tokensUsed: result.tokensUsed,
      model: modelId,
      provider,
    };
  }

  const generateText = async (
    prompt: string,
    opts: GenerateOptions = {},
  ): Promise<AIResult<string>> => {
    const modelId = resolveModel(opts.model ?? 'FAST');
    const result = await callAI(prompt, modelId, opts);
    return {
      data: result.text,
      provenance: {
        model: result.model,
        provider: result.provider,
        keySource,
        tokensUsed: result.tokensUsed,
      },
    };
  };

  const generateJSON = async <T = unknown>(
    prompt: string,
    opts: GenerateOptions = {},
  ): Promise<AIResult<T>> => {
    const modelId = resolveModel(opts.model ?? 'FAST');
    const result = await callAI(prompt, modelId, opts);
    const provenance = {
      model: result.model,
      provider: result.provider,
      keySource,
      tokensUsed: result.tokensUsed,
    } as const;

    if (!result.text) return { data: null, provenance };

    try {
      const cleaned = result.text
        .replace(/^```json\s*/, '')
        .replace(/\s*```$/, '')
        .trim();
      return { data: JSON.parse(cleaned) as T, provenance };
    } catch {
      logger.error('[AI Provider] Failed to parse JSON response');
      return { data: null, provenance };
    }
  };

  const generateTextWithModelFn = async (
    prompt: string,
    modelId: string,
    opts: { maxTokens?: number; temperature?: number; system?: string } = {},
  ): Promise<AIResult<string>> => {
    const result = await callAI(prompt, modelId, opts);
    return {
      data: result.text,
      provenance: {
        model: result.model,
        provider: result.provider,
        keySource,
        tokensUsed: result.tokensUsed,
      },
    };
  };

  const logActivity = async (params: {
    skillName: string;
    proposalTxHash?: string;
    proposalIndex?: number;
    draftId?: string;
    inputSummary?: string;
  }) => {
    try {
      const supabase = getSupabaseAdmin();
      await supabase.from('ai_activity_log').insert({
        user_id: options.userId ?? null,
        stake_address: options.stakeAddress ?? null,
        skill_name: params.skillName,
        proposal_tx_hash: params.proposalTxHash ?? null,
        proposal_index: params.proposalIndex ?? null,
        draft_id: params.draftId ?? null,
        model_used: MODELS.FAST,
        key_source: keySource,
        input_summary: params.inputSummary?.slice(0, 200) ?? null,
      });
    } catch (err) {
      logger.error('[AI Provider] Failed to log activity', { error: err });
    }
  };

  return {
    generateText,
    generateJSON,
    generateTextWithModel: generateTextWithModelFn,
    keySource,
    logActivity,
  };
}

/**
 * Shared AI utility — centralizes model selection, multi-provider routing,
 * and graceful error handling.
 *
 * Every AI feature in the app should use this module instead of
 * importing provider SDKs directly.
 *
 * Supports Anthropic (Claude) and OpenAI (GPT) models.
 */

import { logger } from '@/lib/logger';

export const MODELS = {
  /** Primary scoring, skills, analysis */
  FAST: 'claude-sonnet-4-6' as const,
  /** Backward compat alias for FAST (longer-form generation) */
  DRAFT: 'claude-sonnet-4-6' as const,
  /** High-stakes CC analysis */
  OPUS: 'claude-opus-4-6' as const,
  /** Validation passes, fact-checking */
  HAIKU: 'claude-haiku-4-5-20251001' as const,
  /** OpenAI secondary/redundancy assessments */
  GPT4O: 'gpt-4o' as const,
  /** OpenAI cheap validation fallback */
  GPT4O_MINI: 'gpt-4o-mini' as const,
} as const;

export type ModelKey = keyof typeof MODELS;

/** Resolve a model key to a model ID string. */
export function resolveModel(keyOrId: ModelKey | string): string {
  if (keyOrId in MODELS) return MODELS[keyOrId as ModelKey];
  return keyOrId;
}

/** Determine the provider for a given model ID. */
export function getProviderForModel(modelId: string): 'anthropic' | 'openai' {
  if (modelId.startsWith('gpt-')) return 'openai';
  return 'anthropic';
}

export interface GenerateOptions {
  model?: ModelKey;
  maxTokens?: number;
  temperature?: number;
  system?: string;
}

// ---------------------------------------------------------------------------
// Anthropic client (singleton)
// ---------------------------------------------------------------------------

interface AnthropicClient {
  messages: {
    create: (params: {
      model: string;
      max_tokens: number;
      temperature?: number;
      system?: string;
      messages: Array<{ role: string; content: string }>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools?: any[];
      stream?: boolean;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) => Promise<any>;
  };
}

let _anthropicClient: AnthropicClient | null = null;

/**
 * Get a configured Anthropic client. Exported so callers that need
 * advanced SDK features (streaming, tool-use) can access the raw client
 * while keeping configuration centralized.
 */
export async function getAnthropicClient(apiKey?: string): Promise<AnthropicClient | null> {
  const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  // If a custom key is provided, always create a new client
  if (apiKey) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    return new Anthropic({ apiKey: key }) as unknown as AnthropicClient;
  }
  if (_anthropicClient) return _anthropicClient;
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  _anthropicClient = new Anthropic({ apiKey: key }) as unknown as AnthropicClient;
  return _anthropicClient;
}

// ---------------------------------------------------------------------------
// OpenAI client (singleton)
// ---------------------------------------------------------------------------

interface OpenAIClient {
  chat: {
    completions: {
      create: (params: {
        model: string;
        max_tokens?: number;
        temperature?: number;
        messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
      }) => Promise<{
        choices: Array<{ message: { content: string | null } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      }>;
    };
  };
}

let _openaiClient: OpenAIClient | null = null;

async function getOpenAIClient(apiKey?: string): Promise<OpenAIClient | null> {
  const key = apiKey ?? process.env.OPENAI_API_KEY;
  if (!key) return null;
  if (apiKey) {
    const { default: OpenAI } = await import('openai');
    return new OpenAI({ apiKey: key }) as unknown as OpenAIClient;
  }
  if (_openaiClient) return _openaiClient;
  const { default: OpenAI } = await import('openai');
  _openaiClient = new OpenAI({ apiKey: key }) as unknown as OpenAIClient;
  return _openaiClient;
}

// ---------------------------------------------------------------------------
// Multi-model text generation
// ---------------------------------------------------------------------------

interface GenerateWithModelResult {
  text: string | null;
  tokensUsed?: number;
}

/**
 * Generate text using a specific model ID (not a key).
 * Routes to the correct provider based on model prefix.
 */
export async function generateTextWithModel(
  prompt: string,
  modelId: string,
  options: { maxTokens?: number; temperature?: number; system?: string; apiKey?: string } = {},
): Promise<GenerateWithModelResult> {
  const provider = getProviderForModel(modelId);

  if (provider === 'openai') {
    const client = await getOpenAIClient(options.apiKey);
    if (!client) return { text: null };
    try {
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
      if (options.system) messages.push({ role: 'system', content: options.system });
      messages.push({ role: 'user', content: prompt });

      const response = await client.chat.completions.create({
        model: modelId,
        max_tokens: options.maxTokens ?? 1024,
        ...(options.temperature != null ? { temperature: options.temperature } : {}),
        messages,
      });

      const text = response.choices[0]?.message?.content ?? null;
      const tokensUsed = response.usage?.completion_tokens;
      return { text, tokensUsed };
    } catch (err) {
      logger.error('[AI] OpenAI generateText error', { error: err, model: modelId });
      return { text: null };
    }
  }

  // Anthropic
  const client = await getAnthropicClient(options.apiKey);
  if (!client) return { text: null };
  try {
    const message = await client.messages.create({
      model: modelId,
      max_tokens: options.maxTokens ?? 1024,
      ...(options.temperature != null ? { temperature: options.temperature } : {}),
      ...(options.system ? { system: options.system } : {}),
      messages: [{ role: 'user', content: prompt }],
    });

    const block = message.content[0];
    const text = block?.type === 'text' ? (block.text ?? null) : null;
    const tokensUsed = message.usage?.output_tokens;
    return { text, tokensUsed };
  } catch (err) {
    logger.error('[AI] Anthropic generateText error', { error: err, model: modelId });
    return { text: null };
  }
}

// ---------------------------------------------------------------------------
// Legacy API (backward compatible)
// ---------------------------------------------------------------------------

/**
 * Generate text from a prompt. Returns null if AI is unavailable or fails,
 * so callers can fall back to template-based output.
 */
export async function generateText(
  prompt: string,
  options: GenerateOptions = {},
): Promise<string | null> {
  const modelId = MODELS[options.model ?? 'FAST'];
  const { text } = await generateTextWithModel(prompt, modelId, {
    maxTokens: options.maxTokens,
    temperature: options.temperature,
    system: options.system,
  });
  return text;
}

/**
 * Generate structured JSON from a prompt. Parses the response and returns
 * null if AI is unavailable, fails, or returns unparseable output.
 */
export async function generateJSON<T = unknown>(
  prompt: string,
  options: GenerateOptions = {},
): Promise<T | null> {
  const text = await generateText(prompt, options);
  if (!text) return null;

  try {
    const cleaned = text
      .replace(/^```json\s*/, '')
      .replace(/\s*```$/, '')
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    logger.error('[AI] Failed to parse JSON response');
    return null;
  }
}

// ---------------------------------------------------------------------------
// Streaming text generation (Anthropic only)
// ---------------------------------------------------------------------------

export interface StreamOptions {
  model?: ModelKey;
  maxTokens?: number;
  temperature?: number;
  system?: string;
  /** Multi-turn messages (instead of a single prompt). When provided, `prompt` param is ignored. */
  messages?: Array<{
    role: string;
    content: string | Array<{ type: string; [key: string]: unknown }>;
  }>;
  /** Tool definitions for function calling (Anthropic tool use). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools?: any[];
  apiKey?: string;
}

/**
 * Stream text from an Anthropic model. Returns the raw SDK stream
 * (an async iterable of server-sent events).
 *
 * Returns `null` if the API key is missing or the client cannot be created.
 */
export async function createAnthropicStream(
  prompt: string,
  options: StreamOptions = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<AsyncIterable<any> | null> {
  const client = await getAnthropicClient(options.apiKey);
  if (!client) return null;

  const modelId = MODELS[options.model ?? 'FAST'];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = options.messages ?? [{ role: 'user' as const, content: prompt }];

  const stream = await client.messages.create({
    model: modelId,
    max_tokens: options.maxTokens ?? 1024,
    ...(options.temperature != null ? { temperature: options.temperature } : {}),
    ...(options.system ? { system: options.system } : {}),
    ...(options.tools && options.tools.length > 0 ? { tools: options.tools } : {}),
    messages,
    stream: true,
  });

  return stream as AsyncIterable<unknown>;
}

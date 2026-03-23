/**
 * Ensemble scoring framework for multi-model AI assessments.
 *
 * Runs primary + optional secondary model calls, compares results,
 * flags divergence, and tracks metrics. Designed for governance scoring
 * use cases where reliability matters more than speed.
 *
 * Usage:
 *   const result = await runEnsemble<ScoreOutput>({
 *     name: 'rationale_quality',
 *     primary: { model: MODELS.FAST, prompt: '...', system: '...' },
 *     secondary: { model: MODELS.GPT4O, prompt: '...', system: '...' },
 *     divergenceThreshold: 15,
 *     outputValidation: (r) => validateScoreOutput(r, ['quality', 'depth']),
 *   });
 */

import { generateTextWithModel, getProviderForModel } from '@/lib/ai';
import { trackAIMetric, type AIMetric } from '@/lib/ai/healthMetrics';
import type { InputValidationResult } from '@/lib/ai/inputValidation';
import type { OutputValidationResult } from '@/lib/ai/outputValidation';
import { logger } from '@/lib/logger';

const log = logger.withContext('Ensemble');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnsembleModelConfig {
  model: string;
  prompt: string;
  system?: string;
}

export interface EnsembleConfig<T> {
  /** Use case name for logging and metrics. */
  name: string;
  /** Primary model call (always executed). */
  primary: EnsembleModelConfig;
  /** Secondary model call (optional, runs in parallel with primary). */
  secondary?: EnsembleModelConfig;
  /** Validation pass (optional, runs sequentially after scoring). */
  validation?: EnsembleModelConfig;
  /** Pre-call input quality gate. Return result of a validate*Input() call. */
  inputValidation?: () => InputValidationResult;
  /** Post-call output quality check. */
  outputValidation?: (result: T) => OutputValidationResult;
  /** Divergence threshold (absolute score difference). Default 15. */
  divergenceThreshold?: number;
  /** Max tokens for model calls. */
  maxTokens?: number;
  /** Temperature for model calls. */
  temperature?: number;
}

export interface EnsembleResult<T> {
  data: T | null;
  primaryScore: T | null;
  secondaryScore: T | null;
  validationPassed: boolean | null;
  divergence: number | null;
  divergenceFlag: boolean;
  metadata: {
    primaryModel: string;
    secondaryModel?: string;
    validationModel?: string;
    inputQuality: InputValidationResult;
    outputQuality?: OutputValidationResult;
    latencyMs: number;
    fallbackUsed: boolean;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseJSON<T>(text: string): T | null {
  try {
    const cleaned = text
      .replace(/^```json\s*/, '')
      .replace(/\s*```$/, '')
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

/**
 * Compute a simple scalar divergence between two parsed results.
 * Attempts to find numeric fields and compute average absolute difference.
 * Returns null if comparison is not possible.
 */
function computeDivergence<T>(a: T, b: T): number | null {
  if (a === null || b === null) return null;
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b);
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const numericFields: string[] = [];
    for (const key of Object.keys(aObj)) {
      if (typeof aObj[key] === 'number' && typeof bObj[key] === 'number') {
        numericFields.push(key);
      }
    }
    if (numericFields.length === 0) return null;
    const totalDiff = numericFields.reduce((sum, key) => {
      return sum + Math.abs((aObj[key] as number) - (bObj[key] as number));
    }, 0);
    return totalDiff / numericFields.length;
  }
  return null;
}

/**
 * Weighted average merge of two parsed results.
 * Primary weight: 55%, Secondary weight: 45%.
 * Only merges numeric fields; non-numeric fields taken from primary.
 */
function weightedMerge<T>(primary: T, secondary: T, primaryWeight = 0.55): T {
  if (primary === null) return secondary;
  if (secondary === null) return primary;

  if (typeof primary === 'number' && typeof secondary === 'number') {
    return (primary * primaryWeight + secondary * (1 - primaryWeight)) as unknown as T;
  }

  if (typeof primary === 'object' && typeof secondary === 'object') {
    const pObj = primary as Record<string, unknown>;
    const sObj = secondary as Record<string, unknown>;
    const merged = { ...pObj };

    for (const key of Object.keys(pObj)) {
      if (typeof pObj[key] === 'number' && typeof sObj[key] === 'number') {
        merged[key] =
          (pObj[key] as number) * primaryWeight + (sObj[key] as number) * (1 - primaryWeight);
        // Round to 1 decimal for cleaner scores
        merged[key] = Math.round((merged[key] as number) * 10) / 10;
      }
    }

    return merged as T;
  }

  return primary;
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * Run an ensemble scoring pipeline.
 *
 * 1. Input validation (fail-fast if bad input)
 * 2. Primary + Secondary model calls (parallel if both configured)
 * 3. Divergence check
 * 4. Weighted aggregation
 * 5. Output validation
 * 6. Optional validation pass (post-hoc, sequential)
 * 7. Metric tracking
 */
export async function runEnsemble<T>(config: EnsembleConfig<T>): Promise<EnsembleResult<T>> {
  const startTime = Date.now();
  const threshold = config.divergenceThreshold ?? 15;

  // 1. Input validation
  const inputQuality: InputValidationResult = config.inputValidation
    ? config.inputValidation()
    : { valid: true };

  if (!inputQuality.valid) {
    const latencyMs = Date.now() - startTime;
    log.warn('Ensemble input rejected', {
      name: config.name,
      reason: inputQuality.reason,
    });

    await trackAIMetric({
      timestamp: new Date(),
      useCase: config.name,
      model: config.primary.model,
      provider: getProviderForModel(config.primary.model),
      status: 'input_rejected',
      latencyMs,
      inputValidation: { valid: false, reason: inputQuality.reason },
    });

    return {
      data: null,
      primaryScore: null,
      secondaryScore: null,
      validationPassed: null,
      divergence: null,
      divergenceFlag: false,
      metadata: {
        primaryModel: config.primary.model,
        secondaryModel: config.secondary?.model,
        validationModel: config.validation?.model,
        inputQuality,
        latencyMs,
        fallbackUsed: false,
      },
    };
  }

  // 2. Primary + Secondary calls (parallel)
  const callOpts = {
    maxTokens: config.maxTokens,
    temperature: config.temperature,
  };

  const primaryPromise = generateTextWithModel(config.primary.prompt, config.primary.model, {
    ...callOpts,
    system: config.primary.system,
  });

  const secondaryPromise = config.secondary
    ? generateTextWithModel(config.secondary.prompt, config.secondary.model, {
        ...callOpts,
        system: config.secondary.system,
      })
    : Promise.resolve(null);

  const [primaryResult, secondaryResult] = await Promise.all([primaryPromise, secondaryPromise]);

  let primaryParsed: T | null = null;
  let secondaryParsed: T | null = null;
  let fallbackUsed = false;

  if (primaryResult.text) {
    primaryParsed = parseJSON<T>(primaryResult.text);
  }

  if (secondaryResult?.text) {
    secondaryParsed = parseJSON<T>(secondaryResult.text);
  }

  // If primary failed but secondary succeeded, use secondary as fallback
  if (primaryParsed === null && secondaryParsed !== null) {
    primaryParsed = secondaryParsed;
    fallbackUsed = true;
    log.warn('Ensemble primary failed, using secondary as fallback', {
      name: config.name,
    });
  }

  // 3. Divergence check
  let divergence: number | null = null;
  let divergenceFlag = false;

  if (primaryParsed !== null && secondaryParsed !== null && !fallbackUsed) {
    divergence = computeDivergence(primaryParsed, secondaryParsed);
    if (divergence !== null) {
      divergenceFlag = divergence > threshold;
      if (divergenceFlag) {
        log.warn('Ensemble divergence detected', {
          name: config.name,
          divergence,
          threshold,
        });
      }
    }
  }

  // 4. Aggregate
  let aggregated: T | null = primaryParsed;
  if (primaryParsed !== null && secondaryParsed !== null && !fallbackUsed) {
    aggregated = weightedMerge(primaryParsed, secondaryParsed);
  }

  // 5. Output validation
  let outputQuality: OutputValidationResult | undefined;
  if (aggregated !== null && config.outputValidation) {
    outputQuality = config.outputValidation(aggregated);
    if (!outputQuality.valid) {
      log.warn('Ensemble output validation failed', {
        name: config.name,
        reason: outputQuality.reason,
      });

      // Apply auto-corrections if any
      if (outputQuality.adjustments && typeof aggregated === 'object') {
        const obj = aggregated as Record<string, unknown>;
        for (const [key, val] of Object.entries(outputQuality.adjustments)) {
          obj[key] = val;
        }
        // Re-validate after adjustments
        outputQuality = config.outputValidation(aggregated);
      }
    }
  }

  // 6. Validation pass (optional, sequential)
  let validationPassed: boolean | null = null;
  if (config.validation && aggregated !== null) {
    try {
      const valResult = await generateTextWithModel(
        config.validation.prompt,
        config.validation.model,
        { ...callOpts, system: config.validation.system },
      );
      if (valResult.text) {
        const valParsed = parseJSON<{ valid: boolean; reason?: string }>(valResult.text);
        validationPassed = valParsed?.valid ?? null;
      }
    } catch (err) {
      log.error('Ensemble validation pass failed', { error: err, name: config.name });
    }
  }

  const latencyMs = Date.now() - startTime;

  // 7. Track metrics
  const status: AIMetric['status'] =
    aggregated === null
      ? 'failure'
      : fallbackUsed
        ? 'fallback'
        : outputQuality && !outputQuality.valid
          ? 'output_invalid'
          : 'success';

  await trackAIMetric({
    timestamp: new Date(),
    useCase: config.name,
    model: config.primary.model,
    provider: getProviderForModel(config.primary.model),
    status,
    latencyMs,
    inputValidation: { valid: inputQuality.valid, reason: inputQuality.reason },
    outputValidation: outputQuality
      ? { valid: outputQuality.valid, reason: outputQuality.reason }
      : undefined,
    divergence: divergence ?? undefined,
    divergenceFlag,
    tokensUsed: primaryResult.tokensUsed,
    error: aggregated === null ? 'all_models_failed' : undefined,
  });

  return {
    data: aggregated,
    primaryScore: primaryParsed,
    secondaryScore: secondaryParsed,
    validationPassed,
    divergence,
    divergenceFlag,
    metadata: {
      primaryModel: config.primary.model,
      secondaryModel: config.secondary?.model,
      validationModel: config.validation?.model,
      inputQuality,
      outputQuality,
      latencyMs,
      fallbackUsed,
    },
  };
}

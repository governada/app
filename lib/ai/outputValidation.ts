/**
 * Output quality checks for AI responses.
 *
 * Post-call validation ensures AI outputs meet schema and range expectations
 * before they are persisted or returned to users.
 */

import type { ZodType } from 'zod';

export interface OutputValidationResult {
  valid: boolean;
  reason?: string;
  adjustments?: Record<string, unknown>;
}

/**
 * Validate that a score output contains all expected numeric fields in range [0, 100].
 */
export function validateScoreOutput(output: unknown, fields: string[]): OutputValidationResult {
  if (!output || typeof output !== 'object') {
    return { valid: false, reason: 'output_not_object' };
  }

  const obj = output as Record<string, unknown>;
  const adjustments: Record<string, unknown> = {};
  let adjusted = false;

  for (const field of fields) {
    const val = obj[field];
    if (val === undefined || val === null) {
      return { valid: false, reason: `missing_field:${field}` };
    }

    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (typeof num !== 'number' || isNaN(num)) {
      return { valid: false, reason: `non_numeric_field:${field}` };
    }

    // Clamp to [0, 100] and record adjustment
    if (num < 0) {
      adjustments[field] = 0;
      adjusted = true;
    } else if (num > 100) {
      adjustments[field] = 100;
      adjusted = true;
    }
  }

  return {
    valid: true,
    ...(adjusted ? { adjustments } : {}),
  };
}

/**
 * Validate output against a Zod schema.
 */
export function validateJSONOutput<T>(output: unknown, schema: ZodType<T>): OutputValidationResult {
  const result = schema.safeParse(output);
  if (result.success) {
    return { valid: true };
  }

  const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
  return {
    valid: false,
    reason: `schema_validation_failed: ${issues.join('; ')}`,
  };
}

/**
 * Check divergence between primary and secondary scores.
 * Returns the absolute divergence and whether it exceeds the threshold.
 */
export function validateEnsembleDivergence(
  primary: number,
  secondary: number,
  threshold: number,
): { divergence: number; flag: boolean } {
  const divergence = Math.abs(primary - secondary);
  return {
    divergence,
    flag: divergence > threshold,
  };
}

/**
 * AI health metrics tracking and alerting.
 *
 * Records every AI call outcome (success, failure, fallback, input rejection)
 * to the ai_health_metrics table for observability. Provides summary queries
 * and alert threshold checks for monitoring.
 */

import { logger } from '@/lib/logger';

const log = logger.withContext('AI Health');

export interface AIMetric {
  timestamp: Date;
  useCase: string;
  model: string;
  provider: 'anthropic' | 'openai';
  status: 'success' | 'failure' | 'fallback' | 'input_rejected' | 'output_invalid';
  latencyMs: number;
  inputValidation?: { valid: boolean; reason?: string };
  outputValidation?: { valid: boolean; reason?: string };
  divergence?: number;
  divergenceFlag?: boolean;
  tokensUsed?: number;
  error?: string;
}

export interface AIHealthSummary {
  period: { from: Date; to: Date };
  totalCalls: number;
  successRate: number;
  failureRate: number;
  fallbackRate: number;
  inputRejectionRate: number;
  outputInvalidRate: number;
  avgLatencyMs: number;
  divergenceFlagRate: number;
  byUseCase: Record<
    string,
    {
      total: number;
      successRate: number;
      avgLatencyMs: number;
    }
  >;
  byModel: Record<
    string,
    {
      total: number;
      successRate: number;
    }
  >;
}

export interface AIHealthAlert {
  type: 'low_success_rate' | 'high_fallback_rate' | 'high_divergence_rate' | 'high_latency';
  message: string;
  value: number;
  threshold: number;
}

const ALERT_THRESHOLDS = {
  minSuccessRate: 0.9,
  maxFallbackRate: 0.1,
  maxDivergenceRate: 0.15,
  maxAvgLatencyMs: 15000,
};

/**
 * Track a single AI metric. Writes to the ai_health_metrics table
 * and logs for immediate visibility.
 */
export async function trackAIMetric(metric: AIMetric): Promise<void> {
  // Always log immediately for real-time observability
  const logData: Record<string, unknown> = {
    useCase: metric.useCase,
    model: metric.model,
    provider: metric.provider,
    status: metric.status,
    latencyMs: metric.latencyMs,
  };
  if (metric.divergence !== undefined) logData.divergence = metric.divergence;
  if (metric.divergenceFlag) logData.divergenceFlag = true;
  if (metric.tokensUsed) logData.tokensUsed = metric.tokensUsed;
  if (metric.error) logData.error = metric.error;

  if (metric.status === 'success') {
    log.info('AI call completed', logData);
  } else {
    log.warn('AI call issue', logData);
  }

  // Persist to database (non-blocking, best-effort)
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase');
    const supabase = getSupabaseAdmin();

    await supabase.from('ai_health_metrics').insert({
      use_case: metric.useCase,
      model: metric.model,
      provider: metric.provider,
      status: metric.status,
      latency_ms: metric.latencyMs,
      input_valid: metric.inputValidation?.valid ?? null,
      input_rejection_reason: metric.inputValidation?.reason ?? null,
      output_valid: metric.outputValidation?.valid ?? null,
      output_rejection_reason: metric.outputValidation?.reason ?? null,
      divergence: metric.divergence ?? null,
      divergence_flag: metric.divergenceFlag ?? false,
      tokens_used: metric.tokensUsed ?? null,
      error_message: metric.error ?? null,
    });
  } catch (err) {
    // Don't let metrics tracking break the main flow
    log.error('Failed to persist AI metric', { error: err });
  }
}

/**
 * Get AI health summary for the given time window.
 */
export async function getAIHealthSummary(hours: number = 24): Promise<AIHealthSummary> {
  const from = new Date(Date.now() - hours * 60 * 60 * 1000);
  const to = new Date();

  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase');
    const supabase = getSupabaseAdmin();

    const { data: rows } = await supabase
      .from('ai_health_metrics')
      .select('use_case, model, status, latency_ms, divergence_flag')
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString());

    if (!rows || rows.length === 0) {
      return {
        period: { from, to },
        totalCalls: 0,
        successRate: 1,
        failureRate: 0,
        fallbackRate: 0,
        inputRejectionRate: 0,
        outputInvalidRate: 0,
        avgLatencyMs: 0,
        divergenceFlagRate: 0,
        byUseCase: {},
        byModel: {},
      };
    }

    const total = rows.length;
    const countByStatus = (s: string) => rows.filter((r) => r.status === s).length;
    const successCount = countByStatus('success');
    const failureCount = countByStatus('failure');
    const fallbackCount = countByStatus('fallback');
    const inputRejectedCount = countByStatus('input_rejected');
    const outputInvalidCount = countByStatus('output_invalid');
    const divergenceFlagCount = rows.filter((r) => r.divergence_flag).length;
    const totalLatency = rows.reduce((sum, r) => sum + (r.latency_ms ?? 0), 0);

    // By use case
    const byUseCase: AIHealthSummary['byUseCase'] = {};
    for (const row of rows) {
      const uc = row.use_case;
      if (!byUseCase[uc]) byUseCase[uc] = { total: 0, successRate: 0, avgLatencyMs: 0 };
      byUseCase[uc].total++;
    }
    for (const uc of Object.keys(byUseCase)) {
      const ucRows = rows.filter((r) => r.use_case === uc);
      const ucSuccess = ucRows.filter((r) => r.status === 'success').length;
      const ucLatency = ucRows.reduce((sum, r) => sum + (r.latency_ms ?? 0), 0);
      byUseCase[uc].successRate = ucSuccess / ucRows.length;
      byUseCase[uc].avgLatencyMs = ucLatency / ucRows.length;
    }

    // By model
    const byModel: AIHealthSummary['byModel'] = {};
    for (const row of rows) {
      const m = row.model;
      if (!byModel[m]) byModel[m] = { total: 0, successRate: 0 };
      byModel[m].total++;
    }
    for (const m of Object.keys(byModel)) {
      const mRows = rows.filter((r) => r.model === m);
      const mSuccess = mRows.filter((r) => r.status === 'success').length;
      byModel[m].successRate = mSuccess / mRows.length;
    }

    return {
      period: { from, to },
      totalCalls: total,
      successRate: successCount / total,
      failureRate: failureCount / total,
      fallbackRate: fallbackCount / total,
      inputRejectionRate: inputRejectedCount / total,
      outputInvalidRate: outputInvalidCount / total,
      avgLatencyMs: totalLatency / total,
      divergenceFlagRate: divergenceFlagCount / total,
      byUseCase,
      byModel,
    };
  } catch (err) {
    log.error('Failed to fetch AI health summary', { error: err });
    return {
      period: { from, to },
      totalCalls: 0,
      successRate: 1,
      failureRate: 0,
      fallbackRate: 0,
      inputRejectionRate: 0,
      outputInvalidRate: 0,
      avgLatencyMs: 0,
      divergenceFlagRate: 0,
      byUseCase: {},
      byModel: {},
    };
  }
}

/**
 * Check if alerting thresholds are breached.
 */
export async function checkAIHealth(hours: number = 1): Promise<AIHealthAlert[]> {
  const summary = await getAIHealthSummary(hours);
  const alerts: AIHealthAlert[] = [];

  if (summary.totalCalls === 0) return alerts;

  if (summary.successRate < ALERT_THRESHOLDS.minSuccessRate) {
    alerts.push({
      type: 'low_success_rate',
      message: `AI success rate is ${(summary.successRate * 100).toFixed(1)}% (threshold: ${ALERT_THRESHOLDS.minSuccessRate * 100}%)`,
      value: summary.successRate,
      threshold: ALERT_THRESHOLDS.minSuccessRate,
    });
  }

  if (summary.fallbackRate > ALERT_THRESHOLDS.maxFallbackRate) {
    alerts.push({
      type: 'high_fallback_rate',
      message: `AI fallback rate is ${(summary.fallbackRate * 100).toFixed(1)}% (threshold: ${ALERT_THRESHOLDS.maxFallbackRate * 100}%)`,
      value: summary.fallbackRate,
      threshold: ALERT_THRESHOLDS.maxFallbackRate,
    });
  }

  if (summary.divergenceFlagRate > ALERT_THRESHOLDS.maxDivergenceRate) {
    alerts.push({
      type: 'high_divergence_rate',
      message: `Ensemble divergence flag rate is ${(summary.divergenceFlagRate * 100).toFixed(1)}% (threshold: ${ALERT_THRESHOLDS.maxDivergenceRate * 100}%)`,
      value: summary.divergenceFlagRate,
      threshold: ALERT_THRESHOLDS.maxDivergenceRate,
    });
  }

  if (summary.avgLatencyMs > ALERT_THRESHOLDS.maxAvgLatencyMs) {
    alerts.push({
      type: 'high_latency',
      message: `Average AI latency is ${summary.avgLatencyMs.toFixed(0)}ms (threshold: ${ALERT_THRESHOLDS.maxAvgLatencyMs}ms)`,
      value: summary.avgLatencyMs,
      threshold: ALERT_THRESHOLDS.maxAvgLatencyMs,
    });
  }

  if (alerts.length > 0) {
    log.warn('AI health alerts triggered', {
      alertCount: alerts.length,
      alerts: alerts.map((a) => a.type),
    });
  }

  return alerts;
}

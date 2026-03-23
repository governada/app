-- AI Health Metrics table
-- Tracks every AI call outcome for observability and alerting.
-- Apply via Supabase MCP (not CLI).

CREATE TABLE IF NOT EXISTS ai_health_metrics (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  use_case TEXT NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  latency_ms INTEGER,
  input_valid BOOLEAN,
  input_rejection_reason TEXT,
  output_valid BOOLEAN,
  output_rejection_reason TEXT,
  divergence REAL,
  divergence_flag BOOLEAN DEFAULT FALSE,
  tokens_used INTEGER,
  error_message TEXT
);

-- Index for health queries
CREATE INDEX idx_ai_health_metrics_created ON ai_health_metrics (created_at DESC);
CREATE INDEX idx_ai_health_metrics_use_case ON ai_health_metrics (use_case, created_at DESC);
CREATE INDEX idx_ai_health_metrics_status ON ai_health_metrics (status, created_at DESC);

-- Auto-cleanup: keep 30 days
-- Implement via pg_cron or Inngest scheduled job:
--   DELETE FROM ai_health_metrics WHERE created_at < NOW() - INTERVAL '30 days';

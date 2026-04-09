export const CODEX_RUNTIME_ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SECRET_KEY',
  'SESSION_SECRET',
  'CRON_SECRET',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
];

export function getMissingRuntimeEnv(env = process.env) {
  return CODEX_RUNTIME_ENV_KEYS.filter((key) => !env[key]);
}

export function assertRuntimeEnv(env = process.env) {
  const missing = getMissingRuntimeEnv(env);
  if (missing.length === 0) {
    return;
  }

  throw new Error(`Missing required runtime environment variables:\n- ${missing.join('\n- ')}`);
}

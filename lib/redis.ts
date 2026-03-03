import { Redis } from '@upstash/redis';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required');
  }
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

/**
 * Cache helper with TTL. Falls back to fetcher on cache miss or Redis runtime errors.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const r = getRedis();

  try {
    const hit = await r.get<T>(key);
    if (hit !== null && hit !== undefined) return hit;
  } catch {
    // Redis runtime error — fall through to fetcher
  }

  const value = await fetcher();

  try {
    await r.set(key, value, { ex: ttlSeconds });
  } catch {
    // Best-effort cache write
  }

  return value;
}

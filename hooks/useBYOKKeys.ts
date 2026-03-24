'use client';

/**
 * TanStack Query hooks for BYOK API key management.
 *
 * useBYOKKeys()      — Fetch stored keys (masked).
 * useAddBYOKKey()    — Add a new API key.
 * useDeleteBYOKKey() — Remove a stored key by provider.
 * useTestBYOKKey()   — Test a stored key with a minimal API call.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStoredSession } from '@/lib/supabaseAuth';
import type { BYOKKeyInfo } from '@/lib/workspace/types';

async function fetchWithAuth<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getStoredSession();
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (init?.body) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

const BYOK_KEYS_QUERY = ['byok-keys'] as const;

/** Fetch the user's stored BYOK API keys (masked). */
export function useBYOKKeys() {
  return useQuery<BYOKKeyInfo[]>({
    queryKey: BYOK_KEYS_QUERY,
    queryFn: async () => {
      const data = await fetchWithAuth<{ keys: BYOKKeyInfo[] }>('/api/settings/api-keys');
      return data.keys;
    },
    staleTime: 60_000,
  });
}

/** Add (or upsert) a BYOK API key. */
export function useAddBYOKKey() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: { provider: string; apiKey: string }) => {
      return fetchWithAuth<{ success: boolean; provider: string; keyPrefix: string }>(
        '/api/settings/api-keys',
        { method: 'POST', body: JSON.stringify(params) },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BYOK_KEYS_QUERY });
      import('@/lib/posthog')
        .then(({ posthog }) => posthog.capture('byok_key_added'))
        .catch(() => {});
    },
  });
}

/** Delete a BYOK API key by provider. */
export function useDeleteBYOKKey() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (provider: string) => {
      return fetchWithAuth<{ success: boolean }>(
        `/api/settings/api-keys?provider=${encodeURIComponent(provider)}`,
        { method: 'DELETE' },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BYOK_KEYS_QUERY });
      import('@/lib/posthog')
        .then(({ posthog }) => posthog.capture('byok_key_removed'))
        .catch(() => {});
    },
  });
}

/** Test a stored BYOK key with a minimal API call. */
export function useTestBYOKKey() {
  return useMutation({
    mutationFn: async (provider: string) => {
      const result = await fetchWithAuth<{ success: boolean; model?: string; error?: string }>(
        '/api/settings/api-keys/test',
        { method: 'POST', body: JSON.stringify({ provider }) },
      );
      import('@/lib/posthog')
        .then(({ posthog }) =>
          posthog.capture('byok_key_tested', { provider, success: result.success }),
        )
        .catch(() => {});
      return result;
    },
  });
}

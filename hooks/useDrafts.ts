'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProposalDraft, DraftVersion, ConstitutionalCheckResult } from '@/lib/workspace/types';
import type { Cip108Document } from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Fetch helpers (same pattern as hooks/queries.ts)
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string): Promise<T> {
  const headers: Record<string, string> = {};
  try {
    const { getStoredSession } = await import('@/lib/supabaseAuth');
    const token = getStoredSession();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // No session available
  }
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const { getStoredSession } = await import('@/lib/supabaseAuth');
    const token = getStoredSession();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // No session available
  }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

async function patchJson<T>(url: string, body: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const { getStoredSession } = await import('@/lib/supabaseAuth');
    const token = getStoredSession();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // No session available
  }
  const res = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** List all drafts for a user */
export function useDrafts(stakeAddress: string | null) {
  return useQuery<{ drafts: ProposalDraft[] }>({
    queryKey: ['author-drafts', stakeAddress],
    queryFn: () =>
      fetchJson(`/api/workspace/drafts?stakeAddress=${encodeURIComponent(stakeAddress!)}`),
    enabled: !!stakeAddress,
    staleTime: 30_000,
  });
}

/** Fetch a single draft with its versions */
export function useDraft(draftId: string | null) {
  return useQuery<{ draft: ProposalDraft; versions: DraftVersion[] }>({
    queryKey: ['author-draft', draftId],
    queryFn: () => fetchJson(`/api/workspace/drafts/${encodeURIComponent(draftId!)}`),
    enabled: !!draftId,
    staleTime: 15_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Create a new draft */
export function useCreateDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      stakeAddress: string;
      proposalType: string;
      title?: string;
      abstract?: string;
      motivation?: string;
      rationale?: string;
    }) => postJson<{ draft: ProposalDraft }>('/api/workspace/drafts', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['author-drafts'] });
    },
  });
}

/** Update draft fields (auto-save) */
export function useUpdateDraft(draftId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      patchJson<{ draft: ProposalDraft }>(
        `/api/workspace/drafts/${encodeURIComponent(draftId)}`,
        body,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['author-draft', draftId] });
      queryClient.invalidateQueries({ queryKey: ['author-drafts'] });
    },
  });
}

/** Save a named version */
export function useSaveVersion(draftId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { versionName: string; editSummary?: string }) =>
      postJson<{ version: DraftVersion }>(
        `/api/workspace/drafts/${encodeURIComponent(draftId)}/version`,
        body,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['author-draft', draftId] });
      queryClient.invalidateQueries({ queryKey: ['author-drafts'] });
    },
  });
}

/** Run constitutional check */
export function useConstitutionalCheck() {
  return useMutation({
    mutationFn: (body: {
      title: string;
      abstract?: string;
      motivation?: string;
      rationale?: string;
      proposalType: string;
      typeSpecific?: Record<string, unknown>;
    }) => postJson<ConstitutionalCheckResult>('/api/workspace/constitutional-check', body),
  });
}

/** Generate CIP-108 preview */
export function useCip108Preview() {
  return useMutation({
    mutationFn: (body: {
      title: string;
      abstract?: string;
      motivation?: string;
      rationale?: string;
      authorName?: string;
    }) =>
      postJson<{ document: Cip108Document; contentHash: string }>(
        '/api/workspace/cip108-preview',
        body,
      ),
  });
}

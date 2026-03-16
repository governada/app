'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ResearchMessage, ResearchConversation } from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchWithAuth<T>(url: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };

  try {
    const { getStoredSession } = await import('@/lib/supabaseAuth');
    const token = getStoredSession();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // No session
  }

  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Conversation query
// ---------------------------------------------------------------------------

export function useResearchConversation(txHash: string | null, index: number | null) {
  return useQuery<ResearchConversation | null>({
    queryKey: ['research-conversation', txHash, index],
    queryFn: async () => {
      if (!txHash || index == null) return null;
      const data = await fetchWithAuth<{ conversation: ResearchConversation | null }>(
        `/api/workspace/research?proposalTxHash=${encodeURIComponent(txHash)}&proposalIndex=${index}`,
      );
      return data.conversation;
    },
    enabled: !!txHash && index != null,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Send message mutation
// ---------------------------------------------------------------------------

interface SendMessageParams {
  proposalTxHash: string;
  proposalIndex: number;
  message: string;
}

interface SendMessageResponse {
  message: ResearchMessage;
  conversationId?: string;
}

interface OptimisticContext {
  previous: ResearchConversation | null | undefined;
  key: (string | number | null)[];
}

export function useSendResearchMessage() {
  const queryClient = useQueryClient();

  return useMutation<SendMessageResponse, Error, SendMessageParams, OptimisticContext>({
    mutationFn: async (params) => {
      return fetchWithAuth<SendMessageResponse>('/api/workspace/research', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },
    onMutate: async (params): Promise<OptimisticContext> => {
      // Optimistic update: add user message immediately
      const key = ['research-conversation', params.proposalTxHash, params.proposalIndex];
      await queryClient.cancelQueries({ queryKey: key });

      const previous = queryClient.getQueryData<ResearchConversation | null>(key);
      const optimisticMessage: ResearchMessage = {
        role: 'user',
        content: params.message,
        timestamp: new Date().toISOString(),
      };

      queryClient.setQueryData<ResearchConversation | null>(key, (old) => {
        if (!old) {
          return {
            id: 'pending',
            proposalTxHash: params.proposalTxHash,
            proposalIndex: params.proposalIndex,
            messages: [optimisticMessage],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }
        return {
          ...old,
          messages: [...old.messages, optimisticMessage],
          updatedAt: new Date().toISOString(),
        };
      });

      return { previous, key };
    },
    onSuccess: (data, params) => {
      // Append assistant response to the conversation
      const key = ['research-conversation', params.proposalTxHash, params.proposalIndex];
      queryClient.setQueryData<ResearchConversation | null>(key, (old) => {
        if (!old) return old;
        return {
          ...old,
          messages: [...old.messages, data.message],
          updatedAt: new Date().toISOString(),
        };
      });
    },
    onError: (_err, _params, context) => {
      // Rollback on error
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.key, context.previous);
      }
    },
  });
}

'use client';

/**
 * useAgent -- Client hook for the governance agent chat.
 *
 * Manages the SSE connection to /api/workspace/agent, parses the event stream
 * into typed AgentSSEEvent objects, and exposes a clean API for the chat UI.
 *
 * Features:
 * - Streaming text deltas accumulated into messages
 * - Tool call status tracking (started/completed indicators)
 * - ProposedEdit and ProposedComment extraction for editor integration
 * - Conversation persistence via localStorage conversationId
 * - Automatic reconnection on transient errors
 */

import { useCallback, useRef, useState } from 'react';
import type { AgentMessage, AgentSSEEvent } from '@/lib/workspace/agent/types';
import type { EditorContext, ProposedEdit, ProposedComment } from '@/lib/workspace/editor/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseAgentOptions {
  proposalId: string;
  userRole: 'proposer' | 'reviewer' | 'cc_member';
}

interface UseAgentReturn {
  /** Send a message to the agent */
  sendMessage: (message: string, editorContext?: EditorContext) => Promise<void>;
  /** All messages in the conversation */
  messages: AgentMessage[];
  /** Whether the agent is currently streaming a response */
  isStreaming: boolean;
  /** The most recent ProposedEdit from the agent (null after consumed) */
  lastEdit: ProposedEdit | null;
  /** The most recent ProposedComment from the agent (null after consumed) */
  lastComment: ProposedComment | null;
  /** Clear the last edit (call after the editor consumes it) */
  clearLastEdit: () => void;
  /** Clear the last comment (call after the editor consumes it) */
  clearLastComment: () => void;
  /** Current tool call in progress (name + status) */
  activeToolCall: { toolName: string; status: 'started' | 'completed' } | null;
  /** Error message if the last request failed */
  error: string | null;
}

// ---------------------------------------------------------------------------
// Conversation ID persistence
// ---------------------------------------------------------------------------

function getConversationId(proposalId: string): string {
  if (typeof window === 'undefined') return crypto.randomUUID();

  const key = `agent_conversation_${proposalId}`;
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

// ---------------------------------------------------------------------------
// Auth token helper
// ---------------------------------------------------------------------------

async function getAuthToken(): Promise<string | null> {
  try {
    const { getStoredSession } = await import('@/lib/supabaseAuth');
    return getStoredSession();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAgent({ proposalId, userRole }: UseAgentOptions): UseAgentReturn {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastEdit, setLastEdit] = useState<ProposedEdit | null>(null);
  const [lastComment, setLastComment] = useState<ProposedComment | null>(null);
  const [activeToolCall, setActiveToolCall] = useState<{
    toolName: string;
    status: 'started' | 'completed';
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Abort controller for cancelling in-flight requests
  const abortRef = useRef<AbortController | null>(null);

  const conversationId = useRef(getConversationId(proposalId));

  const sendMessage = useCallback(
    async (message: string, editorContext?: EditorContext) => {
      // Abort any in-flight request
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const abortController = new AbortController();
      abortRef.current = abortController;

      setError(null);
      setIsStreaming(true);
      setActiveToolCall(null);

      // Add user message immediately
      const userMessage: AgentMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      };

      // Add placeholder assistant message for streaming
      const assistantId = crypto.randomUUID();
      const assistantMessage: AgentMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);

      try {
        const token = await getAuthToken();
        if (!token) {
          setError('Not authenticated. Please sign in.');
          setIsStreaming(false);
          return;
        }

        const response = await fetch('/api/workspace/agent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            proposalId,
            conversationId: conversationId.current,
            message,
            editorContext,
            userRole,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          let errorMsg = `Request failed: ${response.status}`;
          try {
            const errorJson = JSON.parse(errorText);
            errorMsg = errorJson.error ?? errorMsg;
          } catch {
            // Keep default error message
          }
          setError(errorMsg);
          setIsStreaming(false);
          return;
        }

        if (!response.body) {
          setError('No response body received.');
          setIsStreaming(false);
          return;
        }

        // Parse SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const collectedEdits: ProposedEdit[] = [];
        const collectedComments: ProposedComment[] = [];
        const collectedToolCalls: AgentMessage['toolCalls'] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE events (data: {...}\n\n)
          const events = buffer.split('\n\n');
          buffer = events.pop() ?? ''; // Keep incomplete last chunk

          for (const eventStr of events) {
            const dataLine = eventStr.trim();
            if (!dataLine.startsWith('data: ')) continue;

            try {
              const eventData = JSON.parse(dataLine.slice(6)) as AgentSSEEvent;

              switch (eventData.type) {
                case 'text_delta':
                  // Append to the streaming assistant message
                  setMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last && last.id === assistantId) {
                      updated[updated.length - 1] = {
                        ...last,
                        content: last.content + eventData.content,
                      };
                    }
                    return updated;
                  });
                  break;

                case 'tool_call':
                  setActiveToolCall({
                    toolName: eventData.toolName,
                    status: eventData.status,
                  });
                  if (eventData.status === 'completed') {
                    // Clear after a brief delay so the UI shows the completion
                    setTimeout(() => setActiveToolCall(null), 500);
                  }
                  break;

                case 'tool_result':
                  collectedToolCalls.push({
                    toolName: eventData.toolName,
                    input: {},
                    result: eventData.data,
                  });
                  break;

                case 'edit_proposal':
                  setLastEdit(eventData.edit);
                  collectedEdits.push(eventData.edit);
                  break;

                case 'draft_comment':
                  setLastComment(eventData.comment);
                  collectedComments.push(eventData.comment);
                  break;

                case 'done':
                  // Finalize the assistant message with tool call data
                  setMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last && last.id === assistantId) {
                      updated[updated.length - 1] = {
                        ...last,
                        toolCalls: collectedToolCalls.length > 0 ? collectedToolCalls : undefined,
                        proposedEdits: collectedEdits.length > 0 ? collectedEdits : undefined,
                        proposedComments:
                          collectedComments.length > 0 ? collectedComments : undefined,
                      };
                    }
                    return updated;
                  });
                  break;
              }
            } catch {
              // Skip malformed events
            }
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // Request was cancelled -- not an error
          return;
        }
        setError(err instanceof Error ? err.message : 'Connection failed.');
      } finally {
        setIsStreaming(false);
        setActiveToolCall(null);
        abortRef.current = null;
      }
    },
    [proposalId, userRole],
  );

  const clearLastEdit = useCallback(() => setLastEdit(null), []);
  const clearLastComment = useCallback(() => setLastComment(null), []);

  return {
    sendMessage,
    messages,
    isStreaming,
    lastEdit,
    lastComment,
    clearLastEdit,
    clearLastComment,
    activeToolCall,
    error,
  };
}

/**
 * Contract B: Agent Endpoint Request/Response Types
 *
 * Defines the SSE event protocol between the agent backend and the client hook.
 * The agent streams typed events over Server-Sent Events.
 */

import type { EditorContext, ProposedEdit, ProposedComment } from '../editor/types';

/** Client -> Server request body */
export interface AgentRequest {
  proposalId: string; // draft ID or txHash
  conversationId: string;
  message: string;
  editorContext?: EditorContext;
  userRole: 'proposer' | 'reviewer' | 'cc_member';
}

/** Server -> Client (SSE event types) */
export type AgentSSEEvent =
  | { type: 'text_delta'; content: string }
  | { type: 'tool_call'; toolName: string; status: 'started' | 'completed' }
  | { type: 'edit_proposal'; edit: ProposedEdit }
  | { type: 'draft_comment'; comment: ProposedComment }
  | { type: 'tool_result'; toolName: string; summary: string; data: unknown }
  | { type: 'done' };

/** Persisted agent message in conversation history */
export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: Array<{
    toolName: string;
    input: Record<string, unknown>;
    result: unknown;
  }>;
  proposedEdits?: ProposedEdit[];
  proposedComments?: ProposedComment[];
}

/**
 * Research Assistant API — conversational AI for proposal analysis.
 *
 * POST: Send a message and get an AI-grounded response with citations.
 * GET:  Fetch conversation history for a proposal.
 *
 * Auth: required. Messages are stored per-user per-proposal.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getProposalByKey } from '@/lib/data';
import { generateText } from '@/lib/ai';
import { captureServerEvent } from '@/lib/posthog-server';
import { logger } from '@/lib/logger';
import type { ResearchMessage } from '@/lib/workspace/types';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(proposal: {
  title: string | null;
  abstract: string | null;
  proposalType: string | null;
  withdrawalAmount: number | null;
  aiSummary: string | null;
  yesCount: number;
  noCount: number;
  abstainCount: number;
}): string {
  const amountStr =
    proposal.withdrawalAmount != null
      ? `${(proposal.withdrawalAmount / 1_000_000).toLocaleString()} ADA`
      : 'N/A';

  return `You are a governance research assistant for Cardano. You help DReps analyze governance proposals by providing grounded, factual analysis with citations.

## Proposal Context
- **Title**: ${proposal.title || 'Untitled'}
- **Type**: ${proposal.proposalType || 'Unknown'}
- **Requested Amount**: ${amountStr}
- **Current Vote Tally**: Yes: ${proposal.yesCount}, No: ${proposal.noCount}, Abstain: ${proposal.abstainCount}

## Proposal Abstract
${proposal.abstract || 'No abstract available.'}

${proposal.aiSummary ? `## AI Summary\n${proposal.aiSummary}` : ''}

## Instructions
1. ALWAYS cite specific sources when making claims. Use brackets like [Proposal Text], [Constitutional Article X], [On-chain Data], or [Vote Tally].
2. Show your reasoning steps for complex analysis. Start with "Reasoning:" on a new line, then explain your thought process step by step.
3. Acknowledge uncertainty explicitly. Say "I'm not certain about X because..." when you lack sufficient data.
4. Frame analysis objectively. Do NOT recommend how to vote — provide analysis, not decisions.
5. When discussing constitutional alignment, reference specific articles or sections.
6. Keep responses focused and concise. Use markdown formatting for clarity.
7. If asked about historical or comparative data you don't have, say so clearly rather than speculating.

## Source Citation Format
At the end of your response, if you cited any sources, include a "Sources:" section listing each source on its own line with the format:
- [Source Type] Reference: Brief description

For example:
Sources:
- [Proposal Text] Abstract: The proposal requests funding for...
- [On-chain Data] Vote Tally: Current DRep votes show...`;
}

// ---------------------------------------------------------------------------
// POST — send message
// ---------------------------------------------------------------------------

export const POST = withRouteHandler(
  async (request: NextRequest, { userId }: RouteContext) => {
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { proposalTxHash, proposalIndex, message } = body;

    if (!proposalTxHash || proposalIndex == null || !message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Missing required fields: proposalTxHash, proposalIndex, message' },
        { status: 400 },
      );
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { error: 'Message too long (max 2000 characters)' },
        { status: 400 },
      );
    }

    const admin = getSupabaseAdmin();

    // 1. Fetch proposal data for context
    const proposal = await getProposalByKey(proposalTxHash, proposalIndex);
    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    // 2. Fetch or create conversation
    const { data: existing } = await admin
      .from('research_conversations')
      .select('id, messages')
      .eq('user_id', userId)
      .eq('proposal_tx_hash', proposalTxHash)
      .eq('proposal_index', proposalIndex)
      .maybeSingle();

    const existingMessages: ResearchMessage[] = (existing?.messages as ResearchMessage[]) || [];
    const isNewConversation = !existing;

    // 3. Append user message
    const userMessage: ResearchMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    const updatedMessages = [...existingMessages, userMessage];

    // 4. Build conversation history for AI (last 10 messages)
    const recentHistory = updatedMessages.slice(-10);
    const conversationContext = recentHistory
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    // 5. Build system prompt with proposal context
    const systemPrompt = buildSystemPrompt({
      title: proposal.title,
      abstract: proposal.abstract,
      proposalType: proposal.proposalType,
      withdrawalAmount: proposal.withdrawalAmount,
      aiSummary: proposal.aiSummary,
      yesCount: proposal.yesCount,
      noCount: proposal.noCount,
      abstainCount: proposal.abstainCount,
    });

    // 6. Call AI
    const aiResponse = await generateText(`${conversationContext}\n\nUser: ${message}`, {
      system: systemPrompt,
      maxTokens: 2048,
      model: 'DRAFT',
    });

    if (!aiResponse) {
      return NextResponse.json(
        { error: 'AI service unavailable. Please try again later.' },
        { status: 503 },
      );
    }

    // 7. Parse sources from AI response
    const sources = parseSources(aiResponse);
    const assistantMessage: ResearchMessage = {
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date().toISOString(),
      ...(sources.length > 0 ? { sources } : {}),
    };

    const allMessages = [...updatedMessages, assistantMessage];

    // 8. Upsert conversation
    if (existing) {
      const { error } = await admin
        .from('research_conversations')
        .update({
          messages: allMessages as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) {
        logger.error('[Research] Failed to update conversation', { error: error.message });
        return NextResponse.json({ error: 'Failed to save conversation' }, { status: 500 });
      }
    } else {
      const { error } = await admin.from('research_conversations').insert({
        user_id: userId,
        proposal_tx_hash: proposalTxHash,
        proposal_index: proposalIndex,
        messages: allMessages as unknown as Record<string, unknown>,
      });

      if (error) {
        logger.error('[Research] Failed to create conversation', { error: error.message });
        return NextResponse.json({ error: 'Failed to save conversation' }, { status: 500 });
      }
    }

    // 9. Analytics
    try {
      if (isNewConversation) {
        captureServerEvent(
          'research_conversation_started',
          {
            proposalTxHash,
            proposalIndex,
          },
          userId,
        );
      }
      captureServerEvent(
        'research_message_sent',
        {
          proposalTxHash,
          proposalIndex,
          messageLength: message.length,
          responseLength: aiResponse.length,
        },
        userId,
      );
    } catch {
      // Non-critical
    }

    return NextResponse.json({
      message: assistantMessage,
      conversationId: existing?.id ?? undefined,
    });
  },
  { auth: 'required', rateLimit: { max: 20, window: 60 } },
);

// ---------------------------------------------------------------------------
// GET — fetch conversation
// ---------------------------------------------------------------------------

export const GET = withRouteHandler(
  async (request: NextRequest, { userId }: RouteContext) => {
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const proposalTxHash = request.nextUrl.searchParams.get('proposalTxHash');
    const proposalIndex = request.nextUrl.searchParams.get('proposalIndex');

    if (!proposalTxHash || proposalIndex == null) {
      return NextResponse.json(
        { error: 'Missing query params: proposalTxHash, proposalIndex' },
        { status: 400 },
      );
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('research_conversations')
      .select('id, messages, created_at, updated_at')
      .eq('user_id', userId)
      .eq('proposal_tx_hash', proposalTxHash)
      .eq('proposal_index', Number(proposalIndex))
      .maybeSingle();

    if (error) {
      logger.error('[Research] Failed to fetch conversation', { error: error.message });
      return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({
        conversation: null,
      });
    }

    return NextResponse.json({
      conversation: {
        id: data.id,
        proposalTxHash,
        proposalIndex: Number(proposalIndex),
        messages: data.messages ?? [],
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    });
  },
  { auth: 'required' },
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseSources(text: string): Array<{ type: string; reference: string; text: string }> {
  const sources: Array<{ type: string; reference: string; text: string }> = [];
  const sourcesMatch = text.match(/Sources:\s*\n([\s\S]*?)$/);
  if (!sourcesMatch) return sources;

  const lines = sourcesMatch[1].split('\n').filter((l) => l.trim().startsWith('-'));
  for (const line of lines) {
    const match = line.match(/\[([^\]]+)\]\s*([^:]+):\s*(.*)/);
    if (match) {
      sources.push({
        type: match[1].trim(),
        reference: match[2].trim(),
        text: match[3].trim(),
      });
    }
  }

  return sources;
}

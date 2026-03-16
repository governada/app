/**
 * Constitutional Check API — AI analysis of proposal against the Cardano Constitution.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { ConstitutionalCheckSchema } from '@/lib/api/schemas/workspace';
import { captureServerEvent } from '@/lib/posthog-server';
import type { ConstitutionalCheckResult, ConstitutionalFlag } from '@/lib/workspace/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const POST = withRouteHandler(
  async (request: NextRequest) => {
    const body = ConstitutionalCheckSchema.parse(await request.json());

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI features not configured' }, { status: 503 });
    }

    const proposalContext = [
      `Title: ${body.title}`,
      body.abstract && `Abstract: ${body.abstract}`,
      body.motivation && `Motivation: ${body.motivation}`,
      body.rationale && `Rationale: ${body.rationale}`,
      `Proposal Type: ${body.proposalType}`,
      body.typeSpecific &&
        Object.keys(body.typeSpecific).length > 0 &&
        `Type-Specific Context: ${JSON.stringify(body.typeSpecific)}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `You are a Cardano constitutional compliance analyst. Analyze the following governance proposal against the Cardano Constitution. For each potential conflict or concern, cite the specific article and section, explain the concern, and rate severity as info/warning/critical.

Return ONLY valid JSON — an array of objects with this shape:
[{"article": "Article X", "section": "Section Y (optional)", "concern": "explanation", "severity": "info|warning|critical"}]

If the proposal has no constitutional concerns, return an empty array: []

PROPOSAL:
${proposalContext}`,
        },
      ],
    });

    const rawText = message.content[0].type === 'text' ? message.content[0].text : '[]';

    // Parse the response — extract JSON from the text
    let flags: ConstitutionalFlag[] = [];
    try {
      // Try to find JSON array in the response
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          flags = parsed.map(
            (f: { article?: string; section?: string; concern?: string; severity?: string }) => ({
              article: f.article ?? 'Unknown',
              section: f.section,
              concern: f.concern ?? '',
              severity: (['info', 'warning', 'critical'].includes(f.severity ?? '')
                ? f.severity
                : 'info') as 'info' | 'warning' | 'critical',
            }),
          );
        }
      }
    } catch {
      // If parsing fails, return empty flags with a warning
      flags = [];
    }

    // Compute overall score
    const hasCritical = flags.some((f) => f.severity === 'critical');
    const hasWarning = flags.some((f) => f.severity === 'warning');
    const score = hasCritical ? 'fail' : hasWarning ? 'warning' : 'pass';

    const result: ConstitutionalCheckResult = {
      flags,
      score,
      checkedAt: new Date().toISOString(),
      model: 'claude-sonnet-4-20250514',
    };

    captureServerEvent('author_constitutional_check_run', {
      proposal_type: body.proposalType,
      flag_count: flags.length,
      score,
    });

    return NextResponse.json(result);
  },
  { auth: 'none', rateLimit: { max: 5, window: 60 } },
);

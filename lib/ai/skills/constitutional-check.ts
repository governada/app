/**
 * Skill: Constitutional Check
 *
 * Analyzes a governance proposal against the Cardano Constitution,
 * flagging potential conflicts with specific article citations.
 */

import { z } from 'zod';
import { registerSkill } from './registry';
import type { SkillContext } from './types';

const inputSchema = z.object({
  title: z.string().min(1),
  abstract: z.string().optional(),
  proposalType: z.string(),
  motivation: z.string().optional(),
  rationale: z.string().optional(),
  typeSpecific: z.record(z.string(), z.unknown()).optional(),
});

type Input = z.infer<typeof inputSchema>;

interface ConstitutionalFlag {
  article: string;
  section?: string;
  concern: string;
  severity: 'info' | 'warning' | 'critical';
}

interface Output {
  flags: ConstitutionalFlag[];
  score: 'pass' | 'warning' | 'fail';
  summary: string;
}

registerSkill<Input, Output>({
  name: 'constitutional-check',
  description:
    'Analyze a governance proposal against the Cardano Constitution, flagging potential conflicts with specific article citations.',
  category: 'shared',
  inputSchema,
  model: 'FAST',
  maxTokens: 2048,

  systemPrompt: (ctx: SkillContext) =>
    `You are a Cardano constitutional compliance analyst. Analyze governance proposals against the Cardano Constitution.

${ctx.personalContextStr ? `The reviewer's governance perspective:\n${ctx.personalContextStr}\n\nFrame your analysis in terms of what constitutional concerns matter most to THIS person.` : ''}

Return ONLY valid JSON with this structure:
{
  "flags": [{"article": "Article X", "section": "Section Y", "concern": "explanation", "severity": "info|warning|critical"}],
  "score": "pass|warning|fail",
  "summary": "One-sentence overall assessment"
}

If no constitutional concerns, return: {"flags": [], "score": "pass", "summary": "No constitutional conflicts detected."}`,

  buildPrompt: (input: Input) => {
    const parts = [`Proposal to analyze: "${input.title}"`, `Type: ${input.proposalType}`];
    if (input.abstract) parts.push(`Abstract: ${input.abstract}`);
    if (input.motivation) parts.push(`Motivation: ${input.motivation}`);
    if (input.rationale) parts.push(`Rationale: ${input.rationale}`);
    if (input.typeSpecific && Object.keys(input.typeSpecific).length > 0) {
      parts.push(`Type-specific context: ${JSON.stringify(input.typeSpecific)}`);
    }
    parts.push(
      '\nAnalyze this proposal for constitutional compliance. Check against all articles of the Cardano Constitution.',
    );
    return parts.join('\n');
  },

  parseOutput: (raw: string): Output => {
    try {
      const cleaned = raw
        .replace(/^```json\s*/, '')
        .replace(/\s*```$/, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      // Handle both formats: array of flags or full object
      if (Array.isArray(parsed)) {
        const hasWarning = parsed.some(
          (f: ConstitutionalFlag) => f.severity === 'warning' || f.severity === 'critical',
        );
        const hasCritical = parsed.some((f: ConstitutionalFlag) => f.severity === 'critical');
        return {
          flags: parsed,
          score: hasCritical ? 'fail' : hasWarning ? 'warning' : 'pass',
          summary:
            parsed.length === 0
              ? 'No constitutional conflicts detected.'
              : `${parsed.length} concern(s) found.`,
        };
      }
      return parsed as Output;
    } catch {
      return {
        flags: [],
        score: 'pass',
        summary: 'Analysis could not be parsed. Please try again.',
      };
    }
  },
});

/**
 * Novelty Classification
 *
 * Determines whether a new annotation is genuinely novel or overlaps
 * with an existing feedback theme. Used when a reviewer adds a new
 * annotation after the sealed period to prompt endorsement vs. new theme.
 */

import { generateJSON } from '@/lib/ai';
import { logger } from '@/lib/logger';
import type { FeedbackTheme, NoveltyClassification } from './types';

const log = logger.withContext('NoveltyClassification');

interface AINoveltyResult {
  isNovel: boolean;
  overlappingThemeId: string | null;
  confidence: number;
  reasoning: string;
}

/**
 * Classify whether an annotation is novel or overlaps an existing theme.
 *
 * If there are no existing themes, the annotation is always novel.
 * Otherwise, sends the text + theme summaries to Claude for comparison.
 */
export async function classifyNovelty(
  annotationText: string,
  existingThemes: FeedbackTheme[],
): Promise<NoveltyClassification> {
  // No existing themes — everything is novel
  if (existingThemes.length === 0) {
    return { isNovel: true, confidence: 1.0 };
  }

  const themeSummaries = existingThemes
    .map((t) => `Theme ID="${t.id}" [${t.category}]: ${t.summary}`)
    .join('\n');

  const prompt = `You are comparing a new reviewer comment against existing feedback themes on a governance proposal.

Existing themes:
${themeSummaries}

New annotation:
"${annotationText}"

Determine:
1. Does this annotation substantially overlap with any existing theme?
2. If yes, which theme ID does it overlap with?
3. How confident are you? (0.0 to 1.0)

An annotation is "novel" if it raises a genuinely new point not covered by any existing theme.
An annotation "overlaps" if it expresses the same concern/point as an existing theme, even if using different words.

Return JSON:
{
  "isNovel": true/false,
  "overlappingThemeId": "theme-id-or-null",
  "confidence": 0.85,
  "reasoning": "Brief explanation"
}`;

  const result = await generateJSON<AINoveltyResult>(prompt, {
    model: 'FAST',
    maxTokens: 512,
    system:
      'You are a governance feedback analyst. Determine semantic overlap between annotations and themes. Return valid JSON only.',
  });

  if (!result) {
    log.warn('AI novelty classification failed, defaulting to novel');
    return { isNovel: true, confidence: 0.5 };
  }

  // Validate that the overlapping theme ID actually exists
  if (result.overlappingThemeId) {
    const themeExists = existingThemes.some((t) => t.id === result.overlappingThemeId);
    if (!themeExists) {
      log.warn('AI returned non-existent theme ID, treating as novel', {
        returnedId: result.overlappingThemeId,
      });
      return { isNovel: true, confidence: 0.5 };
    }
  }

  return {
    isNovel: result.isNovel,
    overlappingThemeId: result.overlappingThemeId ?? undefined,
    confidence: Math.max(0, Math.min(1, result.confidence)),
  };
}

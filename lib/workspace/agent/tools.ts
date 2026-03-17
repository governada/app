/**
 * Agent Tool Definitions
 *
 * Defines 11 Claude tool_use tools for the governance agent. Each tool has:
 * - name: tool identifier
 * - description: what the tool does (for Claude)
 * - input_schema: JSON Schema for the tool input
 * - execute(input, context): function that runs the tool and returns a result
 *
 * Tools reuse existing AI skills and data functions where possible.
 */

import type { GovernanceContextBundle } from './context';
import type { ProposedEdit, ProposedComment } from '../editor/types';
import { computeWordDiff } from '../wordDiff';
import { computeStructuredDiff } from '../diff';
import type { DraftContent } from '../types';
import { getSupabaseAdmin } from '@/lib/supabase';
import { generateJSON, generateText } from '@/lib/ai';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Tool definition type
// ---------------------------------------------------------------------------

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  execute: (
    input: Record<string, unknown>,
    context: GovernanceContextBundle,
    userRole: string,
  ) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  data: unknown;
  /** If the tool produces a ProposedEdit, include it here for SSE emission */
  proposedEdit?: ProposedEdit;
  /** If the tool produces a ProposedComment, include it here for SSE emission */
  proposedComment?: ProposedComment;
  /** Summary string for the tool_result SSE event */
  summary: string;
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

const editProposal: ToolDefinition = {
  name: 'edit_proposal',
  description:
    'Propose an edit to a specific field of the proposal. Generates improved text and returns it as an inline diff for the editor. Only available to proposers.',
  input_schema: {
    type: 'object',
    properties: {
      field: {
        type: 'string',
        enum: ['title', 'abstract', 'motivation', 'rationale'],
        description: 'Which proposal field to edit',
      },
      instruction: {
        type: 'string',
        description:
          'What improvement to make (e.g., "make more specific", "add budget breakdown")',
      },
      selectedText: {
        type: 'string',
        description:
          'Optional: specific text to improve within the field. If omitted, improves the entire field.',
      },
    },
    required: ['field', 'instruction'],
  },
  execute: async (input, context, userRole): Promise<ToolResult> => {
    if (userRole !== 'proposer') {
      return {
        success: false,
        data: null,
        summary: 'Edit proposals is only available to proposers.',
      };
    }

    const field = input.field as 'title' | 'abstract' | 'motivation' | 'rationale';
    const instruction = input.instruction as string;
    const selectedText = input.selectedText as string | undefined;
    const currentText = context.proposal[field] ?? '';

    const textToImprove = selectedText || currentText;
    if (!textToImprove) {
      return {
        success: false,
        data: null,
        summary: `The ${field} field is empty. Write some content first.`,
      };
    }

    const prompt = `You are improving governance proposal text.

Proposal type: ${context.proposal.proposalType}
Field: ${field}
Instruction: ${instruction}

${selectedText ? `Selected text to improve:\n"${selectedText}"\n\nFull field content for context:\n${currentText}` : `Full text to improve:\n${currentText}`}

Return ONLY valid JSON:
{
  "improvedText": "the improved text",
  "explanation": "brief explanation of what changed and why (1-2 sentences)"
}

Guidelines:
- Make it more specific, concrete, and evidence-based
- Maintain the author's voice and intent
- Keep the same approximate length unless specificity requires expansion`;

    const result = await generateJSON<{ improvedText: string; explanation: string }>(prompt, {
      system: 'You are a Cardano governance writing assistant. Return only valid JSON.',
      maxTokens: 1024,
    });

    if (!result) {
      return {
        success: false,
        data: null,
        summary: 'Failed to generate improvement. Please try again.',
      };
    }

    const anchorStart = selectedText ? currentText.indexOf(selectedText) : 0;
    const anchorEnd = selectedText ? anchorStart + selectedText.length : currentText.length;

    const edit: ProposedEdit = {
      field,
      anchorStart: Math.max(0, anchorStart),
      anchorEnd: Math.max(0, anchorEnd),
      originalText: textToImprove,
      proposedText: result.improvedText,
      explanation: result.explanation,
    };

    return {
      success: true,
      data: result,
      proposedEdit: edit,
      summary: `Proposed edit to ${field}: ${result.explanation}`,
    };
  },
};

const draftComment: ToolDefinition = {
  name: 'draft_comment',
  description:
    'Draft an inline comment anchored to specific text in the proposal. Generates a structured review comment for the reviewer to confirm or modify.',
  input_schema: {
    type: 'object',
    properties: {
      anchorText: {
        type: 'string',
        description: 'The text to anchor the comment to (must exist in the proposal)',
      },
      instruction: {
        type: 'string',
        description:
          'What kind of comment to draft (e.g., "flag budget concern", "question the timeline")',
      },
      field: {
        type: 'string',
        enum: ['abstract', 'motivation', 'rationale'],
        description: 'Which field the anchor text is in',
      },
    },
    required: ['anchorText', 'instruction', 'field'],
  },
  execute: async (input, context): Promise<ToolResult> => {
    const anchorText = input.anchorText as string;
    const instruction = input.instruction as string;
    const field = input.field as 'abstract' | 'motivation' | 'rationale';
    const fieldContent = context.proposal[field] ?? '';

    const anchorStart = fieldContent.indexOf(anchorText);
    if (anchorStart === -1) {
      return {
        success: false,
        data: null,
        summary: `Could not find the specified text in the ${field} field.`,
      };
    }

    const prompt = `You are drafting an inline review comment on a governance proposal.

Proposal type: ${context.proposal.proposalType}
Field: ${field}
Anchored to: "${anchorText}"
Instruction: ${instruction}

Full field content for context:
${fieldContent}

Return ONLY valid JSON:
{
  "commentText": "the review comment",
  "category": "note|concern|question|suggestion"
}

Guidelines:
- Be specific and constructive
- Reference data when possible (constitutional articles, precedent, etc.)
- Keep it concise (1-3 sentences)`;

    const result = await generateJSON<{ commentText: string; category: string }>(prompt, {
      system: 'You are a Cardano governance reviewer. Return only valid JSON.',
      maxTokens: 512,
    });

    if (!result) {
      return { success: false, data: null, summary: 'Failed to draft comment. Please try again.' };
    }

    const comment: ProposedComment = {
      field,
      anchorStart,
      anchorEnd: anchorStart + anchorText.length,
      anchorText,
      commentText: result.commentText,
      category: (['note', 'concern', 'question', 'suggestion'].includes(result.category)
        ? result.category
        : 'note') as ProposedComment['category'],
    };

    return {
      success: true,
      data: result,
      proposedComment: comment,
      summary: `Drafted ${comment.category} comment: "${result.commentText.slice(0, 100)}..."`,
    };
  },
};

const checkConstitution: ToolDefinition = {
  name: 'check_constitution',
  description:
    'Analyze the proposal (or a specific section) for constitutional compliance. Returns flags with article citations, severity levels, and an overall score.',
  input_schema: {
    type: 'object',
    properties: {
      section: {
        type: 'string',
        enum: ['abstract', 'motivation', 'rationale'],
        description: 'Optional: analyze only this section. If omitted, analyzes the full proposal.',
      },
    },
  },
  execute: async (input, context): Promise<ToolResult> => {
    const section = input.section as string | undefined;
    const textToAnalyze = section
      ? ((context.proposal[section as keyof typeof context.proposal] as string) ?? '')
      : `Title: ${context.proposal.title}\nAbstract: ${context.proposal.abstract}\nMotivation: ${context.proposal.motivation}\nRationale: ${context.proposal.rationale}`;

    const constitutionalContext = context.constitution.relevantArticles
      .map((a) => `${a.article}${a.section ? ` ${a.section}` : ''}: ${a.text}`)
      .join('\n');

    const prompt = `Analyze this governance proposal for constitutional compliance.

Proposal type: ${context.proposal.proposalType}
${section ? `Section: ${section}` : 'Full proposal'}

Content to analyze:
${textToAnalyze}

Relevant constitutional articles:
${constitutionalContext}

Return ONLY valid JSON:
{
  "flags": [{"article": "Article X", "section": "Section Y", "concern": "explanation", "severity": "info|warning|critical"}],
  "score": "pass|warning|fail",
  "summary": "One-sentence overall assessment"
}`;

    const result = await generateJSON<{
      flags: Array<{ article: string; section?: string; concern: string; severity: string }>;
      score: string;
      summary: string;
    }>(prompt, {
      system: 'You are a Cardano constitutional compliance analyst. Return only valid JSON.',
      maxTokens: 2048,
    });

    if (!result) {
      return {
        success: true,
        data: { flags: [], score: 'pass', summary: 'Analysis could not be completed.' },
        summary: 'Constitutional analysis could not be completed.',
      };
    }

    return {
      success: true,
      data: result,
      summary: `Constitutional check: ${result.score.toUpperCase()} - ${result.summary}`,
    };
  },
};

const searchPrecedent: ToolDefinition = {
  name: 'search_precedent',
  description:
    'Find similar past governance proposals and analyze their outcomes. Useful for understanding how the community has voted on comparable proposals.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'Optional search query to refine precedent search. If omitted, uses the current proposal as context.',
      },
    },
  },
  execute: async (_input, context): Promise<ToolResult> => {
    const precedent = context.precedent;

    if (precedent.length === 0) {
      return {
        success: true,
        data: { proposals: [], summary: 'No similar past proposals found.' },
        summary: 'No similar past proposals found in the database.',
      };
    }

    const proposalList = precedent.map((p) => `- "${p.title}" (${p.outcome})`).join('\n');

    return {
      success: true,
      data: {
        proposals: precedent,
        summary: `Found ${precedent.length} similar proposals`,
      },
      summary: `Found ${precedent.length} similar proposals:\n${proposalList}`,
    };
  },
};

const getVotingData: ToolDefinition = {
  name: 'get_voting_data',
  description:
    'Get the current voting tallies for this proposal, including DRep, SPO, and CC votes, and the voting deadline.',
  input_schema: {
    type: 'object',
    properties: {},
  },
  execute: async (_input, context): Promise<ToolResult> => {
    const v = context.voting;
    const totalDRep = v.drep.yes + v.drep.no + v.drep.abstain;

    if (totalDRep === 0 && v.spo.yes + v.spo.no + v.spo.abstain === 0) {
      return {
        success: true,
        data: v,
        summary: 'No votes recorded yet for this proposal.',
      };
    }

    const parts = [
      `DRep: ${v.drep.yes} Yes, ${v.drep.no} No, ${v.drep.abstain} Abstain`,
      `SPO: ${v.spo.yes} Yes, ${v.spo.no} No, ${v.spo.abstain} Abstain`,
      `CC: ${v.cc.yes} Yes, ${v.cc.no} No, ${v.cc.abstain} Abstain`,
    ];
    if (v.epochsRemaining != null) {
      parts.push(`Deadline: ${v.epochsRemaining} epochs remaining`);
    }

    return {
      success: true,
      data: v,
      summary: parts.join('. '),
    };
  },
};

const getCommunityFeedback: ToolDefinition = {
  name: 'get_community_feedback',
  description:
    'Get consolidated community feedback themes for this proposal, including endorsement counts and key voices.',
  input_schema: {
    type: 'object',
    properties: {},
  },
  execute: async (_input, context): Promise<ToolResult> => {
    const { themes, totalReviewers, totalAnnotations } = context.community;

    if (themes.length === 0) {
      return {
        success: true,
        data: context.community,
        summary:
          totalAnnotations > 0
            ? `${totalAnnotations} annotations from ${totalReviewers} reviewers, but no consolidated themes yet.`
            : 'No community feedback received yet.',
      };
    }

    const themeSummary = themes
      .slice(0, 5)
      .map(
        (t) =>
          `- [${t.category.toUpperCase()}] "${t.summary}" (${t.endorsementCount} endorsements, ${t.addressedStatus})`,
      )
      .join('\n');

    return {
      success: true,
      data: context.community,
      summary: `${totalReviewers} reviewers, ${themes.length} themes:\n${themeSummary}`,
    };
  },
};

const getTreasuryContext: ToolDefinition = {
  name: 'get_treasury_context',
  description:
    'Get the current Cardano treasury state, including balance, recent withdrawals, and tier classification. Most useful for Treasury Withdrawal proposals.',
  input_schema: {
    type: 'object',
    properties: {},
  },
  execute: async (_input, context): Promise<ToolResult> => {
    if (!context.treasury) {
      return {
        success: true,
        data: null,
        summary: 'Treasury context is not applicable to this proposal type.',
      };
    }

    const t = context.treasury;
    return {
      success: true,
      data: t,
      summary: `Treasury balance: ${Math.round(t.balance).toLocaleString()} ADA. Recent withdrawals: ${Math.round(t.recentWithdrawals).toLocaleString()} ADA. Tier: ${t.tier}.`,
    };
  },
};

const getProposalHealth: ToolDefinition = {
  name: 'get_proposal_health',
  description:
    'Assess the completeness and quality of the proposal content. Returns a health score and specific checks for missing or weak sections.',
  input_schema: {
    type: 'object',
    properties: {},
  },
  execute: async (_input, context): Promise<ToolResult> => {
    const p = context.proposal;

    const checks = [
      { label: 'Has title', passed: !!p.title && p.title.length > 0, weight: 1 },
      { label: 'Has abstract', passed: !!p.abstract && p.abstract.length > 20, weight: 2 },
      { label: 'Has motivation', passed: !!p.motivation && p.motivation.length > 50, weight: 2 },
      { label: 'Has rationale', passed: !!p.rationale && p.rationale.length > 50, weight: 2 },
      {
        label: 'Abstract is substantive (100+ chars)',
        passed: !!p.abstract && p.abstract.length >= 100,
        weight: 1,
      },
      {
        label: 'Motivation is substantive (200+ chars)',
        passed: !!p.motivation && p.motivation.length >= 200,
        weight: 1,
      },
      {
        label: 'Rationale is substantive (200+ chars)',
        passed: !!p.rationale && p.rationale.length >= 200,
        weight: 1,
      },
    ];

    // Add type-specific checks
    if (p.proposalType === 'TreasuryWithdrawals') {
      const hasBudget =
        (p.rationale?.toLowerCase().includes('budget') ?? false) ||
        (p.rationale?.toLowerCase().includes('cost') ?? false) ||
        (p.motivation?.toLowerCase().includes('budget') ?? false);
      checks.push({
        label: 'Budget mentioned in rationale or motivation',
        passed: hasBudget,
        weight: 2,
      });

      const hasTimeline =
        (p.rationale?.toLowerCase().includes('timeline') ?? false) ||
        (p.rationale?.toLowerCase().includes('milestone') ?? false) ||
        (p.rationale?.toLowerCase().includes('deliverable') ?? false);
      checks.push({
        label: 'Timeline/milestones mentioned',
        passed: hasTimeline,
        weight: 1,
      });
    }

    const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
    const earnedWeight = checks.reduce((sum, c) => sum + (c.passed ? c.weight : 0), 0);
    const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

    const failing = checks.filter((c) => !c.passed).map((c) => c.label);

    return {
      success: true,
      data: { score, checks },
      summary:
        score >= 80
          ? `Proposal health: ${score}/100 -- Good shape.`
          : `Proposal health: ${score}/100 -- Missing: ${failing.join(', ')}.`,
    };
  },
};

const compareVersions: ToolDefinition = {
  name: 'compare_versions',
  description:
    'Compare two versions of the proposal and show word-level differences for each field. Useful for understanding what changed between revisions.',
  input_schema: {
    type: 'object',
    properties: {
      oldVersion: {
        type: 'number',
        description: 'The older version number to compare from',
      },
      newVersion: {
        type: 'number',
        description: 'The newer version number to compare to',
      },
    },
    required: ['oldVersion', 'newVersion'],
  },
  execute: async (input, context): Promise<ToolResult> => {
    const oldVersionNum = input.oldVersion as number;
    const newVersionNum = input.newVersion as number;

    // Fetch version content from DB
    const supabase = getSupabaseAdmin();
    const { data: versions } = await supabase
      .from('proposal_draft_versions')
      .select('version_number, content')
      .eq('draft_id', context.proposal.id)
      .in('version_number', [oldVersionNum, newVersionNum]);

    if (!versions || versions.length < 2) {
      return {
        success: false,
        data: null,
        summary: `Could not find both version ${oldVersionNum} and version ${newVersionNum}.`,
      };
    }

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const oldContent = versions.find((v: any) => v.version_number === oldVersionNum)?.content as
      | DraftContent
      | undefined;
    const newContent = versions.find((v: any) => v.version_number === newVersionNum)?.content as
      | DraftContent
      | undefined;
    /* eslint-enable @typescript-eslint/no-explicit-any */

    if (!oldContent || !newContent) {
      return { success: false, data: null, summary: 'Version content not found.' };
    }

    const structuredDiff = computeStructuredDiff(oldContent, newContent);
    const fieldDiffs: Record<
      string,
      { hasChanges: boolean; segments: Array<{ type: string; text: string }> }
    > = {};

    for (const field of ['title', 'abstract', 'motivation', 'rationale'] as const) {
      const oldText = oldContent[field] ?? '';
      const newText = newContent[field] ?? '';
      const wordDiff = computeWordDiff(oldText, newText);
      const hasChanges = wordDiff.some((s) => s.type !== 'unchanged');
      fieldDiffs[field] = { hasChanges, segments: wordDiff };
    }

    return {
      success: true,
      data: {
        fieldsChanged: structuredDiff.fieldsChanged,
        fieldDiffs,
      },
      summary:
        structuredDiff.fieldsChanged.length > 0
          ? `${structuredDiff.fieldsChanged.length} fields changed between v${oldVersionNum} and v${newVersionNum}: ${structuredDiff.fieldsChanged.join(', ')}`
          : `No differences found between v${oldVersionNum} and v${newVersionNum}.`,
    };
  },
};

const getRevisionContext: ToolDefinition = {
  name: 'get_revision_context',
  description:
    'Get the revision context for a specific version, including which fields changed, the justifications provided by the proposer, and which feedback themes were addressed.',
  input_schema: {
    type: 'object',
    properties: {
      versionNumber: {
        type: 'number',
        description: 'The version number to get revision context for',
      },
    },
    required: ['versionNumber'],
  },
  execute: async (input, context): Promise<ToolResult> => {
    const versionNumber = input.versionNumber as number;
    const version = context.versions.find((v) => v.versionNumber === versionNumber);

    if (!version) {
      return {
        success: false,
        data: null,
        summary: `Version ${versionNumber} not found.`,
      };
    }

    const justifications = version.changeJustifications ?? [];
    const addressedFields = justifications.map((j) => j.field);
    const linkedThemes = justifications.filter((j) => j.linkedThemeId).map((j) => j.linkedThemeId);

    return {
      success: true,
      data: {
        versionNumber,
        versionName: version.versionName,
        createdAt: version.createdAt,
        changedFields: addressedFields,
        justifications,
        addressedThemes: linkedThemes,
      },
      summary:
        justifications.length > 0
          ? `Version ${versionNumber} changed ${addressedFields.length} fields with ${justifications.length} justification(s).`
          : `Version ${versionNumber} has no recorded change justifications.`,
    };
  },
};

const draftJustification: ToolDefinition = {
  name: 'draft_justification',
  description:
    'Generate a change justification for a revised section. Explains WHY the text changed, referencing community feedback themes when applicable. Used by proposers when submitting revisions.',
  input_schema: {
    type: 'object',
    properties: {
      field: {
        type: 'string',
        enum: ['title', 'abstract', 'motivation', 'rationale'],
        description: 'Which field was changed',
      },
      oldText: {
        type: 'string',
        description: 'The previous version of the text',
      },
      newText: {
        type: 'string',
        description: 'The new version of the text',
      },
    },
    required: ['field', 'oldText', 'newText'],
  },
  execute: async (input, context, userRole): Promise<ToolResult> => {
    if (userRole !== 'proposer') {
      return {
        success: false,
        data: null,
        summary: 'Draft justification is only available to proposers.',
      };
    }

    const field = input.field as string;
    const oldText = input.oldText as string;
    const newText = input.newText as string;

    // Get community themes that might have prompted this change
    const relevantThemes = context.community.themes
      .filter((t) => t.addressedStatus === 'open')
      .slice(0, 5);

    const themeContext =
      relevantThemes.length > 0
        ? `\nRelevant community feedback themes:\n${relevantThemes.map((t) => `- "${t.summary}" (${t.endorsementCount} endorsements)`).join('\n')}`
        : '';

    const prompt = `Generate a brief change justification for a governance proposal revision.

Field: ${field}

Previous text:
${oldText.slice(0, 500)}

New text:
${newText.slice(0, 500)}
${themeContext}

Write a 1-2 sentence justification explaining WHY this change was made. If it addresses community feedback, reference the feedback theme. Be specific and factual.

Return ONLY valid JSON:
{
  "justification": "the justification text",
  "linkedThemeId": null
}`;

    const result = await generateText(prompt, {
      system: 'You are a governance proposal revision assistant. Return only valid JSON.',
      maxTokens: 256,
    });

    if (!result) {
      return { success: false, data: null, summary: 'Failed to generate justification.' };
    }

    try {
      const cleaned = result
        .replace(/^```json\s*/, '')
        .replace(/\s*```$/, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      return {
        success: true,
        data: parsed,
        summary: `Justification: ${parsed.justification}`,
      };
    } catch {
      return {
        success: true,
        data: { justification: result, linkedThemeId: null },
        summary: `Justification: ${result.slice(0, 200)}`,
      };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool Registry
// ---------------------------------------------------------------------------

export const AGENT_TOOLS: ToolDefinition[] = [
  editProposal,
  draftComment,
  checkConstitution,
  searchPrecedent,
  getVotingData,
  getCommunityFeedback,
  getTreasuryContext,
  getProposalHealth,
  compareVersions,
  getRevisionContext,
  draftJustification,
];

/** Get tool definitions in Claude tool_use format (without execute functions) */
export function getToolDefinitions(userRole: string): Array<{
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}> {
  // Filter tools based on role
  return AGENT_TOOLS.filter((tool) => {
    // edit_proposal is proposer-only
    if (tool.name === 'edit_proposal' && userRole !== 'proposer') return false;
    // draft_justification is proposer-only
    if (tool.name === 'draft_justification' && userRole !== 'proposer') return false;
    return true;
  }).map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema,
  }));
}

/** Execute a tool by name */
export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  context: GovernanceContextBundle,
  userRole: string,
): Promise<ToolResult> {
  const tool = AGENT_TOOLS.find((t) => t.name === toolName);
  if (!tool) {
    return {
      success: false,
      data: null,
      summary: `Unknown tool: ${toolName}`,
    };
  }

  try {
    return await tool.execute(input, context, userRole);
  } catch (err) {
    logger.error('[Agent Tools] Tool execution error', { toolName, error: err });
    return {
      success: false,
      data: null,
      summary: `Tool ${toolName} failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

/**
 * Shared helpers for Studio editor integration (author + review flows).
 *
 * Centralises slash-command prompts, editor-context building, and inline
 * comment injection so both the author editor page and ReviewWorkspace can
 * import from a single location.
 */

import type { Editor } from '@tiptap/core';
import type {
  EditorMode,
  EditorContext,
  ProposalField,
  ProposedComment,
  SlashCommandType,
} from '@/lib/workspace/editor/types';

// ---------------------------------------------------------------------------
// Slash command -> agent prompt mapping
// ---------------------------------------------------------------------------

export const SLASH_COMMAND_PROMPTS: Record<SlashCommandType, (section: string) => string> = {
  improve: (section) =>
    `Please suggest improvements to the ${section} section of my proposal. Focus on clarity, persuasiveness, and completeness.`,
  'check-constitution': (section) =>
    `Check the ${section} section for constitutional alignment. Flag any potential issues with the Cardano Constitution.`,
  'similar-proposals': (_section) =>
    `Search for similar governance proposals that have been submitted before. Show me precedents and their outcomes.`,
  complete: (section) =>
    `Continue writing the ${section} section from where I left off. Match the existing tone and style.`,
  draft: (section) =>
    `Draft content for the ${section} section based on the other sections and the proposal type.`,
};

// ---------------------------------------------------------------------------
// EditorContext builder
// ---------------------------------------------------------------------------

export function buildEditorContext(
  editor: Editor | null,
  draftContent: { title: string; abstract: string; motivation: string; rationale: string },
  mode: EditorMode,
): EditorContext {
  let selectedText: string | undefined;
  let cursorSection: ProposalField | undefined;

  if (editor) {
    const { from, to, empty } = editor.state.selection;
    if (!empty) {
      selectedText = editor.state.doc.textBetween(from, to, '\n');
    }

    const resolvedPos = editor.state.doc.resolve(from);
    for (let depth = resolvedPos.depth; depth >= 0; depth--) {
      const node = resolvedPos.node(depth);
      if (node.type.name === 'sectionBlock' && node.attrs.field) {
        cursorSection = node.attrs.field as ProposalField;
        break;
      }
    }
  }

  return {
    selectedText,
    cursorSection,
    currentContent: {
      title: draftContent.title,
      abstract: draftContent.abstract,
      motivation: draftContent.motivation,
      rationale: draftContent.rationale,
    },
    mode,
  };
}

// ---------------------------------------------------------------------------
// Comment injection helper
// ---------------------------------------------------------------------------

export function injectInlineComment(editor: Editor, comment: ProposedComment): void {
  const { doc } = editor.state;
  let sectionStart = 0;
  let found = false;

  doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.name === 'sectionBlock' && node.attrs.field === comment.field) {
      sectionStart = pos + 1;
      found = true;
      return false;
    }
  });

  if (found) {
    const from = sectionStart + comment.anchorStart;
    const to = sectionStart + comment.anchorEnd;

    if (from >= 0 && to <= doc.content.size && from < to) {
      const commentId = `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      editor
        .chain()
        .focus()
        .setMark('inlineComment', {
          id: commentId,
          author: 'Agent',
          authorId: 'agent',
          timestamp: new Date().toISOString(),
          category: comment.category,
          text: comment.commentText,
        })
        .setTextSelection({ from, to })
        .run();
    }
  }
}

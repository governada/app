'use client';

/**
 * InlineComment — Custom Tiptap mark extension for text-anchored comments.
 *
 * Each comment has: author, timestamp, category (note/concern/question/suggestion),
 * and text content. Click to expand a popover showing the comment details.
 * Different visual styles for own vs. others' comments.
 *
 * This extension provides:
 * 1. A Tiptap mark that wraps commented text with visual indicators
 * 2. A ProseMirror plugin that manages popover state
 * 3. React UI components for the comment popover
 */

import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { InlineCommentData } from '@/lib/workspace/editor/types';

// ---------------------------------------------------------------------------
// Category styling
// ---------------------------------------------------------------------------

const CATEGORY_STYLES: Record<
  InlineCommentData['category'],
  { bg: string; border: string; label: string; icon: string }
> = {
  note: {
    bg: 'bg-yellow-200/40 dark:bg-yellow-900/25',
    border: 'border-yellow-400 dark:border-yellow-600',
    label: 'Note',
    icon: '\uD83D\uDCDD',
  },
  concern: {
    bg: 'bg-red-200/40 dark:bg-red-900/25',
    border: 'border-red-400 dark:border-red-600',
    label: 'Concern',
    icon: '\u26A0\uFE0F',
  },
  question: {
    bg: 'bg-blue-200/40 dark:bg-blue-900/25',
    border: 'border-blue-400 dark:border-blue-600',
    label: 'Question',
    icon: '\u2753',
  },
  suggestion: {
    bg: 'bg-emerald-200/40 dark:bg-emerald-900/25',
    border: 'border-emerald-400 dark:border-emerald-600',
    label: 'Suggestion',
    icon: '\uD83D\uDCA1',
  },
};

// ---------------------------------------------------------------------------
// Plugin state for popover management
// ---------------------------------------------------------------------------

interface CommentPopoverState {
  /** The comment ID currently shown in the popover */
  activeCommentId: string | null;
  /** Screen coordinates for the popover */
  coords: { top: number; left: number } | null;
}

const commentPopoverKey = new PluginKey<CommentPopoverState>('inlineCommentPopover');

const SHOW_COMMENT_POPOVER = 'showCommentPopover';
const HIDE_COMMENT_POPOVER = 'hideCommentPopover';

// ---------------------------------------------------------------------------
// Mark extension
// ---------------------------------------------------------------------------

export interface InlineCommentOptions {
  /** The current user's ID (for styling own vs others' comments) */
  currentUserId?: string;
  /** Called when a comment mark is clicked */
  onCommentClick?: (comment: InlineCommentData, coords: { top: number; left: number }) => void;
}

export const InlineComment = Mark.create<InlineCommentOptions>({
  name: 'inlineComment',
  excludes: '', // don't exclude other marks
  inclusive: false,

  addOptions() {
    return {
      currentUserId: undefined,
      onCommentClick: undefined,
    };
  },

  addAttributes() {
    return {
      id: { default: null },
      author: { default: '' },
      authorId: { default: '' },
      timestamp: { default: '' },
      category: { default: 'note' },
      text: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-inline-comment]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const category = (HTMLAttributes.category as InlineCommentData['category']) || 'note';
    const style = CATEGORY_STYLES[category];
    const isOwn = HTMLAttributes.authorId === this.options.currentUserId;

    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-inline-comment': '',
        'data-comment-id': HTMLAttributes.id as string,
        'data-comment-category': category,
        class: [
          'inline-comment cursor-pointer rounded-sm transition-all',
          isOwn ? style.bg : 'underline decoration-dotted decoration-1 underline-offset-4',
          isOwn ? '' : 'decoration-muted-foreground/50',
          'hover:ring-1 hover:ring-primary/30',
        ]
          .filter(Boolean)
          .join(' '),
        title: `${style.label}: ${(HTMLAttributes.text as string)?.slice(0, 80)}...`,
      }),
      0,
    ];
  },

  addProseMirrorPlugins() {
    const extensionOptions = this.options;

    return [
      new Plugin<CommentPopoverState>({
        key: commentPopoverKey,

        state: {
          init(): CommentPopoverState {
            return { activeCommentId: null, coords: null };
          },

          apply(tr, value): CommentPopoverState {
            const show = tr.getMeta(SHOW_COMMENT_POPOVER) as
              | { commentId: string; coords: { top: number; left: number } }
              | undefined;
            if (show) {
              return { activeCommentId: show.commentId, coords: show.coords };
            }

            if (tr.getMeta(HIDE_COMMENT_POPOVER)) {
              return { activeCommentId: null, coords: null };
            }

            return value;
          },
        },

        props: {
          handleClick(view, pos, event) {
            const target = event.target as HTMLElement;
            const commentEl = target.closest('[data-comment-id]');

            if (!commentEl) {
              // Click outside a comment — close any open popover
              const state = commentPopoverKey.getState(view.state);
              if (state?.activeCommentId) {
                view.dispatch(view.state.tr.setMeta(HIDE_COMMENT_POPOVER, true));
              }
              return false;
            }

            const commentId = commentEl.getAttribute('data-comment-id');
            if (!commentId) return false;

            // Find the comment data from the marks at this position
            const resolved = view.state.doc.resolve(pos);
            const marks = resolved.marks();
            const commentMark = marks.find(
              (m) => m.type.name === 'inlineComment' && m.attrs.id === commentId,
            );

            if (!commentMark) return false;

            const rect = commentEl.getBoundingClientRect();
            const coords = {
              top: rect.bottom + 4,
              left: Math.max(8, Math.min(rect.left, window.innerWidth - 320)),
            };

            // Fire the callback
            extensionOptions.onCommentClick?.(
              {
                id: commentMark.attrs.id as string,
                author: commentMark.attrs.author as string,
                authorId: commentMark.attrs.authorId as string,
                timestamp: commentMark.attrs.timestamp as string,
                category: commentMark.attrs.category as InlineCommentData['category'],
                text: commentMark.attrs.text as string,
              },
              coords,
            );

            // Update popover state
            view.dispatch(view.state.tr.setMeta(SHOW_COMMENT_POPOVER, { commentId, coords }));

            return true;
          },
        },
      }),
    ];
  },
});

// ---------------------------------------------------------------------------
// React popover component — rendered by ProposalEditor
// ---------------------------------------------------------------------------

interface CommentPopoverProps {
  comment: InlineCommentData;
  coords: { top: number; left: number };
  isOwn: boolean;
  onClose: () => void;
  onDelete?: (commentId: string) => void;
}

export function CommentPopover({ comment, coords, isOwn, onClose, onDelete }: CommentPopoverProps) {
  const style = CATEGORY_STYLES[comment.category];

  return (
    <div
      className="comment-popover fixed z-50 w-72 rounded-lg border border-border bg-popover shadow-lg overflow-hidden"
      style={{ top: coords.top, left: coords.left }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between px-3 py-2 border-b ${style.border} bg-muted/20`}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{style.icon}</span>
          <span className="text-[11px] font-medium text-foreground/80">{style.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {formatTimestamp(comment.timestamp)}
          </span>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-3 py-2.5 space-y-2">
        <p className="text-sm leading-relaxed text-foreground/90">{comment.text}</p>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-muted-foreground">
            {isOwn ? 'You' : comment.author || comment.authorId.slice(0, 8) + '...'}
          </span>
          {isOwn && onDelete && (
            <button
              onClick={() => onDelete(comment.id)}
              className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(timestamp: string): string {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHrs = diffMs / (1000 * 60 * 60);

    if (diffHrs < 1) return `${Math.floor(diffMs / 60000)}m ago`;
    if (diffHrs < 24) return `${Math.floor(diffHrs)}h ago`;
    if (diffHrs < 168) return `${Math.floor(diffHrs / 24)}d ago`;
    return date.toLocaleDateString();
  } catch {
    return timestamp;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Add an inline comment mark to the editor at the given range.
 */
export function addInlineComment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any,
  comment: InlineCommentData,
  from: number,
  to: number,
): void {
  editor
    .chain()
    .focus()
    .command(
      ({ tr }: { tr: { addMark: (from: number, to: number, mark: unknown) => unknown } }) => {
        const markType = editor.schema.marks.inlineComment;
        const mark = markType.create({
          id: comment.id,
          author: comment.author,
          authorId: comment.authorId,
          timestamp: comment.timestamp,
          category: comment.category,
          text: comment.text,
        });
        tr.addMark(from, to, mark);
        return true;
      },
    )
    .run();
}

/**
 * Remove an inline comment mark by ID.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function removeInlineComment(editor: any, commentId: string): void {
  // Find all ranges with this comment ID
  const ranges: Array<{ from: number; to: number }> = [];

  editor.state.doc.descendants(
    (
      node: {
        isText: boolean;
        marks: Array<{ type: { name: string }; attrs: { id: string } }>;
        nodeSize: number;
      },
      pos: number,
    ) => {
      if (!node.isText) return;
      const mark = node.marks.find(
        (m: { type: { name: string }; attrs: { id: string } }) =>
          m.type.name === 'inlineComment' && m.attrs.id === commentId,
      );
      if (mark) {
        ranges.push({ from: pos, to: pos + node.nodeSize });
      }
    },
  );

  if (ranges.length === 0) return;

  editor
    .chain()
    .focus()
    .command(
      ({ tr }: { tr: { removeMark: (from: number, to: number, mark: unknown) => void } }) => {
        for (const range of ranges) {
          tr.removeMark(range.from, range.to, editor.schema.marks.inlineComment);
        }
        return true;
      },
    )
    .run();
}

export { CATEGORY_STYLES };

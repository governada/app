'use client';

/**
 * AICompletionDecoration — ProseMirror decoration plugin for ghost text completions.
 *
 * Renders faded, non-selectable ghost text after the cursor position. Tab to accept
 * (inserts the ghost text as real content). Shows AI completion suggestions.
 *
 * Architecture:
 * - The extension stores the completion text in plugin state
 * - A decoration widget renders the ghost text at the cursor position
 * - Tab inserts the text and clears the completion
 * - Any other keystroke clears the completion
 * - Escape explicitly clears the completion
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// ---------------------------------------------------------------------------
// Plugin state
// ---------------------------------------------------------------------------

interface CompletionState {
  /** The ghost text to display */
  text: string | null;
  /** Position where the ghost text should appear */
  pos: number | null;
}

const completionPluginKey = new PluginKey<CompletionState>('aiCompletion');

// ---------------------------------------------------------------------------
// Transactions metadata
// ---------------------------------------------------------------------------

const SET_COMPLETION = 'setCompletion';
const CLEAR_COMPLETION = 'clearCompletion';
const ACCEPT_COMPLETION = 'acceptCompletion';

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export interface AICompletionOptions {
  /** Called when a completion is accepted (Tab pressed) */
  onAccept?: (text: string) => void;
  /** Called when a completion is dismissed */
  onDismiss?: () => void;
}

export const AICompletion = Extension.create<AICompletionOptions>({
  name: 'aiCompletion',

  addOptions() {
    return {
      onAccept: undefined,
      onDismiss: undefined,
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const state = completionPluginKey.getState(this.editor.state);
        if (!state?.text || state.pos === null) return false;

        const completionText = state.text;
        const pos = state.pos;

        // Insert the completion text
        this.editor
          .chain()
          .focus()
          .command(({ tr }) => {
            tr.insertText(completionText, pos);
            tr.setMeta(ACCEPT_COMPLETION, true);
            return true;
          })
          .run();

        this.options.onAccept?.(completionText);
        return true;
      },
      Escape: () => {
        const state = completionPluginKey.getState(this.editor.state);
        if (!state?.text) return false;

        this.editor.view.dispatch(this.editor.state.tr.setMeta(CLEAR_COMPLETION, true));
        this.options.onDismiss?.();
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<CompletionState>({
        key: completionPluginKey,

        state: {
          init(): CompletionState {
            return { text: null, pos: null };
          },

          apply(tr, value): CompletionState {
            // Handle explicit set/clear/accept
            if (tr.getMeta(CLEAR_COMPLETION) || tr.getMeta(ACCEPT_COMPLETION)) {
              return { text: null, pos: null };
            }

            const setData = tr.getMeta(SET_COMPLETION) as { text: string; pos: number } | undefined;
            if (setData) {
              return { text: setData.text, pos: setData.pos };
            }

            // Clear on any document change (user typed something)
            if (tr.docChanged && value.text) {
              return { text: null, pos: null };
            }

            // Map position through transaction if selection changed
            if (value.pos !== null && tr.mapping) {
              return {
                ...value,
                pos: tr.mapping.map(value.pos),
              };
            }

            return value;
          },
        },

        props: {
          decorations(state) {
            const pluginState = completionPluginKey.getState(state);
            if (!pluginState?.text || pluginState.pos === null) {
              return DecorationSet.empty;
            }

            // Create a widget decoration at the cursor position
            const widget = Decoration.widget(
              pluginState.pos,
              () => {
                const span = document.createElement('span');
                span.className =
                  'ai-ghost-text text-muted-foreground/40 pointer-events-none select-none';
                span.setAttribute('contenteditable', 'false');
                span.setAttribute('data-ai-completion', 'true');
                span.textContent = pluginState.text!;
                return span;
              },
              {
                side: 1, // render after the position
                key: 'ai-completion-ghost',
              },
            );

            return DecorationSet.create(state.doc, [widget]);
          },
        },
      }),
    ];
  },
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Set a completion suggestion in the editor.
 * The ghost text will appear at the specified position.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setCompletion(editor: any, text: string, pos: number): void {
  const tr = editor.view.state.tr.setMeta(SET_COMPLETION, { text, pos });
  editor.view.dispatch(tr);
}

/**
 * Clear any active completion suggestion.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function clearCompletion(editor: any): void {
  const tr = editor.view.state.tr.setMeta(CLEAR_COMPLETION, true);
  editor.view.dispatch(tr);
}

/**
 * Check if there's an active completion.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function hasCompletion(editor: any): boolean {
  const state = completionPluginKey.getState(editor.state);
  return !!state?.text;
}

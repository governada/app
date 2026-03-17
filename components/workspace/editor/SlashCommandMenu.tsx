'use client';

/**
 * SlashCommandMenu — Slash command dropdown for the Tiptap editor.
 *
 * Appears when user types `/` at the start of a line. Shows governance-specific
 * AI commands: /improve, /check-constitution, /similar-proposals, /complete, /draft.
 *
 * Each command fires an `onSlashCommand(command, sectionContext)` callback.
 * The extension handles the UI (dropdown rendering, keyboard navigation)
 * but does NOT call any APIs directly.
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';
import type { SlashCommandType } from '@/lib/workspace/editor/types';

// ---------------------------------------------------------------------------
// Command definitions
// ---------------------------------------------------------------------------

interface CommandDef {
  id: SlashCommandType;
  label: string;
  description: string;
  icon: string;
}

const COMMANDS: CommandDef[] = [
  {
    id: 'improve',
    label: 'Improve',
    description: 'AI improves the selected text or current section',
    icon: '\u2728', // sparkles
  },
  {
    id: 'check-constitution',
    label: 'Check Constitution',
    description: 'Analyze constitutional compliance of this section',
    icon: '\u2696\uFE0F', // scales
  },
  {
    id: 'similar-proposals',
    label: 'Similar Proposals',
    description: 'Find precedent from past governance proposals',
    icon: '\uD83D\uDD0D', // magnifying glass
  },
  {
    id: 'complete',
    label: 'Complete',
    description: 'AI suggests what is missing from this section',
    icon: '\uD83D\uDCDD', // memo
  },
  {
    id: 'draft',
    label: 'Draft',
    description: 'AI drafts content from your instructions',
    icon: '\u270D\uFE0F', // writing hand
  },
];

// ---------------------------------------------------------------------------
// Plugin state
// ---------------------------------------------------------------------------

interface SlashMenuState {
  active: boolean;
  query: string;
  selectedIndex: number;
  triggerPos: number | null;
  decorationSet: DecorationSet;
}

const slashMenuPluginKey = new PluginKey<SlashMenuState>('slashCommandMenu');

// ---------------------------------------------------------------------------
// Menu DOM rendering
// ---------------------------------------------------------------------------

function createMenuElement(
  commands: CommandDef[],
  selectedIndex: number,
  onSelect: (command: SlashCommandType) => void,
): HTMLElement {
  const container = document.createElement('div');
  container.className =
    'slash-command-menu fixed z-50 w-64 rounded-lg border border-border bg-popover shadow-lg overflow-hidden py-1';
  container.setAttribute('role', 'listbox');

  commands.forEach((cmd, index) => {
    const item = document.createElement('div');
    item.className = `slash-command-item flex items-center gap-3 px-3 py-2 cursor-pointer text-sm transition-colors ${
      index === selectedIndex
        ? 'bg-accent text-accent-foreground'
        : 'text-foreground hover:bg-accent/50'
    }`;
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', String(index === selectedIndex));

    const iconSpan = document.createElement('span');
    iconSpan.className = 'text-base flex-shrink-0';
    iconSpan.textContent = cmd.icon;

    const textContainer = document.createElement('div');
    textContainer.className = 'flex flex-col min-w-0';

    const label = document.createElement('span');
    label.className = 'font-medium text-[13px] leading-tight';
    label.textContent = `/${cmd.label.toLowerCase().replace(/\s+/g, '-')}`;

    const desc = document.createElement('span');
    desc.className = 'text-[11px] text-muted-foreground leading-tight truncate';
    desc.textContent = cmd.description;

    textContainer.appendChild(label);
    textContainer.appendChild(desc);
    item.appendChild(iconSpan);
    item.appendChild(textContainer);

    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onSelect(cmd.id);
    });

    container.appendChild(item);
  });

  return container;
}

// ---------------------------------------------------------------------------
// Helper: get current section context from cursor position
// ---------------------------------------------------------------------------

function getSectionContext(view: EditorView): string {
  const { state } = view;
  const { $from } = state.selection;

  // Walk up from cursor to find the sectionBlock
  for (let depth = $from.depth; depth >= 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === 'sectionBlock') {
      return node.attrs.field as string;
    }
  }

  return 'unknown';
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export interface SlashCommandMenuOptions {
  /** Called when a slash command is selected */
  onSlashCommand?: (command: SlashCommandType, sectionContext: string) => void;
}

export const SlashCommandMenu = Extension.create<SlashCommandMenuOptions>({
  name: 'slashCommandMenu',

  addOptions() {
    return {
      onSlashCommand: undefined,
    };
  },

  addKeyboardShortcuts() {
    return {
      ArrowUp: () => {
        const state = slashMenuPluginKey.getState(this.editor.state);
        if (!state?.active) return false;
        const filtered = filterCommands(state.query);
        const newIndex = (state.selectedIndex - 1 + filtered.length) % filtered.length;
        this.editor.view.dispatch(
          this.editor.state.tr.setMeta(slashMenuPluginKey, {
            type: 'updateIndex',
            index: newIndex,
          }),
        );
        return true;
      },
      ArrowDown: () => {
        const state = slashMenuPluginKey.getState(this.editor.state);
        if (!state?.active) return false;
        const filtered = filterCommands(state.query);
        const newIndex = (state.selectedIndex + 1) % filtered.length;
        this.editor.view.dispatch(
          this.editor.state.tr.setMeta(slashMenuPluginKey, {
            type: 'updateIndex',
            index: newIndex,
          }),
        );
        return true;
      },
      Enter: () => {
        const state = slashMenuPluginKey.getState(this.editor.state);
        if (!state?.active) return false;

        const filtered = filterCommands(state.query);
        const selected = filtered[state.selectedIndex];
        if (!selected) return false;

        // Remove the slash and query text
        if (state.triggerPos !== null) {
          const from = state.triggerPos;
          const to = this.editor.state.selection.from;
          this.editor
            .chain()
            .focus()
            .command(({ tr }) => {
              tr.delete(from, to);
              return true;
            })
            .run();
        }

        // Close the menu
        this.editor.view.dispatch(
          this.editor.state.tr.setMeta(slashMenuPluginKey, { type: 'close' }),
        );

        // Fire the callback
        const section = getSectionContext(this.editor.view);
        this.options.onSlashCommand?.(selected.id, section);
        return true;
      },
      Escape: () => {
        const state = slashMenuPluginKey.getState(this.editor.state);
        if (!state?.active) return false;
        this.editor.view.dispatch(
          this.editor.state.tr.setMeta(slashMenuPluginKey, { type: 'close' }),
        );
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const extensionOptions = this.options;
    let menuElement: HTMLElement | null = null;

    return [
      new Plugin<SlashMenuState>({
        key: slashMenuPluginKey,

        state: {
          init(): SlashMenuState {
            return {
              active: false,
              query: '',
              selectedIndex: 0,
              triggerPos: null,
              decorationSet: DecorationSet.empty,
            };
          },

          apply(tr, value, _oldState, newState): SlashMenuState {
            const meta = tr.getMeta(slashMenuPluginKey) as
              | { type: string; index?: number }
              | undefined;

            if (meta?.type === 'close') {
              return {
                active: false,
                query: '',
                selectedIndex: 0,
                triggerPos: null,
                decorationSet: DecorationSet.empty,
              };
            }

            if (meta?.type === 'updateIndex') {
              return { ...value, selectedIndex: meta.index ?? 0 };
            }

            // Check if we should open or update the slash menu
            if (tr.docChanged || tr.selectionSet) {
              const { $from } = newState.selection;
              const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);

              // Check for slash at start of line (or after only whitespace)
              const slashMatch = textBefore.match(/(?:^|\s)\/([a-z-]*)$/);

              if (slashMatch) {
                const query = slashMatch[1];
                const filtered = filterCommands(query);

                if (filtered.length > 0) {
                  // Calculate the trigger position (the `/` character)
                  const triggerOffset = textBefore.lastIndexOf('/');
                  const triggerPos = $from.start() + triggerOffset;

                  return {
                    active: true,
                    query,
                    selectedIndex: Math.min(value.selectedIndex, filtered.length - 1),
                    triggerPos,
                    decorationSet: DecorationSet.empty,
                  };
                }
              }

              // Close menu if the slash pattern broke
              if (value.active) {
                return {
                  active: false,
                  query: '',
                  selectedIndex: 0,
                  triggerPos: null,
                  decorationSet: DecorationSet.empty,
                };
              }
            }

            return value;
          },
        },

        view() {
          return {
            update(view) {
              const state = slashMenuPluginKey.getState(view.state);

              if (!state?.active) {
                if (menuElement) {
                  menuElement.remove();
                  menuElement = null;
                }
                return;
              }

              const filtered = filterCommands(state.query);
              if (filtered.length === 0) {
                if (menuElement) {
                  menuElement.remove();
                  menuElement = null;
                }
                return;
              }

              // Remove old menu
              if (menuElement) {
                menuElement.remove();
              }

              // Create new menu
              menuElement = createMenuElement(filtered, state.selectedIndex, (commandId) => {
                // Remove the slash text
                if (state.triggerPos !== null) {
                  const from = state.triggerPos;
                  const to = view.state.selection.from;

                  const tr = view.state.tr
                    .delete(from, to)
                    .setMeta(slashMenuPluginKey, { type: 'close' });
                  view.dispatch(tr);
                }

                // Fire callback
                const section = getSectionContext(view);
                extensionOptions.onSlashCommand?.(commandId, section);
              });

              // Position the menu below the cursor
              const coords = view.coordsAtPos(view.state.selection.from);
              menuElement.style.top = `${coords.bottom + 4}px`;
              menuElement.style.left = `${Math.max(8, coords.left - 20)}px`;

              document.body.appendChild(menuElement);
            },

            destroy() {
              if (menuElement) {
                menuElement.remove();
                menuElement = null;
              }
            },
          };
        },
      }),
    ];
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function filterCommands(query: string): CommandDef[] {
  if (!query) return COMMANDS;
  const lower = query.toLowerCase();
  return COMMANDS.filter(
    (cmd) => cmd.id.includes(lower) || cmd.label.toLowerCase().includes(lower),
  );
}

'use client';

/**
 * MarginDecorations — ProseMirror decoration plugin for gutter indicators.
 *
 * Left gutter: constitutional risk dots (green/amber/red per paragraph)
 * Right gutter: community annotation count badges
 *
 * These are rendered as ProseMirror widget decorations positioned at the start
 * of each paragraph within section blocks. The actual risk/annotation data is
 * fed in through extension storage (set by the parent component).
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { ConstitutionalRisk, MarginIndicator } from '@/lib/workspace/editor/types';

// ---------------------------------------------------------------------------
// Risk level colors
// ---------------------------------------------------------------------------

const RISK_COLORS: Record<ConstitutionalRisk, { dot: string; title: string }> = {
  green: {
    dot: 'bg-emerald-500',
    title: 'Constitutional: No concerns',
  },
  amber: {
    dot: 'bg-amber-500',
    title: 'Constitutional: Potential concerns',
  },
  red: {
    dot: 'bg-red-500',
    title: 'Constitutional: Likely conflict',
  },
};

// ---------------------------------------------------------------------------
// Plugin key and metadata
// ---------------------------------------------------------------------------

const marginPluginKey = new PluginKey('marginDecorations');
const UPDATE_MARGINS = 'updateMargins';

// ---------------------------------------------------------------------------
// DOM element factories
// ---------------------------------------------------------------------------

function createRiskDot(risk: ConstitutionalRisk): HTMLElement {
  const container = document.createElement('span');
  container.className =
    'margin-risk-dot absolute -left-6 top-1/2 -translate-y-1/2 flex items-center justify-center';
  container.setAttribute('contenteditable', 'false');

  const dot = document.createElement('span');
  const colors = RISK_COLORS[risk];
  dot.className = `w-2 h-2 rounded-full ${colors.dot} shadow-sm`;
  dot.title = colors.title;

  container.appendChild(dot);
  return container;
}

function createAnnotationBadge(count: number): HTMLElement {
  const container = document.createElement('span');
  container.className =
    'margin-annotation-badge absolute -right-8 top-1/2 -translate-y-1/2 flex items-center justify-center';
  container.setAttribute('contenteditable', 'false');

  const badge = document.createElement('span');
  badge.className =
    'inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-primary/10 text-[9px] font-medium text-primary tabular-nums';
  badge.textContent = String(count);
  badge.title = `${count} community annotation${count !== 1 ? 's' : ''}`;

  container.appendChild(badge);
  return container;
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export interface MarginDecorationsOptions {
  /** Initial margin indicators (can be updated via setMarginIndicators) */
  indicators?: MarginIndicator[];
}

export const MarginDecorations = Extension.create<MarginDecorationsOptions>({
  name: 'marginDecorations',

  addOptions() {
    return {
      indicators: [],
    };
  },

  addStorage() {
    return {
      indicators: [] as MarginIndicator[],
    };
  },

  addProseMirrorPlugins() {
    const storage = this.storage as { indicators: MarginIndicator[] };

    return [
      new Plugin({
        key: marginPluginKey,

        state: {
          init(_config, state) {
            return buildDecorations(state.doc, storage.indicators);
          },

          apply(tr, oldDecorations, _oldState, newState) {
            // Check for explicit update
            const indicators = tr.getMeta(UPDATE_MARGINS) as MarginIndicator[] | undefined;
            if (indicators) {
              storage.indicators = indicators;
              return buildDecorations(newState.doc, indicators);
            }

            // If doc changed, rebuild with current indicators
            if (tr.docChanged) {
              return buildDecorations(newState.doc, storage.indicators);
            }

            // Map existing decorations through the transaction
            return oldDecorations.map(tr.mapping, tr.doc);
          },
        },

        props: {
          decorations(state) {
            return marginPluginKey.getState(state) as DecorationSet;
          },
        },
      }),
    ];
  },
});

// ---------------------------------------------------------------------------
// Build decorations from indicators
// ---------------------------------------------------------------------------

function buildDecorations(
  doc: Parameters<typeof DecorationSet.create>[0],
  indicators: MarginIndicator[],
): DecorationSet {
  if (!indicators || indicators.length === 0) {
    return DecorationSet.empty;
  }

  const decorations: Decoration[] = [];
  let paragraphIndex = 0;

  doc.descendants((node, pos) => {
    if (node.type.name !== 'paragraph') return;

    const indicator = indicators.find((i) => i.paragraphIndex === paragraphIndex);
    paragraphIndex++;

    if (!indicator) return;

    // Add constitutional risk dot in left gutter
    if (indicator.constitutionalRisk) {
      decorations.push(
        Decoration.widget(pos, () => createRiskDot(indicator.constitutionalRisk!), {
          side: -1,
          key: `risk-${pos}`,
        }),
      );
    }

    // Add annotation count badge in right gutter
    if (indicator.annotationCount && indicator.annotationCount > 0) {
      decorations.push(
        Decoration.widget(
          pos + node.nodeSize,
          () => createAnnotationBadge(indicator.annotationCount!),
          {
            side: 1,
            key: `annotations-${pos}`,
          },
        ),
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Update the margin indicators for the editor.
 * Call this when constitutional analysis results or annotation counts change.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setMarginIndicators(editor: any, indicators: MarginIndicator[]): void {
  if (editor.storage?.marginDecorations) {
    editor.storage.marginDecorations.indicators = indicators;
  }
  const tr = editor.view.state.tr.setMeta(UPDATE_MARGINS, indicators);
  editor.view.dispatch(tr);
}

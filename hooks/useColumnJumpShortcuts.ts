import { useEffect } from 'react';
import { commandRegistry } from '@/lib/workspace/commands';
import { useFocusStore } from '@/lib/workspace/focus';

/**
 * Register 1/2/3/4 shortcuts to jump focus to the first item of a column.
 * Columns are identified by `data-column` attributes on DOM elements.
 *
 * @param listId - The focus list ID (e.g., 'drafts-list' or 'review-portfolio-list')
 * @param columnNames - Ordered array of column names matching data-column attributes
 * @param columnOffsets - Flat offsets for each column in the keyboard navigation list
 */
export function useColumnJumpShortcuts(
  listId: string,
  columnNames: string[],
  columnOffsets: Record<string, number>,
) {
  useEffect(() => {
    const unregisters: Array<() => void> = [];

    columnNames.forEach((colName, i) => {
      if (i >= 4) return; // Only support 1-4
      const shortcut = String(i + 1);

      unregisters.push(
        commandRegistry.register({
          id: `${listId}.jump-col-${shortcut}`,
          label: `Jump to column ${shortcut}`,
          shortcut,
          section: 'navigation',
          execute: () => {
            const store = useFocusStore.getState();
            // Set the active list if not already
            if (store.activeListId !== listId) {
              store.setActiveList(listId, 999);
            }
            // Jump to the offset of this column
            const offset = columnOffsets[colName] ?? 0;
            store.setActiveIndex(offset);

            // Scroll the column into view
            const el = document.querySelector(`[data-column="${colName}"]`);
            if (el instanceof HTMLElement) {
              el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
          },
        }),
      );
    });

    return () => {
      for (const fn of unregisters) fn();
    };
  }, [listId, columnNames, columnOffsets]);
}

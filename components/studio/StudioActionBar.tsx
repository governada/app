'use client';

import { useEffect, type ReactNode } from 'react';
import { MessageSquare, BarChart3, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';

type PanelId = 'agent' | 'intel' | 'notes';

interface StudioActionBarProps {
  activePanel: PanelId | null;
  onPanelToggle: (panel: PanelId) => void;
  contextActions?: ReactNode;
  statusInfo?: ReactNode;
}

const PANEL_BUTTONS: Array<{
  id: PanelId;
  label: string;
  Icon: typeof MessageSquare;
  shortcutKey: string;
  shortcutLabel: string;
}> = [
  {
    id: 'agent',
    label: 'Agent',
    Icon: MessageSquare,
    shortcutKey: 'c',
    shortcutLabel: 'Ctrl+Shift+C',
  },
  { id: 'intel', label: 'Intel', Icon: BarChart3, shortcutKey: 'i', shortcutLabel: 'Ctrl+Shift+I' },
  {
    id: 'notes',
    label: 'Notes',
    Icon: StickyNote,
    shortcutKey: 'n',
    shortcutLabel: 'Ctrl+Shift+N',
  },
];

export function StudioActionBar({
  activePanel,
  onPanelToggle,
  contextActions,
  statusInfo,
}: StudioActionBarProps) {
  // Ctrl+Shift+C/I/N keyboard shortcuts for panel toggles
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey || !e.shiftKey) return;
      const key = e.key.toLowerCase();
      const match = PANEL_BUTTONS.find((b) => b.shortcutKey === key);
      if (match) {
        e.preventDefault();
        onPanelToggle(match.id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onPanelToggle]);

  return (
    <div className="sticky bottom-0 z-40 min-h-12 border-t border-border bg-background/95 backdrop-blur-sm px-4 pb-[env(safe-area-inset-bottom)] flex items-center shrink-0">
      {/* Left: panel toggle buttons */}
      <div className="flex items-center gap-1">
        {PANEL_BUTTONS.map(({ id, label, Icon, shortcutLabel }) => {
          const isActive = activePanel === id;
          return (
            <button
              key={id}
              onClick={() => onPanelToggle(id)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer',
                isActive
                  ? 'bg-primary/10 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent',
              )}
              title={`Toggle ${label} panel (${shortcutLabel})`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden lg:inline">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Center: status info */}
      {statusInfo && (
        <div className="flex-1 flex items-center justify-center min-w-0 px-3">{statusInfo}</div>
      )}

      {/* Spacer when no status */}
      {!statusInfo && <div className="flex-1" />}

      {/* Right: context actions */}
      {contextActions && <div className="flex items-center gap-2 shrink-0">{contextActions}</div>}
    </div>
  );
}

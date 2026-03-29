'use client';

import { useEffect, useRef } from 'react';
import { Save, Shield, GitCompare, MessageSquareReply, Eye } from 'lucide-react';
import { commandRegistry } from '@/lib/workspace/commands';

interface EditorCommandHandlers {
  /** Save a new version (opens justification flow) */
  onSaveVersion?: () => void;
  /** Open constitutional check / readiness panel */
  onConstitutionalCheck?: () => void;
  /** Toggle diff mode */
  onDiffMode?: () => void;
  /** Respond to review (switch to edit mode in response_revision) */
  onRespondToReview?: () => void;
  /** Open CIP-108 preview (intel panel) */
  onCIP108Preview?: () => void;
}

/**
 * Registers author-editor-specific commands into the command registry.
 *
 * These commands are context-dependent: they only appear when the editor
 * workspace is mounted and handlers are provided.
 */
export function useRegisterEditorCommands(handlers: EditorCommandHandlers) {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  const hasSave = !!handlers.onSaveVersion;
  const hasConstitutional = !!handlers.onConstitutionalCheck;
  const hasDiff = !!handlers.onDiffMode;
  const hasRespond = !!handlers.onRespondToReview;
  const hasPreview = !!handlers.onCIP108Preview;

  useEffect(() => {
    const unregisters: Array<() => void> = [];

    if (hasSave) {
      unregisters.push(
        commandRegistry.register({
          id: 'editor.save-version',
          label: 'Save Version',
          shortcut: 's',
          icon: Save,
          section: 'actions',
          execute: () => handlersRef.current.onSaveVersion?.(),
        }),
      );
    }

    if (hasConstitutional) {
      unregisters.push(
        commandRegistry.register({
          id: 'editor.constitutional-check',
          label: 'Constitutional Check',
          shortcut: 'c',
          icon: Shield,
          section: 'actions',
          execute: () => handlersRef.current.onConstitutionalCheck?.(),
        }),
      );
    }

    if (hasDiff) {
      unregisters.push(
        commandRegistry.register({
          id: 'editor.diff-mode',
          label: 'Toggle Diff Mode',
          shortcut: 'd',
          icon: GitCompare,
          section: 'view',
          execute: () => handlersRef.current.onDiffMode?.(),
        }),
      );
    }

    if (hasRespond) {
      unregisters.push(
        commandRegistry.register({
          id: 'editor.respond-to-review',
          label: 'Respond to Review',
          shortcut: 'r',
          icon: MessageSquareReply,
          section: 'actions',
          execute: () => handlersRef.current.onRespondToReview?.(),
        }),
      );
    }

    if (hasPreview) {
      unregisters.push(
        commandRegistry.register({
          id: 'editor.cip108-preview',
          label: 'CIP-108 Preview',
          shortcut: 'p',
          icon: Eye,
          section: 'view',
          execute: () => handlersRef.current.onCIP108Preview?.(),
        }),
      );
    }

    return () => {
      for (const unregister of unregisters) {
        unregister();
      }
    };
  }, [hasSave, hasConstitutional, hasDiff, hasRespond, hasPreview]);
}

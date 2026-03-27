'use client';

import { memo, useMemo } from 'react';
import { Loader2 } from 'lucide-react';

interface BriefingTextProps {
  content: string;
  isStreaming: boolean;
  error?: string | null;
}

/**
 * Streaming text renderer for the Seneca briefing panel.
 * Renders markdown-like content with a typing cursor during streaming.
 */
export const BriefingText = memo(function BriefingText({
  content,
  isStreaming,
  error,
}: BriefingTextProps) {
  const rendered = useMemo(() => renderBriefingMarkdown(content), [content]);

  if (error) {
    return <p className="text-sm text-red-400/80 italic">{error}</p>;
  }

  if (!content && isStreaming) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground/60">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="text-xs">Seneca is thinking...</span>
      </div>
    );
  }

  return (
    <div
      className="text-sm text-foreground/90 leading-relaxed space-y-1.5"
      role="log"
      aria-live="polite"
    >
      {rendered}
      {isStreaming && (
        <span className="inline-block w-1.5 h-4 bg-compass-teal/60 animate-pulse ml-0.5 align-middle" />
      )}
    </div>
  );
});

/**
 * Simple markdown renderer for briefing text.
 * Supports bold, entity references, and basic formatting.
 */
function renderBriefingMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Bold text: **text**
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const spans = parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={j} className="text-foreground font-medium">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={j}>{part}</span>;
    });

    elements.push(
      <p key={i} className="text-sm">
        {spans}
      </p>,
    );
  }

  return elements;
}

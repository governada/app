'use client';

/**
 * ProvenanceBadge — inline "AI-assisted" badge with provenance tooltip.
 *
 * Shows model, key source (Platform/BYOK), edit distance, and skill name
 * on hover for transparency about AI involvement.
 */

import { Bot } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ProvenanceBadgeProps {
  model: string;
  keySource: 'platform' | 'byok';
  editDistance?: number;
  skillName?: string;
  className?: string;
}

export function ProvenanceBadge({
  model,
  keySource,
  editDistance,
  skillName,
  className,
}: ProvenanceBadgeProps) {
  // Extract short model name (e.g., "claude-sonnet-4-5" -> "Sonnet 4.5")
  const shortModel = model
    .replace('claude-', '')
    .replace(/-\d{8}$/, '')
    .replace('sonnet-4-5', 'Sonnet 4.5')
    .replace('sonnet-4-20250514', 'Sonnet 4')
    .replace('haiku-3-5', 'Haiku 3.5');

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5',
              'text-[10px] font-medium text-muted-foreground',
              'bg-muted/40 hover:bg-primary/10 hover:text-primary',
              'transition-colors cursor-default',
              className,
            )}
          >
            <Bot className="h-3 w-3" />
            AI-assisted
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[220px]">
          <div className="space-y-1 text-xs">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Model</span>
              <span className="font-medium">{shortModel}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Key</span>
              <span className="font-medium">
                {keySource === 'byok' ? 'Your key (BYOK)' : 'Platform'}
              </span>
            </div>
            {editDistance != null && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Edit distance</span>
                <span className="font-medium">{editDistance}%</span>
              </div>
            )}
            {skillName && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Skill</span>
                <span className="font-medium">{skillName}</span>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

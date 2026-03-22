'use client';

import { Sparkles } from 'lucide-react';
import type { SpotlightEntityType } from './types';

interface SolonSuggestedPromptsProps {
  entityType: SpotlightEntityType;
  onSelect: (prompt: string) => void;
}

const PROMPTS: Record<SpotlightEntityType, string[]> = {
  drep: [
    'Who votes on every proposal?',
    'DReps focused on developer funding',
    'Most active newcomers',
    'Representatives who explain their votes',
  ],
  spo: [
    'Most active governance pools',
    'Pools with strong deliberation',
    'Large pools that participate in governance',
    'Pools focused on decentralization',
  ],
  proposal: [
    "What's being decided right now?",
    'Treasury spending proposals',
    'Most contested proposals',
    'Proposals closing soon',
  ],
};

export function SolonSuggestedPrompts({ entityType, onSelect }: SolonSuggestedPromptsProps) {
  const prompts = PROMPTS[entityType];

  return (
    <div className="flex flex-wrap gap-2">
      {prompts.map((prompt) => (
        <button
          key={prompt}
          onClick={() => onSelect(prompt)}
          className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary/80 transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
        >
          <Sparkles className="h-3 w-3" />
          {prompt}
        </button>
      ))}
    </div>
  );
}

'use client';

import { useCallback } from 'react';
import { motion } from 'framer-motion';

interface BriefingChipsProps {
  chips: string[];
  onChipClick: (chip: string) => void;
  disabled?: boolean;
}

/**
 * Follow-up action chips rendered after Seneca's briefing completes.
 * Parsed from [[chip:text]] markers in the AI response stream.
 */
export function BriefingChips({ chips, onChipClick, disabled }: BriefingChipsProps) {
  const handleClick = useCallback(
    (chip: string) => {
      if (!disabled) onChipClick(chip);
    },
    [onChipClick, disabled],
  );

  if (chips.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="flex flex-wrap gap-2 mt-3"
    >
      {chips.map((chip, i) => (
        <motion.button
          key={chip}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, delay: 0.1 * i }}
          onClick={() => handleClick(chip)}
          disabled={disabled}
          className="px-3 py-1.5 rounded-full text-xs
            bg-white/5 border border-white/10
            hover:bg-white/10 hover:border-white/20
            text-muted-foreground hover:text-foreground
            transition-colors disabled:opacity-40 disabled:cursor-not-allowed
            focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-compass-teal/50"
          tabIndex={0}
        >
          {chip}
        </motion.button>
      ))}
    </motion.div>
  );
}

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Coins, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface StakePoolButtonProps {
  poolId: string;
  ticker: string | null;
  size?: 'sm' | 'default';
  className?: string;
}

export function StakePoolButton({ poolId, ticker, size = 'sm', className }: StakePoolButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    await navigator.clipboard.writeText(poolId);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const label = ticker ? `[${ticker.toUpperCase()}]` : 'this pool';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size={size}
            variant={copied ? 'outline' : 'default'}
            className={cn('gap-1.5', className)}
            onClick={handleClick}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                Pool ID copied!
              </>
            ) : (
              <>
                <Coins className="h-3.5 w-3.5" />
                Stake with {label}
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[260px]">
          <p className="text-xs">
            {copied ? (
              <>
                Paste <span className="font-mono">{poolId.slice(0, 12)}&hellip;</span> in your
                Cardano wallet to stake with this pool.
              </>
            ) : (
              <>Copies the pool ID. Search for it in your Cardano wallet to delegate your stake.</>
            )}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

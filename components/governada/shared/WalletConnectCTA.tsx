'use client';

import Link from 'next/link';
import { Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { posthog } from '@/lib/posthog';

interface WalletConnectCTAProps {
  /** What the user will unlock by connecting */
  message: string;
  /** inline = compact text link, overlay = centered card over blurred content */
  variant?: 'inline' | 'overlay';
  /** PostHog surface identifier for attribution */
  surface?: string;
}

/**
 * Reusable CTA for gated zones — encourages anonymous users to connect their wallet.
 */
export function WalletConnectCTA({
  message,
  variant = 'overlay',
  surface = 'unknown',
}: WalletConnectCTAProps) {
  const handleClick = () => {
    posthog.capture('wallet_cta_clicked', { surface, variant });
  };

  if (variant === 'inline') {
    return (
      <p className="text-sm text-muted-foreground">
        {message}{' '}
        <Link
          href="/match"
          onClick={handleClick}
          className="font-medium text-primary hover:underline"
        >
          Connect wallet &rarr;
        </Link>
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 text-center py-6">
      <div className="rounded-full bg-primary/10 p-3">
        <Wallet className="h-5 w-5 text-primary" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{message}</p>
        <p className="text-xs text-muted-foreground">
          Connect your wallet to unlock the full experience
        </p>
      </div>
      <Button asChild size="sm" onClick={handleClick}>
        <Link href="/match">Get Started</Link>
      </Button>
    </div>
  );
}

'use client';

import { useSegment } from '@/components/providers/SegmentProvider';
import { WalletConnectCTA } from '@/components/governada/shared/WalletConnectCTA';
import { cn } from '@/lib/utils';

interface ProposalDepthGateProps {
  children: React.ReactNode;
  /** What the user will unlock (shown in the CTA) */
  message: string;
  /** PostHog surface for attribution */
  surface?: string;
  /** Hide for anonymous users (default). Set to 'citizen' to also gate non-workspace users. */
  gateLevel?: 'anonymous' | 'citizen';
}

/**
 * Depth gating wrapper for proposal detail zones.
 *
 * For anonymous users: renders children behind a blur overlay with a centered
 * wallet-connect CTA. The real content is rendered but visually obscured,
 * creating curiosity and encouraging connection.
 *
 * For connected users: renders children normally.
 */
export function ProposalDepthGate({
  children,
  message,
  surface = 'proposal-detail',
  gateLevel = 'anonymous',
}: ProposalDepthGateProps) {
  const { segment } = useSegment();

  const isGated =
    gateLevel === 'anonymous'
      ? segment === 'anonymous'
      : segment === 'anonymous' || segment === 'citizen';

  if (!isGated) return <>{children}</>;

  return (
    <div className="relative rounded-xl overflow-hidden">
      {/* Real content rendered behind blur */}
      <div
        className={cn('blur-[3px] pointer-events-none select-none', 'opacity-60')}
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Overlay with CTA */}
      <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-xl">
        <WalletConnectCTA message={message} variant="overlay" surface={surface} />
      </div>
    </div>
  );
}

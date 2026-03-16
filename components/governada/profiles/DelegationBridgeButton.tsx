'use client';

import { useState } from 'react';
import { Vote, CheckCircle, Loader2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { useDelegation } from '@/hooks/useDelegation';
import dynamic from 'next/dynamic';
import type { AlignmentScores } from '@/lib/drepIdentity';

const DelegationCeremony = dynamic(
  () => import('@/components/DelegationCeremony').then((m) => m.DelegationCeremony),
  { ssr: false },
);

interface DelegationBridgeButtonProps {
  drepId: string;
  drepName: string;
}

/**
 * DelegationBridgeButton — compact button that opens the delegation flow in a Sheet.
 * Replaces the inline InlineDelegationCTA on DRep profiles for the discovery/action split.
 */
export function DelegationBridgeButton({ drepId, drepName }: DelegationBridgeButtonProps) {
  const {
    phase,
    startDelegation,
    confirmDelegation,
    reset,
    isProcessing,
    delegatedDrepId,
    canDelegate,
  } = useDelegation();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [showCeremony, setShowCeremony] = useState(false);
  const [ceremonyScore, setCeremonyScore] = useState(0);
  const [ceremonyAlignments, setCeremonyAlignments] = useState<AlignmentScores | undefined>();

  const isAlreadyDelegated = !!delegatedDrepId && delegatedDrepId === drepId;

  const handleClick = () => {
    if (!canDelegate) {
      window.dispatchEvent(new Event('openWalletConnect'));
      return;
    }
    setSheetOpen(true);
    startDelegation(drepId);
  };

  const handleConfirm = async () => {
    const result = await confirmDelegation(drepId);
    if (result) {
      fetch(`/api/dreps/${encodeURIComponent(drepId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.drepScore) setCeremonyScore(data.drepScore);
          if (data?.alignmentTreasuryConservative != null) {
            setCeremonyAlignments({
              treasuryConservative: data.alignmentTreasuryConservative ?? 50,
              treasuryGrowth: data.alignmentTreasuryGrowth ?? 50,
              decentralization: data.alignmentDecentralization ?? 50,
              security: data.alignmentSecurity ?? 50,
              innovation: data.alignmentInnovation ?? 50,
              transparency: data.alignmentTransparency ?? 50,
            });
          }
        })
        .catch(() => {});
      setShowCeremony(true);
    }
  };

  const handleClose = () => {
    setSheetOpen(false);
    setShowCeremony(false);
    reset();
  };

  // Already delegated — show status badge
  if (isAlreadyDelegated && phase.status !== 'success') {
    return (
      <Button variant="outline" size="sm" disabled className="gap-1.5 opacity-80">
        <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
        Delegating
      </Button>
    );
  }

  return (
    <>
      <Button variant="default" size="sm" onClick={handleClick} className="gap-1.5">
        {canDelegate ? (
          <>
            <Vote className="h-3.5 w-3.5" />
            Delegate
          </>
        ) : (
          <>
            <Wallet className="h-3.5 w-3.5" />
            Connect to Delegate
          </>
        )}
      </Button>

      <Sheet open={sheetOpen} onOpenChange={(open) => !open && handleClose()}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Delegate to {drepName}</SheetTitle>
            <SheetDescription>
              Assign your ADA voting power to this DRep. You can change or revoke at any time.
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 pb-6 pt-4 space-y-4">
            {showCeremony ? (
              <DelegationCeremony
                drepId={drepId}
                drepName={drepName}
                score={ceremonyScore}
                alignments={ceremonyAlignments}
                onContinue={handleClose}
              />
            ) : (
              <div className="space-y-4">
                {(phase.status === 'idle' || phase.status === 'preflight') && (
                  <div className="flex items-center gap-3 py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Preparing delegation...</p>
                  </div>
                )}

                {phase.status === 'confirming' && (
                  <div className="space-y-3">
                    <p className="text-sm">
                      You&apos;re about to delegate your voting power to{' '}
                      <span className="font-semibold">{drepName}</span>.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      This is a non-binding delegation — you can revoke at any time and your ADA
                      never leaves your wallet.
                    </p>
                    <div className="flex gap-2">
                      <Button onClick={handleConfirm} disabled={isProcessing} className="flex-1">
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Confirm Delegation
                      </Button>
                      <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {(phase.status === 'building' ||
                  phase.status === 'signing' ||
                  phase.status === 'submitting') && (
                  <div className="flex items-center gap-3 py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">
                      {phase.status === 'signing'
                        ? 'Please sign in your wallet...'
                        : phase.status === 'submitting'
                          ? 'Submitting to the network...'
                          : 'Preparing transaction...'}
                    </p>
                  </div>
                )}

                {phase.status === 'error' && (
                  <div className="space-y-3">
                    <p className="text-sm text-destructive">
                      {phase.message || 'Something went wrong'}
                    </p>
                    <Button variant="outline" onClick={handleClose}>
                      Close
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

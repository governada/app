'use client';

import { ConcernFlags } from './ConcernFlags';

interface ConcernFlagsSectionProps {
  txHash: string;
  proposalIndex: number;
  isOpen: boolean;
}

/**
 * Client wrapper for ConcernFlags on server-rendered proposal pages.
 * Shows concern flag tallies to everyone (glass window) and interactive
 * flagging to authenticated citizens.
 */
export function ConcernFlagsSection({ txHash, proposalIndex, isOpen }: ConcernFlagsSectionProps) {
  return <ConcernFlags txHash={txHash} proposalIndex={proposalIndex} isOpen={isOpen} />;
}

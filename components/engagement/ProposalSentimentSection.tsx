'use client';

import { ProposalSentiment } from './ProposalSentiment';

interface ProposalSentimentSectionProps {
  txHash: string;
  proposalIndex: number;
  isOpen: boolean;
}

/**
 * Client wrapper for ProposalSentiment on server-rendered proposal pages.
 * Shows community signal results to everyone (glass window) and voting
 * buttons to authenticated citizens.
 */
export function ProposalSentimentSection({
  txHash,
  proposalIndex,
  isOpen,
}: ProposalSentimentSectionProps) {
  return <ProposalSentiment txHash={txHash} proposalIndex={proposalIndex} isOpen={isOpen} />;
}

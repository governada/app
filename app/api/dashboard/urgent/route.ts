import { NextRequest, NextResponse } from 'next/server';
import { getOpenProposalsForDRep } from '@/lib/data';
import { blockTimeToEpoch } from '@/lib/koios';
import { getProposalDisplayTitle } from '@/utils/display';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const drepId = request.nextUrl.searchParams.get('drepId');
  if (!drepId) {
    return NextResponse.json({ error: 'Missing drepId' }, { status: 400 });
  }

  try {
    const pendingProposals = await getOpenProposalsForDRep(drepId);
    const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

    const urgent = pendingProposals
      .filter((p: any) => {
        const expiryEpoch = p.expiration ?? p.proposal_expiry_epoch ?? 0;
        return expiryEpoch > 0 && expiryEpoch - currentEpoch <= 2;
      })
      .map((p: any) => {
        const expiryEpoch = p.expiration ?? p.proposal_expiry_epoch ?? 0;
        return {
          txHash: p.proposal_tx_hash,
          index: p.proposal_index,
          title: getProposalDisplayTitle(p.title, p.proposal_tx_hash, p.proposal_index),
          proposalType: p.proposal_type || 'Proposal',
          epochsRemaining: Math.max(0, expiryEpoch - currentEpoch),
        };
      })
      .sort((a: any, b: any) => a.epochsRemaining - b.epochsRemaining);

    return NextResponse.json({ proposals: urgent });
  } catch (error) {
    console.error('[Dashboard/Urgent] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

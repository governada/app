import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ txHash: string; index: string }>;
}

export default async function GlobeProposalPage({ params }: PageProps) {
  const { txHash, index } = await params;
  redirect(`/proposal/${txHash}/${index}`);
}

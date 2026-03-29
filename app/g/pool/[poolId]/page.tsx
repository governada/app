import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ poolId: string }>;
}

export default async function GlobePoolPage({ params }: PageProps) {
  const { poolId } = await params;
  redirect(`/pool/${encodeURIComponent(poolId)}`);
}

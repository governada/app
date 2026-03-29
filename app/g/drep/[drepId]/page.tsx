import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ drepId: string }>;
}

export default async function GlobeDRepPage({ params }: PageProps) {
  const { drepId } = await params;
  redirect(`/drep/${encodeURIComponent(drepId)}`);
}

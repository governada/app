import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ ccHotId: string }>;
}

export default async function GlobeCCPage({ params }: PageProps) {
  const { ccHotId } = await params;
  redirect(`/committee/${encodeURIComponent(ccHotId)}`);
}

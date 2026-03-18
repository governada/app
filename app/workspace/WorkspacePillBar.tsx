'use client';

import { usePathname } from 'next/navigation';
import { SectionPillBar } from '@/components/governada/SectionPillBar';

export function WorkspacePillBar() {
  const pathname = usePathname();
  const isStudioMode =
    pathname === '/workspace/review' || /^\/workspace\/(author|editor)\/[^/]+/.test(pathname);
  if (isStudioMode) return null;
  return <SectionPillBar section="home" />;
}

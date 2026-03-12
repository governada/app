import dynamic from 'next/dynamic';
import { SectionPillBar } from '@/components/civica/SectionPillBar';

const SectionSpotlightTrigger = dynamic(
  () =>
    import('@/components/discovery/SectionSpotlightTrigger').then((m) => ({
      default: m.SectionSpotlightTrigger,
    })),
  { ssr: false },
);

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionPillBar section="workspace" />
      <SectionSpotlightTrigger section="workspace" />
      {children}
    </>
  );
}

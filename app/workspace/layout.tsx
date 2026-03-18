import { WorkspacePillBar } from './WorkspacePillBar';
import { SectionSpotlightTrigger } from '@/components/discovery/SectionSpotlightTrigger';

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <WorkspacePillBar />
      <SectionSpotlightTrigger section="workspace" />
      {children}
    </>
  );
}

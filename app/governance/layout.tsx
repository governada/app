import { SectionTabBar } from '@/components/governada/SectionTabBar';
import { SectionSpotlightTrigger } from '@/components/discovery/SectionSpotlightTrigger';

export default function GovernanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionTabBar section="governance" />
      <SectionSpotlightTrigger section="governance" />
      {children}
    </>
  );
}

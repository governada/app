import { SectionTabBar } from '@/components/governada/SectionTabBar';
import { SectionSpotlightTrigger } from '@/components/discovery/SectionSpotlightTrigger';

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionTabBar section="help" />
      <SectionSpotlightTrigger section="help" />
      {children}
    </>
  );
}

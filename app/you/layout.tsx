import { SectionTabBar } from '@/components/governada/SectionTabBar';
import { SectionSpotlightTrigger } from '@/components/discovery/SectionSpotlightTrigger';

export default function YouLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionTabBar section="you" />
      <SectionSpotlightTrigger section="you" />
      {children}
    </>
  );
}

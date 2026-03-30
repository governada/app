import type { Metadata } from 'next';
import { ScorecardClient } from './ScorecardClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Scorecard — Governada',
  description: 'Your governance scorecard — pillar breakdown, tier progression, competitive rank.',
};

export default function ScorecardPage() {
  return <ScorecardClient />;
}

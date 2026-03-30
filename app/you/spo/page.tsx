import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** Pool Scorecard consolidated into You/Scorecard. */
export default function SPOScorecardPage() {
  redirect('/you/scorecard');
}

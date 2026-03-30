import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** DRep Scorecard consolidated into You/Scorecard. */
export default function DRepScorecardPage() {
  redirect('/you/scorecard');
}

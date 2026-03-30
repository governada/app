import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** Performance absorbed into You/Scorecard. Redirect for backwards compat. */
export default function WorkspacePerformance() {
  redirect('/you/scorecard');
}

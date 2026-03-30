import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** Position absorbed into You/Scorecard. Redirect for backwards compat. */
export default function WorkspacePosition() {
  redirect('/you/scorecard');
}

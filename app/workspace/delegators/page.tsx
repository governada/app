import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** Delegators absorbed into You/Scorecard. Redirect for backwards compat. */
export default function WorkspaceDelegators() {
  redirect('/you/scorecard');
}

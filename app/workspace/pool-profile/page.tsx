import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** Pool profile management moved to You/Settings. Redirect for backwards compat. */
export default function WorkspacePoolProfile() {
  redirect('/you/settings');
}

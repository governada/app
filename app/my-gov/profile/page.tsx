import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** Profile moved to You/Settings. */
export default function ProfilePage() {
  redirect('/you/settings');
}

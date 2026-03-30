import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** Identity moved to You. */
export default function IdentityPage() {
  redirect('/you');
}

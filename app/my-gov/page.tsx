import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** My Gov replaced by Homepage command center. */
export default function MyGovPage() {
  redirect('/');
}

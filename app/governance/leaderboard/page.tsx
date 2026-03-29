import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function Leaderboard() {
  redirect('/?filter=dreps&sort=score');
}

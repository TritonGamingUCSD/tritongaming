import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getOffSwitches } from '@/lib/portal/featureServer';
import WatchView from './WatchView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Watch Live', description: 'Watch Triton Gaming live on Twitch and YouTube.', alternates: { canonical: '/watch' } };

// The club's stream. Each division has its own at /watch/<division>.
export default async function WatchPage() {
  if ((await getOffSwitches()).includes('broadcast')) notFound();
  return <WatchView />;
}

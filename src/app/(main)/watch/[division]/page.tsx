import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getOffSwitches } from '@/lib/portal/featureServer';
import { createServiceClient } from '@/lib/supabase/admin';
import WatchView from '../WatchView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Watch Live', description: 'Watch live on Twitch and YouTube.' };

// A division's own stream: its channels, its live broadcast and its schedule (nothing of the club's).
export default async function DivisionWatchPage({ params }: { params: Promise<{ division: string }> }) {
  const { division } = await params;
  const off = await getOffSwitches();
  if (off.includes('broadcast') || off.includes('div_broadcast')) notFound();
  const { data } = await createServiceClient().from('divisions').select('id, name').eq('slug', division).maybeSingle();
  if (!data) notFound();
  return <WatchView division={{ id: data.id as string, name: data.name as string }} />;
}

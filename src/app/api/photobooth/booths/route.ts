import { NextResponse } from 'next/server';
import { authorizePhotoBooth } from '@/lib/photobooth/server';

export const dynamic = 'force-dynamic';

// The events a booth can be set up for: the latest 60, newest first, each with whether it has a booth and how many pictures are waiting to be downloaded.
export async function GET() {
  const auth = await authorizePhotoBooth();
  if (auth.error) return auth.error;
  const { data: events } = await auth.svc.from('events').select('id, title, slug, start_date').order('start_date', { ascending: false }).limit(60);
  const ids = (events ?? []).map((e) => e.id as string);
  const [{ data: booths }, { data: photos }] = await Promise.all([
    ids.length ? auth.svc.from('photobooths').select('event_id').in('event_id', ids) : { data: [] as { event_id: string }[] },
    ids.length
      ? auth.svc.from('photobooth_photos').select('event_id').in('event_id', ids).gt('expires_at', new Date().toISOString()).limit(5000)
      : { data: [] as { event_id: string }[] },
  ]);
  const has = new Set((booths ?? []).map((b) => b.event_id as string));
  const count = new Map<string, number>();
  for (const p of photos ?? []) count.set(p.event_id as string, (count.get(p.event_id as string) ?? 0) + 1);
  return NextResponse.json({ events: (events ?? []).map((e) => ({ ...e, hasBooth: has.has(e.id as string), photos: count.get(e.id as string) ?? 0 })) });
}

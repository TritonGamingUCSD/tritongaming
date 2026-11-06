import { guardFeature } from '@/lib/portal/featureGuard';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { currentEventCodeWindow, rotatingCode } from '@/lib/events/rotatingCode';
import { POST as checkInOnline } from '@/app/api/checkin/online/route';

export const dynamic = 'force-dynamic';

// An online event's check-in code typed into the portal's one code box, without saying which event: POST { code } finds, among the online events the person has a ticket for, the one whose current code this is, then checks them in exactly as
// /api/checkin/online does (the same rules: a ticket for that event, the check-in window, once a day). 404 when it is no online event's code, so the code box can try the other kinds.
export async function POST(request: Request) {
  const off = await guardFeature('self_checkin');
  if (off) return off;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const code = String(b.code ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: 'Enter the 6-digit code.' }, { status: 400 });
  const { data } = await createServiceClient()
    .from('tickets')
    .select('event_id, events!inner(is_online, checkin_secret)')
    .eq('user_id', user.id)
    .eq('events.is_online', true)
    .limit(200);
  const w = currentEventCodeWindow();
  const hits = [
    ...new Set(
      (data ?? [])
        .filter((t) => {
          const secret = (t.events as unknown as { checkin_secret: string | null } | null)?.checkin_secret;
          return !!secret && (rotatingCode(secret, w) === code || rotatingCode(secret, w - 1) === code);
        })
        .map((t) => t.event_id as string),
    ),
  ];
  if (!hits.length) return NextResponse.json({ error: 'That isn’t an online event’s code.' }, { status: 404 });
  if (hits.length > 1) return NextResponse.json({ error: 'That code fits more than one of your online events. Check in from the event’s own page.' }, { status: 409 });
  const headers = new Headers(request.headers);
  headers.delete('content-length');
  return checkInOnline(new Request(request.url, { method: 'POST', headers, body: JSON.stringify({ event_id: hits[0], code }) }));
}

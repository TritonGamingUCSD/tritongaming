import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { getUserRoles } from '@/lib/core/auth';
import { isTgMember } from '@/lib/portal/capabilities';

export const dynamic = 'force-dynamic';

function oneLink(url: string) {
  const webcal = url.replace(/^https?:/, 'webcal:');
  return { https: url, webcal, google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}` };
}
// `tg` (the unified TG calendar) is only given to TG members (exec, leads, officers, recruits and alumni).
function links(origin: string, token: string, team: boolean) {
  return { ...oneLink(`${origin}/api/calendar/feed/${token}.ics`), tg: team ? oneLink(`${origin}/api/calendar/tg/${token}.ics`) : null };
}

// GET: my private calendar subscription link. POST: make a new one (the old link stops working).
async function handle(request: Request, reset: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const svc = createServiceClient();
  const roles = await getUserRoles();
  const team = isTgMember(roles);
  if (reset) {
    const { data, error } = await svc.from('profiles').update({ calendar_token: crypto.randomUUID() }).eq('id', user.id).select('calendar_token').single();
    if (error || !data) return NextResponse.json({ error: 'Failed to reset the link.' }, { status: 500 });
    return NextResponse.json(links(new URL(request.url).origin, data.calendar_token as string, team));
  }
  const { data } = await svc.from('profiles').select('calendar_token').eq('id', user.id).maybeSingle();
  if (!data) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
  return NextResponse.json(links(new URL(request.url).origin, data.calendar_token as string, team));
}
export const GET = (request: Request) => handle(request, false);
export const POST = (request: Request) => handle(request, true);

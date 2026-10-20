import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { describeDevice, endpointFingerprint } from '@/lib/notifications/devices';
import { PUSH_CATEGORIES, pushConfigured } from '@/lib/notifications/webPush';

export const dynamic = 'force-dynamic';

async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// My push settings: is it set up on the site, how many of my devices have it on, and which kinds I muted.
export async function GET() {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const categories = PUSH_CATEGORIES.map((c) => ({ id: c.id, label: c.label, hint: c.hint }));
  if (!pushConfigured()) return NextResponse.json({ configured: false, devices: 0, muted: [], categories });
  const svc = createServiceClient();
  const [{ data: subs }, { data: pref }] = await Promise.all([
    svc.from('push_subscriptions').select('id, endpoint, user_agent, created_at, last_sent_at').eq('user_id', user.id).order('created_at', { ascending: false }),
    svc.from('push_preferences').select('muted, declined_at').eq('user_id', user.id).maybeSingle(),
  ]);
  // Each device is named from its browser string and given a short id (never its address), so this browser can pick out which one is itself.
  const list = await Promise.all((subs ?? []).map(async (x) => ({ id: x.id as string, fp: await endpointFingerprint(x.endpoint as string), label: describeDevice(x.user_agent as string | null), added: x.created_at as string, lastSent: (x.last_sent_at as string | null) ?? null })));
  return NextResponse.json({ configured: true, devices: list.length, list, muted: (pref?.muted as string[] | undefined) ?? [], declined: !!pref?.declined_at, categories });
}

// Mute or unmute kinds of notification (for all my devices), or record that I said "not now" to the offer to turn push on ({ declined: true }),
// so I'm never asked again.
export async function PATCH(request: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  if (typeof b.declined === 'boolean') {
    const { error } = await createServiceClient().from('push_preferences').upsert({ user_id: user.id, declined_at: b.declined ? new Date().toISOString() : null, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) return NextResponse.json({ error: 'Failed to save.' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  const valid = new Set<string>(PUSH_CATEGORIES.map((c) => c.id));
  if (!Array.isArray(b.muted) || !b.muted.every((m: unknown) => typeof m === 'string' && valid.has(m))) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
  const { error } = await createServiceClient().from('push_preferences').upsert({ user_id: user.id, muted: [...new Set<string>(b.muted)], updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) return NextResponse.json({ error: 'Failed to save.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Remove one of my devices (any of them, from any device): it stops getting notifications. { id } is a row from the list above.
export async function DELETE(request: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  if (typeof b.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(b.id)) return NextResponse.json({ error: 'Nothing to remove.' }, { status: 400 });
  const { error } = await createServiceClient().from('push_subscriptions').delete().eq('id', b.id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: 'Failed to remove.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

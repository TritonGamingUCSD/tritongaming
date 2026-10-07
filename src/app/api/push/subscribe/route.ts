import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { pushConfigured, validPushEndpoint } from '@/lib/notifications/webPush';

export const dynamic = 'force-dynamic';
const MAX_DEVICES = 10;

async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// This browser turned notifications on. Saved against me; safe to send again (it just refreshes the row). If someone else was signed in on this
// browser before, the browser now belongs to me.
export async function POST(request: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!pushConfigured()) return NextResponse.json({ error: 'Push notifications aren’t set up on this site yet.' }, { status: 503 });
  const b = await request.json().catch(() => ({}));
  const sub = b.subscription;
  const endpoint = sub?.endpoint, p256dh = sub?.keys?.p256dh, auth = sub?.keys?.auth;
  if (!validPushEndpoint(endpoint) || typeof p256dh !== 'string' || typeof auth !== 'string' || p256dh.length > 200 || auth.length > 100) {
    return NextResponse.json({ error: 'That browser’s notification address isn’t supported.' }, { status: 400 });
  }
  const svc = createServiceClient();
  const { data: mine } = await svc.from('push_subscriptions').select('id, endpoint').eq('user_id', user.id);
  if (!(mine ?? []).some((m) => m.endpoint === endpoint) && (mine ?? []).length >= MAX_DEVICES) {
    return NextResponse.json({ error: `You’ve turned notifications on for ${MAX_DEVICES} devices already. Turn one off first.` }, { status: 409 });
  }
  const { error } = await svc.from('push_subscriptions').upsert({ user_id: user.id, endpoint, p256dh, auth, user_agent: String(request.headers.get('user-agent') ?? '').slice(0, 200) }, { onConflict: 'endpoint' });
  if (error) return NextResponse.json({ error: 'Failed to save.' }, { status: 500 });
  // They turned it on, so a past "not now" no longer applies.
  await svc.from('push_preferences').update({ declined_at: null }).eq('user_id', user.id).not('declined_at', 'is', null);
  return NextResponse.json({ ok: true });
}

// This browser turned notifications off.
export async function DELETE(request: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  if (typeof b.endpoint !== 'string') return NextResponse.json({ error: 'Nothing to turn off.' }, { status: 400 });
  await createServiceClient().from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', b.endpoint);
  return NextResponse.json({ ok: true });
}

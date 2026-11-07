import { NextResponse } from 'next/server';
import { signedIn } from '@/lib/calendar/auth';

export const dynamic = 'force-dynamic';

const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('');
const link = (url: URL, token: string) => `${url.origin}/api/calendar/feed/${token}.ics`;

// The private subscription link for the portal calendar. GET: the link (or none yet). POST: make it. PUT: replace it (the old link stops working at once). DELETE: turn it off.
export async function GET(request: Request) {
  const me = await signedIn();
  if (!me) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const { data } = await me.svc.from('calendar_feeds').select('token').eq('user_id', me.user.id).maybeSingle();
  return NextResponse.json({ url: data ? link(new URL(request.url), data.token as string) : null });
}

export async function POST(request: Request) {
  const me = await signedIn();
  if (!me) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const { data } = await me.svc.from('calendar_feeds').select('token').eq('user_id', me.user.id).maybeSingle();
  const token = (data?.token as string | undefined) ?? newToken();
  if (!data) await me.svc.from('calendar_feeds').insert({ user_id: me.user.id, token });
  return NextResponse.json({ url: link(new URL(request.url), token) });
}

export async function PUT(request: Request) {
  const me = await signedIn();
  if (!me) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const token = newToken();
  await me.svc.from('calendar_feeds').upsert({ user_id: me.user.id, token, created_at: new Date().toISOString() }, { onConflict: 'user_id' });
  return NextResponse.json({ url: link(new URL(request.url), token) });
}

export async function DELETE() {
  const me = await signedIn();
  if (!me) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  await me.svc.from('calendar_feeds').delete().eq('user_id', me.user.id);
  return NextResponse.json({ ok: true });
}

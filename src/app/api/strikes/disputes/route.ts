import { NextResponse } from 'next/server';
import { authorizeStrikes, notifyManagers, quietTest } from '@/lib/strikes';

// "Ask HR about this": a person sends HR a private question about one of their own strikes. Nothing changes until HR decides.
export async function POST(request: Request) {
  const auth = await authorizeStrikes('self');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const message = String(b.message ?? '').trim().slice(0, 500);
  if (!message) return NextResponse.json({ error: 'Write your question for HR.' }, { status: 400 });
  const { data: s } = await auth.svc.from('strikes').select('id, user_id, status').eq('id', String(b.strike_id ?? '')).maybeSingle();
  if (!s || s.user_id !== auth.user.id || s.status === 'draft') return NextResponse.json({ error: 'Strike not found.' }, { status: 404 });
  const { count } = await auth.svc.from('strike_disputes').select('id', { count: 'exact', head: true }).eq('strike_id', s.id).is('resolved_at', null);
  if ((count ?? 0) > 0) return NextResponse.json({ error: 'You already asked HR about this one. They’ll get back to you.' }, { status: 400 });
  const { error } = await auth.svc.from('strike_disputes').insert({ strike_id: s.id, user_id: auth.user.id, message });
  if (error) return NextResponse.json({ error: 'Failed to send.' }, { status: 500 });
  await notifyManagers(auth.svc, 'A question about a strike is waiting', 'Open Strikes and look for the question mark on someone’s record.', auth.user.id, quietTest(request));
  return NextResponse.json({ ok: true }, { status: 201 });
}

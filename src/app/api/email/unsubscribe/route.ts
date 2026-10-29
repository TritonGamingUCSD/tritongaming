import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/notifications/audit';
import { EMAIL_KINDS } from '@/lib/email/prefs';
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe';

export const dynamic = 'force-dynamic';

// The opt-out link in an email. It needs no sign-in: the signed token says who and which kind. GET opens the confirmation page. POST turns that kind off (the mail app's one-click "Unsubscribe"
// button posts here too, with the token in the address).
export async function GET(request: Request) {
  const t = new URL(request.url).searchParams.get('t') ?? '';
  return NextResponse.redirect(new URL(`/email/unsubscribe?t=${encodeURIComponent(t)}`, request.url), 303);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  let t = url.searchParams.get('t') ?? '';
  if (!t) {
    const b = await request.json().catch(() => ({}));
    t = typeof b.t === 'string' ? b.t : '';
  }
  const who = verifyUnsubscribeToken(t);
  if (!who) return NextResponse.json({ error: 'That link is not valid.' }, { status: 400 });
  const column = EMAIL_KINDS.find((k) => k.id === who.kind)!.column;
  const svc = createServiceClient();
  const { error } = await svc
    .from('profiles')
    .update({ [column]: false })
    .eq('id', who.userId);
  if (error) return NextResponse.json({ error: 'Couldn’t save that. Try again.' }, { status: 500 });
  await logAudit(svc, {
    actorId: who.userId,
    action: 'email.unsubscribe',
    entityType: 'email',
    entityId: who.userId,
    summary: `Unsubscribed from ${who.kind} emails using the link in an email`,
  }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}

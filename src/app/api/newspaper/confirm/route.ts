import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { verifyConfirmToken } from '@/lib/email/unsubscribe';

export const dynamic = 'force-dynamic';

// The button on the confirm page: { t } turns a pending sign-up into a subscriber. (A page, not the email's link itself, does it, so a mail scanner opening the link can't subscribe anyone.)
export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}));
  const id = verifyConfirmToken(typeof b.t === 'string' ? b.t : '');
  if (!id) return NextResponse.json({ error: 'That link is not valid.' }, { status: 400 });
  const { data } = await createServiceClient().from('newspaper_subscribers').update({ status: 'active', confirmed_at: new Date().toISOString() }).eq('id', id).select('id');
  if (!data?.length) return NextResponse.json({ error: 'That sign-up is gone. You can sign up again.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

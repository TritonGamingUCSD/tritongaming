import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { emailConfigured, sendOne } from '@/lib/email/mailer';
import { senderForKind } from '@/lib/email/senders';
import { confirmUrl } from '@/lib/email/unsubscribe';
import { LOGO_CID, esc, NAVY, YELLOW, CREAM, HEAD, BODY } from '@/lib/email/template';
import { MAX_PENDING_PER_HOUR, RESEND_AFTER_MS, cleanEmail, cleanName } from '@/lib/newspaper/subscribers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // nodemailer needs Node's network sockets

const SAME_ANSWER = { ok: true, message: 'Check your email. We sent a link to confirm it’s you. You’re added once you click it.' };

// Sign up for the Newspaper without an account: { email, name?, website? } (`website` is a hidden field only a robot fills in). Nobody is added until they click the link in the one email we send (so nobody can sign up someone else's address),
// and the answer is the same whether or not the address was already known (it never says who is subscribed). One confirm email per address every 10 minutes, and the site as a whole takes at most 60 new sign-ups an hour.
export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}));
  if (typeof b.website === 'string' && b.website) return NextResponse.json(SAME_ANSWER); // a robot: told it worked, nothing happens
  const email = cleanEmail(b.email);
  if (!email) return NextResponse.json({ error: 'That doesn’t look like an email address.' }, { status: 400 });
  if (!emailConfigured()) return NextResponse.json({ error: 'Sign-up is closed for now. Try again later.' }, { status: 503 });
  const svc = createServiceClient();
  const { data: row } = await svc.from('newspaper_subscribers').select('id, status, created_at').eq('email', email).maybeSingle();
  if (row?.status === 'active') return NextResponse.json(SAME_ANSWER);
  const { count } = await svc
    .from('newspaper_subscribers')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .gte('created_at', new Date(Date.now() - 3600_000).toISOString());
  if ((count ?? 0) >= MAX_PENDING_PER_HOUR) return NextResponse.json({ error: 'A lot of people are signing up right now. Try again in a little while.' }, { status: 429 });
  let id = row?.id as string | undefined;
  if (row) {
    if (row.status === 'pending' && Date.now() - new Date(row.created_at as string).getTime() < RESEND_AFTER_MS) return NextResponse.json(SAME_ANSWER);
    await svc
      .from('newspaper_subscribers')
      .update({ status: 'pending', name: cleanName(b.name), created_at: new Date().toISOString(), confirmed_at: null })
      .eq('id', id!);
  } else {
    const { data, error } = await svc
      .from('newspaper_subscribers')
      .insert({ email, name: cleanName(b.name) })
      .select('id')
      .single();
    if (error || !data) return NextResponse.json({ error: 'Couldn’t sign you up. Try again.' }, { status: 500 });
    id = data.id as string;
  }
  const link = confirmUrl(id!);
  const name = cleanName(b.name);
  const html = `<!doctype html><html lang="en"><body style="margin:0;background:${CREAM};font-family:${BODY};color:${NAVY};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px;"><table role="presentation" width="480" style="width:100%;max-width:480px;background:#fff;border:2px solid ${NAVY};border-bottom-width:6px;border-right-width:6px;border-radius:8px;"><tr><td style="padding:24px;font-size:16px;line-height:1.6;"><img src="cid:${LOGO_CID}" width="44" height="44" alt="TG" style="border-radius:10px;display:block;margin:0 0 14px;"><h1 style="margin:0 0 12px;font-family:${HEAD};font-size:22px;">Confirm your email</h1><p style="margin:0 0 16px;">${name ? `Hi ${esc(name)}! ` : ''}Press the button to get the Triton Gaming newspaper at this address. If you didn’t ask for it, ignore this email and nothing happens.</p><a href="${esc(link)}" style="display:inline-block;background:${YELLOW};color:${NAVY};border:2px solid ${NAVY};border-bottom-width:5px;border-right-width:5px;border-radius:6px;padding:11px 22px;font-family:${HEAD};font-weight:800;text-decoration:none;">Yes, Sign Me Up</a></td></tr></table></td></tr></table></body></html>`;
  const sent = await sendOne({
    to: email,
    subject: 'Confirm your email for the Triton Gaming newspaper',
    text: `Confirm your email for the Triton Gaming newspaper: ${link}\n\nIf you didn’t ask for it, ignore this email.`,
    html,
    sender: senderForKind('newsletter'),
  });
  if (!sent.ok) return NextResponse.json({ error: 'We couldn’t send the confirm email. Check the address and try again.' }, { status: 502 });
  return NextResponse.json(SAME_ANSWER);
}

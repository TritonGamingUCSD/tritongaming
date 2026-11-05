import { canUseLive } from '@/lib/divisions/liveAccess';
import { NextResponse } from 'next/server';
import { sendOne } from '@/lib/email/mailer';
import { siteUrl, emailHtml, emailText } from '@/lib/email/template';
import { photoLink } from '@/lib/photobooth/booth';
import { TOKEN } from '@/lib/photobooth/token';
import { authorizePhotoBooth } from '@/lib/photobooth/server';

export const dynamic = 'force-dynamic';

/** How many emails one picture's link may be sent in all (a group of friends can each have it, but the booth cannot be used to send a flood of email), and how many addresses one request may carry. */
const MAX_EMAILS = 10;
const MAX_PER_REQUEST = 6;
const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/;

// The booth emails guests the link to their picture: POST { token, emails: [..] } (or one { email }); every person gets their own email. The addresses are used once and never stored; each picture can be emailed 10 times in all.
export async function POST(request: Request) {
  const auth = await authorizePhotoBooth();
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const raw: unknown[] = Array.isArray(b.emails) ? b.emails : [b.email];
  const emails = [
    ...new Set(
      raw
        .filter((e): e is string => typeof e === 'string')
        .map((e) => e.trim().slice(0, 200).toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (typeof b.token !== 'string' || !TOKEN.test(b.token)) return NextResponse.json({ error: 'That picture is gone.' }, { status: 404 });
  if (!emails.length) return NextResponse.json({ error: 'Type an email address.' }, { status: 400 });
  if (emails.length > MAX_PER_REQUEST) return NextResponse.json({ error: `Send to ${MAX_PER_REQUEST} people at a time, then add more.` }, { status: 400 });
  const bad = emails.find((e) => !EMAIL.test(e));
  if (bad) return NextResponse.json({ error: `“${bad}” doesn’t look like an email address.` }, { status: 400 });
  const { data } = await auth.svc.from('photobooth_photos').select('id, expires_at, emails_sent, photobooths(name, division_id)').eq('token', b.token).maybeSingle();
  const owner = data?.photobooths as unknown as { division_id: string | null } | { division_id: string | null }[] | null | undefined;
  const ownerId = (Array.isArray(owner) ? owner[0]?.division_id : owner?.division_id) ?? null;
  if (!data || !canUseLive(auth.scope, ownerId) || new Date(data.expires_at as string).getTime() <= Date.now())
    return NextResponse.json({ error: 'That picture is gone.' }, { status: 404 });
  const room = MAX_EMAILS - (data.emails_sent as number);
  if (room <= 0) return NextResponse.json({ error: 'The link for this picture has been emailed enough times.' }, { status: 429 });
  if (emails.length > room) return NextResponse.json({ error: `Only ${room} more ${room === 1 ? 'email' : 'emails'} can be sent for this picture.` }, { status: 429 });
  const booth = data.photobooths as unknown as { name: string } | { name: string }[] | null;
  const name = (Array.isArray(booth) ? booth[0]?.name : booth?.name) ?? 'the photo booth';
  const link = photoLink(b.token, siteUrl());
  const subject = 'Your Triton Gaming Photo';
  const message = `Thanks for stopping by ${name}! Here is your picture.\n\n[Get Your Photo](${link})\n\nIt is kept for a few days and then deleted, so download it soon.`;
  const failed: string[] = [];
  for (const to of emails) {
    const sent = await sendOne({
      to,
      subject,
      text: emailText(message),
      html: emailHtml({ subject, message, preheader: 'Your picture from the photo booth' }),
      sender: 'events',
    });
    if (!sent.ok) failed.push(to);
  }
  const ok = emails.length - failed.length;
  if (ok)
    await auth.svc
      .from('photobooth_photos')
      .update({ emails_sent: (data.emails_sent as number) + ok })
      .eq('id', data.id);
  if (!ok) return NextResponse.json({ error: 'The email could not be sent.', failed }, { status: 502 });
  return NextResponse.json({ ok: true, sent: ok, failed });
}

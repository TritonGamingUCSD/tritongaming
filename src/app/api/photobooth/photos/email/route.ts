import { NextResponse } from 'next/server';
import { sendOne } from '@/lib/email/mailer';
import { siteUrl, emailHtml, emailText } from '@/lib/email/template';
import { photoLink } from '@/lib/photobooth/booth';
import { TOKEN } from '@/lib/photobooth/token';
import { authorizePhotoBooth } from '@/lib/photobooth/server';

export const dynamic = 'force-dynamic';

/** How many times one picture's link may be emailed (so the booth cannot be used to send a flood of email). */
const MAX_EMAILS = 3;
const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/;

// The booth emails a guest the link to their picture: POST { token, email }. The address is used once and never stored; each picture can be emailed a few times.
export async function POST(request: Request) {
  const auth = await authorizePhotoBooth();
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const email = typeof b.email === 'string' ? b.email.trim().slice(0, 200) : '';
  if (typeof b.token !== 'string' || !TOKEN.test(b.token)) return NextResponse.json({ error: 'That picture is gone.' }, { status: 404 });
  if (!EMAIL.test(email)) return NextResponse.json({ error: 'That doesn’t look like an email address.' }, { status: 400 });
  const { data } = await auth.svc.from('photobooth_photos').select('id, expires_at, emails_sent, photobooths(name)').eq('token', b.token).maybeSingle();
  if (!data || new Date(data.expires_at as string).getTime() <= Date.now()) return NextResponse.json({ error: 'That picture is gone.' }, { status: 404 });
  if ((data.emails_sent as number) >= MAX_EMAILS) return NextResponse.json({ error: 'The link for this picture has been emailed enough times.' }, { status: 429 });
  const booth = data.photobooths as unknown as { name: string } | { name: string }[] | null;
  const name = (Array.isArray(booth) ? booth[0]?.name : booth?.name) ?? 'the photo booth';
  const link = photoLink(b.token, siteUrl());
  const subject = 'Your Triton Gaming Photo';
  const message = `Thanks for stopping by ${name}! Here is your picture.\n\n[Get Your Photo](${link})\n\nIt is kept for a few days and then deleted, so download it soon.`;
  const sent = await sendOne({
    to: email,
    subject,
    text: emailText(message),
    html: emailHtml({ subject, message, preheader: 'Your picture from the photo booth' }),
    sender: 'events',
  });
  if (!sent.ok) return NextResponse.json({ error: sent.error ?? 'The email could not be sent.' }, { status: 502 });
  await auth.svc
    .from('photobooth_photos')
    .update({ emails_sent: (data.emails_sent as number) + 1 })
    .eq('id', data.id);
  return NextResponse.json({ ok: true });
}

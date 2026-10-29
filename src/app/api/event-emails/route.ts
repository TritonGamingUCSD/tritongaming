import { NextResponse } from 'next/server';
import { APPLE_ICON_DATA_URI } from '@/lib/site/appleIcon';
import { logAudit } from '@/lib/notifications/audit';
import { EMAIL_DAILY_LIMIT, isEmailKind, type EmailKind } from '@/lib/email/prefs';
import { eventEmailSubject } from '@/lib/email/eventEmail';
import { senderAddress, senderForKind, senderReplyTo } from '@/lib/email/senders';
import { emailConfigured, sendOne } from '@/lib/email/mailer';
import { audienceFor, authorizeEventEmail, loadEvent, quotaLeft, renderFor, sentLastDay } from '@/lib/email/eventEmailServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // nodemailer needs Node's network sockets
const UUID = /^[0-9a-f-]{36}$/i;
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Event emails, for admins and people granted "Send event emails".
//   GET                       the events to choose from, and whether email is set up
//   GET ?event_id=&kind=...   one event: who would get the email (and who is skipped), what is left of today's limit, a preview, and what was sent before
//   POST { action: 'test' }   send the email to the person who is signed in, marked as a test
//   POST { action: 'start' }  record a send (the page then asks for it a batch at a time, after its 60-second countdown)
export async function GET(request: Request) {
  const a = await authorizeEventEmail();
  if (a.error) return a.error;
  const { svc } = a;
  const params = new URL(request.url).searchParams;
  const eventId = params.get('event_id');
  if (!eventId) {
    const { data } = await svc.from('events').select('id, title, start_date, is_published').order('start_date', { ascending: false }).limit(60);
    return NextResponse.json({ configured: emailConfigured(), from: senderAddress('events'), replyTo: senderReplyTo('events'), limit: EMAIL_DAILY_LIMIT, events: data ?? [] });
  }
  if (!UUID.test(eventId)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const kind: EmailKind = isEmailKind(params.get('kind')) ? (params.get('kind') as EmailKind) : 'reminders';
  const event = await loadEvent(svc, eventId);
  if (!event) return NextResponse.json({ error: 'That event is gone.' }, { status: 404 });
  const subject = text(params.get('subject'), 200) || eventEmailSubject(kind, event.title);
  const note = text(params.get('note'), 2000);
  const cover = params.get('cover') !== '0';
  const [aud, used, { data: history }] = await Promise.all([
    audienceFor(svc, eventId, kind),
    sentLastDay(svc),
    svc
      .from('event_emails')
      .select('id, kind, subject, sent_by, sent_at, recipients, sent, failed, skipped_optout, skipped_no_email')
      .eq('event_id', eventId)
      .eq('test', false)
      .order('sent_at', { ascending: false })
      .limit(30),
  ]);
  const names = new Map<string, string>();
  const ids = [...new Set((history ?? []).map((h) => h.sent_by as string | null).filter((x): x is string => !!x))];
  if (ids.length)
    for (const p of (await svc.from('profiles').select('id, display_name').in('id', ids)).data ?? []) names.set(p.id as string, (p.display_name as string | null) ?? 'Someone');
  const sample = renderFor({ event, kind, subject, note, person: { id: a.user.id, ticketId: null }, logoSrc: APPLE_ICON_DATA_URI, showCover: cover });
  return NextResponse.json({
    event: { id: event.id, title: event.title, start_date: event.start_date, is_published: event.is_published },
    subject,
    preview: sample.html,
    recipients: aud.people.length,
    ticketHolders: aud.ticketHolders,
    skippedOptOut: aud.skippedOptOut,
    skippedNoEmail: aud.skippedNoEmail,
    usedToday: used,
    left: quotaLeft(used),
    limit: EMAIL_DAILY_LIMIT,
    history: (history ?? []).map((h) => ({ ...h, sent_by: h.sent_by ? (names.get(h.sent_by as string) ?? 'Someone') : 'Someone' })),
  });
}

export async function POST(request: Request) {
  const a = await authorizeEventEmail();
  if (a.error) return a.error;
  const { svc, user } = a;
  if (!emailConfigured()) return NextResponse.json({ error: 'Email isn’t set up yet (GMAIL_USER and GMAIL_APP_PASSWORD).' }, { status: 503 });
  const b = await request.json().catch(() => ({}));
  const eventId = typeof b.event_id === 'string' && UUID.test(b.event_id) ? b.event_id : '';
  const kind: EmailKind = isEmailKind(b.kind) && b.kind !== 'newsletter' ? b.kind : 'reminders';
  const event = eventId ? await loadEvent(svc, eventId) : null;
  if (!event) return NextResponse.json({ error: 'Pick an event.' }, { status: 400 });
  const subject = text(b.subject, 200);
  const note = text(b.note, 2000);
  const cover = b.cover !== false;
  if (!subject) return NextResponse.json({ error: 'Add a subject.' }, { status: 400 });

  if (b.action === 'test') {
    const { data: au } = await svc.auth.admin.getUserById(user.id);
    const to = au.user?.email;
    if (!to) return NextResponse.json({ error: 'Your account has no email address.' }, { status: 400 });
    const r = renderFor({ event, kind, subject: `[TEST] ${subject}`, note, person: { id: user.id, ticketId: null }, test: true, showCover: cover });
    const res = await sendOne({ to, subject: `[TEST] ${subject}`, text: r.text, html: r.html, sender: senderForKind(kind), unsubscribeUrl: r.unsubscribeUrl });
    // A test is a real email through the same mailbox, so it counts toward the day's limit (it is kept out of the history).
    await svc
      .from('event_emails')
      .insert({ event_id: eventId, kind, subject: `[TEST] ${subject}`, cover, sent_by: user.id, test: true, recipients: 1, sent: res.ok ? 1 : 0, failed: res.ok ? 0 : 1 });
    await logAudit(svc, {
      actorId: user.id,
      action: 'event_email.test',
      entityType: 'event',
      entityId: eventId,
      summary: `Sent a test ${kind === 'reminders' ? 'reminder' : 'update'} email for ${event.title} to themselves${res.ok ? '' : ' (it failed)'}`,
    }).catch(() => undefined);
    return res.ok ? NextResponse.json({ ok: true, to }) : NextResponse.json({ error: res.error ?? 'It couldn’t be sent.' }, { status: 502 });
  }

  if (b.action === 'start') {
    if (!event.is_published) return NextResponse.json({ error: 'That event is not published, so there is nothing to remind people about.' }, { status: 409 });
    const [aud, used] = await Promise.all([audienceFor(svc, eventId, kind), sentLastDay(svc)]);
    if (aud.people.length === 0) return NextResponse.json({ error: 'Nobody would get this: no one has a ticket, or everyone opted out.' }, { status: 409 });
    if (aud.people.length > quotaLeft(used))
      return NextResponse.json(
        { error: `That is ${aud.people.length} emails and only ${quotaLeft(used)} are left of today’s ${EMAIL_DAILY_LIMIT}. Try again later.` },
        { status: 409 },
      );
    const { data, error } = await svc
      .from('event_emails')
      .insert({
        event_id: eventId,
        kind,
        subject,
        note: note || null,
        cover,
        sent_by: user.id,
        recipients: aud.people.length,
        skipped_optout: aud.skippedOptOut,
        skipped_no_email: aud.skippedNoEmail,
      })
      .select('id')
      .single();
    if (error || !data) return NextResponse.json({ error: 'Couldn’t start the send.' }, { status: 500 });
    await logAudit(svc, {
      actorId: user.id,
      action: 'event_email.send',
      entityType: 'event',
      entityId: eventId,
      summary: `Sent a ${kind === 'reminders' ? 'reminder' : 'update'} email for ${event.title} to ${aud.people.length} people`,
    }).catch(() => undefined);
    return NextResponse.json({ id: data.id, recipients: aud.people.length });
  }
  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}

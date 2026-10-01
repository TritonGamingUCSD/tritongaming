import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { PACIFIC_TZ } from '@/lib/timezone';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HOUR = 3600_000;

interface TicketRow {
  id: string;
  user_id: string;
  reminder_24h_sent_at: string | null;
  reminder_1h_sent_at: string | null;
  event: { id: string; title: string; start_date: string; location: string | null; is_online: boolean; slug: string | null; is_published: boolean } | null;
}

async function sendEmail(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.REMINDER_FROM_EMAIL || 'Triton Gaming <onboarding@resend.dev>', to, subject, text }),
  });
  return res.ok;
}

// Called on a schedule (see vercel.json) with `Authorization: Bearer $CRON_SECRET`.
// Sends an in-app notification (always) and an email (when RESEND_API_KEY is
// set and the person hasn't opted out) once ~24h and once ~1h before an event
// starts. Per-ticket sent-timestamps make it safe to run as often as you like.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const svc = createServiceClient();
  const now = Date.now();
  const horizon = new Date(now + 24 * HOUR).toISOString();

  const { data, error } = await svc
    .from('tickets')
    .select('id, user_id, reminder_24h_sent_at, reminder_1h_sent_at, event:events!inner(id, title, start_date, location, is_online, slug, is_published)')
    .eq('status', 'active')
    .is('reminder_1h_sent_at', null)
    .gt('event.start_date', new Date(now).toISOString())
    .lte('event.start_date', horizon);
  if (error) {
    console.error('[reminders] query failed:', error);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  const due: { ticket: TicketRow; kind: '24h' | '1h' }[] = [];
  for (const t of (data ?? []) as unknown as TicketRow[]) {
    const ev = t.event;
    if (!ev || !ev.is_published) continue;
    const until = new Date(ev.start_date).getTime() - now;
    // Registered shortly before the event? Skip the day-before nudge and just send the hour-before one.
    if (until <= 90 * 60_000) due.push({ ticket: t, kind: '1h' });
    else if (until > 2 * HOUR && !t.reminder_24h_sent_at) due.push({ ticket: t, kind: '24h' });
  }
  if (due.length === 0) return NextResponse.json({ sent: 0 });

  const userIds = [...new Set(due.map((d) => d.ticket.user_id))];
  const { data: profs } = await svc.from('profiles').select('id, email_reminders').in('id', userIds);
  const wantsEmail = new Map((profs ?? []).map((p) => [p.id as string, p.email_reminders as boolean]));

  let inApp = 0, emails = 0;
  for (const { ticket, kind } of due) {
    const ev = ticket.event!;
    const when = new Date(ev.start_date).toLocaleString('en-US', { timeZone: PACIFIC_TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    const where = ev.is_online ? 'Online' : ev.location || '';
    const title = kind === '1h' ? `${ev.title} starts within the hour` : `${ev.title} is tomorrow`;
    const body = `${when}${where ? ` · ${where}` : ''}. Have your QR code ready.`;

    // Claim the ticket first so a concurrent/repeat run can't double-send.
    const stamp = new Date().toISOString();
    const patch = kind === '1h' ? { reminder_24h_sent_at: stamp, reminder_1h_sent_at: stamp } : { reminder_24h_sent_at: stamp };
    const { data: claimed } = await svc.from('tickets').update(patch).eq('id', ticket.id).is(kind === '1h' ? 'reminder_1h_sent_at' : 'reminder_24h_sent_at', null).select('id');
    if (!claimed?.length) continue;

    const { error: nErr } = await svc.from('notifications').insert({ user_id: ticket.user_id, type: 'event_reminder', title, body, href: '/portal/tickets' });
    if (!nErr) inApp++;

    if (wantsEmail.get(ticket.user_id) !== false && process.env.RESEND_API_KEY) {
      try {
        const { data: u } = await svc.auth.admin.getUserById(ticket.user_id);
        const to = u.user?.email;
        if (to && (await sendEmail(to, title, `${body}\n\nYour ticket: ${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/portal/tickets\n\nTurn off these emails in your portal profile.`))) emails++;
      } catch (err) {
        console.error('[reminders] email failed:', err);
      }
    }
  }

  return NextResponse.json({ sent: inApp, emails });
}

import type { SupabaseClient } from '@supabase/supabase-js';
import { createNotifications } from '@/lib/notifications/notify';
import { formatPacificDateTime, formatPacificTime, pacificDaysUntil } from '@/lib/core/timezone';

const HOUR = 3600_000;
// The job runs once a day (9 AM Pacific), so it looks 36 hours ahead: everything tomorrow up to 9 PM is announced the morning before, not only what starts before 9 AM.
const LOOK_AHEAD_HOURS = 36;

export interface TicketRow {
  id: string;
  user_id: string;
  reminder_24h_sent_at: string | null;
  reminder_1h_sent_at: string | null;
  event: { id: string; title: string; start_date: string; location: string | null; is_online: boolean; slug: string | null; is_published: boolean } | null;
}

// The headline of a reminder. The day-before one is sent up to 24 hours ahead, so the event may still be later today: the word comes from the Pacific calendar day, never from "less than 24 hours".
export function reminderTitle(kind: '24h' | '1h', eventTitle: string, startISO: string, now: Date): string {
  if (kind === '1h') return `${eventTitle} starts within the hour`;
  const days = pacificDaysUntil(startISO, now);
  const day = days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
  return `${eventTitle} is ${day} at ${formatPacificTime(startISO)}`;
}

// Which of these tickets are due a reminder now, and which one. Pure: it only reads the rows and the clock.
//   - an event within 90 minutes gets the hour-before reminder (also when the day-before one was never sent: someone who registered late)
//   - an event further than 2 hours away gets the day-before one, once
export function dueReminders(rows: TicketRow[], now: Date): { ticket: TicketRow; kind: '24h' | '1h' }[] {
  const due: { ticket: TicketRow; kind: '24h' | '1h' }[] = [];
  for (const ticket of rows) {
    const ev = ticket.event;
    if (!ev || !ev.is_published) continue;
    const until = new Date(ev.start_date).getTime() - now.getTime();
    if (until <= 90 * 60_000) due.push({ ticket, kind: '1h' });
    else if (until > 2 * HOUR && !ticket.reminder_24h_sent_at) due.push({ ticket, kind: '24h' });
  }
  return due;
}

// The body line of a reminder: when and where.
export function reminderBody(ev: { start_date: string; location: string | null; is_online: boolean }): string {
  const where = ev.is_online ? 'Online' : ev.location || '';
  return `${formatPacificDateTime(ev.start_date, { weekday: true })}${where ? ` · ${where}` : ''}. Have your QR code ready.`;
}

// Marks the reminder as sent for this ticket, and says whether this run was the one that did it (so a concurrent or repeated run cannot send it twice).
async function claimReminder(svc: SupabaseClient, ticketId: string, kind: '24h' | '1h'): Promise<boolean> {
  const stamp = new Date().toISOString();
  const patch = kind === '1h' ? { reminder_24h_sent_at: stamp, reminder_1h_sent_at: stamp } : { reminder_24h_sent_at: stamp };
  const { data: claimed } = await svc
    .from('tickets')
    .update(patch)
    .eq('id', ticketId)
    .is(kind === '1h' ? 'reminder_1h_sent_at' : 'reminder_24h_sent_at', null)
    .select('id');
  return !!claimed?.length;
}

// Sends an in-app (bell) notification, with a push, the day before (anything starting in the next 36 hours) and once ~1h before an event starts (no email). Per-ticket sent-timestamps make it safe to run as
// often as you like. (Called by the daily-reminders job, see src/app/api/cron/daily-reminders.)
export async function sendEventReminders(svc: SupabaseClient, nowDate: Date = new Date()): Promise<{ sent: number; error?: string }> {
  const now = nowDate.getTime();
  const { data, error } = await svc
    .from('tickets')
    .select('id, user_id, reminder_24h_sent_at, reminder_1h_sent_at, event:events!inner(id, title, start_date, location, is_online, slug, is_published)')
    .eq('status', 'active')
    .is('reminder_1h_sent_at', null)
    .gt('event.start_date', new Date(now).toISOString())
    .lte('event.start_date', new Date(now + LOOK_AHEAD_HOURS * HOUR).toISOString());
  if (error) {
    console.error('[reminders] query failed:', error);
    return { sent: 0, error: 'Query failed' };
  }

  let inApp = 0;
  for (const { ticket, kind } of dueReminders((data ?? []) as unknown as TicketRow[], nowDate)) {
    const ev = ticket.event!;
    if (!(await claimReminder(svc, ticket.id, kind))) continue;
    const note = { user_id: ticket.user_id, type: 'event_reminder', title: reminderTitle(kind, ev.title, ev.start_date, nowDate), body: reminderBody(ev), href: '/portal/tickets' };
    if (await createNotifications(svc, [note])) inApp++;
  }
  return { sent: inApp };
}

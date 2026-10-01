import type { SupabaseClient } from '@supabase/supabase-js';
import { PACIFIC_TZ, eventDayCount, eventDayProgress } from '@/lib/timezone';

// A multi-day event (several Pacific calendar days) lets each ticket be checked in once
// per day. tickets.status/checked_in_at still record the first check-in (and drive
// points, which are awarded once); ticket_checkins has one row per ticket per day.

export function pacificDayKey(date: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: PACIFIC_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function isMultiDayEvent(start: string, end?: string | null): boolean {
  return eventDayCount(start, end) > 1;
}

export function currentDayInfo(start: string, end?: string | null): { day: number; total: number } | null {
  return eventDayProgress(start, end);
}

// The time of today's check-in for this ticket, or null if they haven't been scanned in today.
export async function todaysCheckinAt(svc: SupabaseClient, ticketId: string): Promise<string | null> {
  const { data } = await svc.from('ticket_checkins').select('checked_in_at').eq('ticket_id', ticketId).eq('day', pacificDayKey()).maybeSingle();
  return (data?.checked_in_at as string | undefined) ?? null;
}

// Whether a scan right now should be accepted: any active ticket, or — for a multi-day
// event — an already-used ticket that hasn't been scanned in yet today.
export async function canCheckInNow(
  svc: SupabaseClient,
  ticket: { id: string; status: string },
  event: { start_date: string; end_date: string | null } | null | undefined,
): Promise<boolean> {
  if (ticket.status === 'active') return true;
  if (ticket.status !== 'used' || !event || !isMultiDayEvent(event.start_date, event.end_date)) return false;
  return (await todaysCheckinAt(svc, ticket.id)) === null;
}

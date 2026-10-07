import type { SupabaseClient } from '@supabase/supabase-js';
import { pacificDayKey } from '@/lib/events/checkinDays';
import { addDaysKey } from '@/lib/meetings/meetings';
import type { CalendarItem } from '@/lib/events/calendarItems';
import { fetchExternalEvents, type AccountStatus } from '@/lib/events/googleCalendar';

// The member's linked Google Calendar as calendar items (kind 'google'): theirs alone, never part of anything shared (the subscribe
// feed, other people's views, plan results). A multi-day event gets one entry per day, like events do.
export async function googleItems(svc: SupabaseClient, userId: string, from: string, to: string): Promise<{ items: CalendarItem[]; accounts: AccountStatus[]; error: 'revoked' | 'failed' | null; linked: boolean }> {
  try {
    const r = await fetchExternalEvents(svc, userId, new Date(`${addDaysKey(from, -1)}T00:00:00Z`).toISOString(), new Date(`${addDaysKey(to, 2)}T00:00:00Z`).toISOString());
    if (!r) return { items: [], accounts: [], error: null, linked: false };
    const items: CalendarItem[] = [];
    for (const e of r.events) {
      const first = e.allDay ? e.start : pacificDayKey(new Date(e.start));
      // All-day ends the morning after its last day; a timed event that ends exactly at midnight belongs to the day before.
      const lastRaw = e.end ? (e.allDay ? addDaysKey(e.end, -1) : pacificDayKey(new Date(new Date(e.end).getTime() - 1))) : first;
      const last = lastRaw < first ? first : lastRaw;
      for (let day = first, i = 0; day <= last && i < 31; day = addDaysKey(day, 1), i++) {
        if (day < from || day > to) continue;
        const span = Math.round((new Date(`${last}T12:00:00Z`).getTime() - new Date(`${first}T12:00:00Z`).getTime()) / 86_400_000) + 1;
        items.push({
          key: `g|${e.account}|${e.id}|${day}`, kind: 'google', date: day, title: e.title,
          start: e.allDay ? `${day}T00:00:00` : e.start, end: e.allDay ? null : e.end, location: e.location, href: e.link ?? '', mine: false,
          dayLabel: span > 1 ? `Day ${Math.round((new Date(`${day}T12:00:00Z`).getTime() - new Date(`${first}T12:00:00Z`).getTime()) / 86_400_000) + 1} of ${span}` : null,
          allDay: e.allDay, account: e.account,
        });
      }
    }
    const bad = r.accounts.find((a) => a.error);
    return { items, accounts: r.accounts, error: bad ? bad.error : null, linked: true };
  } catch {
    return { items: [], accounts: [], error: 'failed', linked: true };
  }
}

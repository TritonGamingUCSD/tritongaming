import { isCheckinWindowOpen, dayHoursOverError, type CheckinDayWindow } from '@/lib/events/checkinWindow';
import { closingHours } from '@/lib/events/dayHours';

// Self check-in has three settings per event: off, on until the event ends, or on with no end. Once it is on it works at any time, with one exception for
// multi-day events: a day that has hours set (the event's hours for that day, else the scanner's check-in hours) closes when they end (it opens again for the next day by itself). "Until the event ends" uses the same
// end rule as the ticket scanner: the event's end time, or 24 hours after the start for an old event that has none.
export const SELF_CHECKIN_MODES = ['off', 'until_end', 'forever'] as const;
export type SelfCheckinMode = (typeof SELF_CHECKIN_MODES)[number];

export function cleanSelfCheckinMode(v: unknown): SelfCheckinMode {
  return SELF_CHECKIN_MODES.includes(v as SelfCheckinMode) ? (v as SelfCheckinMode) : 'off';
}

export type SelfCheckinClosed = { code: 'closed' | 'ended' | 'day_over'; message: string };

// null when self check-in may go ahead right now, otherwise why not.
export function selfCheckinClosedReason(
  mode: SelfCheckinMode,
  event: { start_date: string; end_date?: string | null; day_hours?: CheckinDayWindow[] | null; checkin_windows?: CheckinDayWindow[] | null },
  now: Date = new Date(),
): SelfCheckinClosed | null {
  if (mode === 'off') return { code: 'closed', message: "Self check-in isn't open for this event. Please see a staff member." };
  if (mode === 'until_end' && !isCheckinWindowOpen(event)) return { code: 'ended', message: 'This event has already ended.' };
  const over = dayHoursOverError({ checkin_windows: closingHours(event.day_hours, event.checkin_windows) }, now);
  if (over) return { code: 'day_over', message: `${over} It opens again tomorrow if the event continues.` };
  return null;
}

export const SELF_CHECKIN_LABELS: Record<SelfCheckinMode, string> = { off: 'Off', until_end: 'On until the event ends', forever: 'On, no end' };

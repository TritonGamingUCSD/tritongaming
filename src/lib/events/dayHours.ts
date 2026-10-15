import { to12h, type CheckinDayWindow } from '@/lib/events/checkinWindow';

// The hours of each day of a multi-day event (Pacific time, "17:00" style). They are the event's own hours: shown on the public page, and the event's overall start and
// end come from the first day's start and the last day's end. They are separate from checkin_windows, which only limits the staff scanner.
export type DayHours = CheckinDayWindow;

// Only days that still exist in the event, each with a start and an end in order, sorted by day. A one-day event has none (its start and end are enough).
export function cleanDayHours(list: DayHours[] | null | undefined, days: string[]): DayHours[] {
  if (days.length < 2) return [];
  const set = new Set(days);
  return (list ?? []).filter((w) => set.has(w.day) && w.start && w.end && w.start < w.end).sort((a, b) => a.day.localeCompare(b.day));
}

export function dayHoursComplete(list: DayHours[], days: string[]): boolean {
  return days.length > 1 && days.every((d) => list.some((w) => w.day === d && w.start && w.end && w.start < w.end));
}

// "Fri, Oct 10 · 5:00 PM – 9:00 PM"
export function formatDayHours(w: DayHours): string {
  const date = new Date(`${w.day}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
  return `${date} · ${to12h(w.start)} – ${to12h(w.end)}`;
}

// What the self check-in uses to close a day: that day's event hours, and where a day has none, the scanner's check-in hours for it.
export function closingHours(dayHours: DayHours[] | null | undefined, checkinWindows: CheckinDayWindow[] | null | undefined): CheckinDayWindow[] {
  const have = new Set((dayHours ?? []).map((w) => w.day));
  return [...(dayHours ?? []), ...(checkinWindows ?? []).filter((w) => !have.has(w.day))];
}

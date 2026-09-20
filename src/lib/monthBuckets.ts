import { PACIFIC_TZ } from '@/lib/timezone';

export interface MonthPoint { month: string; count: number; }

const MONTH_FMT = new Intl.DateTimeFormat('en-US', { timeZone: PACIFIC_TZ, month: 'short', year: '2-digit' });
// year/month only, in Pacific — used purely to derive a sortable "YYYY-MM"
// bucket key, not for display.
const MONTH_KEY_FMT = new Intl.DateTimeFormat('en-US', { timeZone: PACIFIC_TZ, year: 'numeric', month: '2-digit' });

// Timestamps come back from Postgres as UTC ISO strings. Slicing the first 7
// characters reads the *UTC* year-month directly off the string — for a
// signup/event created in the last few hours of a UTC day (which is
// afternoon/evening the previous day in Pacific, since Pacific runs 7-8
// hours behind), that silently attributes it to the wrong month in the
// "per month" charts. Formatting through Intl with an explicit Pacific
// timeZone buckets it by the calendar month it actually falls in for this
// club's own timezone, not whatever UTC's clock happened to read.
function monthKey(iso: string): string {
  const parts = MONTH_KEY_FMT.formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}`;
}

// Shared between getStatsData.ts (member growth) and getEventsData.ts
// (events/tickets per month) — the same Pacific-timezone bucketing logic,
// used for two different entities.
export function bucketByMonth(dates: string[]): MonthPoint[] {
  const counts = new Map<string, number>();
  dates.forEach((d) => {
    const key = monthKey(d);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    // Noon UTC, not midnight — a date-time string with no offset is parsed
    // as *local* time (the server process's own timezone, not necessarily
    // Pacific), so midnight there could format back to the previous day/
    // month once MONTH_FMT re-renders it in Pacific. Noon UTC lands in the
    // early morning of the same calendar day in Pacific (7-8 hours behind),
    // so it can never cross a month boundary when reformatted.
    .map(([key, count]) => ({ month: MONTH_FMT.format(new Date(`${key}-01T12:00:00Z`)), count }));
}

export function cumulative(points: MonthPoint[]): MonthPoint[] {
  let running = 0;
  return points.map((p) => {
    running += p.count;
    return { month: p.month, count: running };
  });
}

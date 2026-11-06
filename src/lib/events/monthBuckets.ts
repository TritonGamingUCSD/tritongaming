import { PACIFIC_TZ } from '@/lib/core/timezone';

export interface MonthPoint {
  month: string; // "May" (with the year on January and on the first month when the series spans more than one year: "Jan ’27")
  key: string; // "2026-05", for sorting and matching
  count: number;
}

const MONTH_NAME = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short' });
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
// The label for a month: just its name ("May"). When the series runs across more than one year, the first month and every January also carry the year ("Jan ’27"), so a year boundary is never a guess.
export function monthLabels(keys: string[]): Map<string, string> {
  const sorted = [...keys].sort();
  const years = new Set(sorted.map((k) => k.slice(0, 4)));
  const out = new Map<string, string>();
  sorted.forEach((k, i) => {
    // Noon UTC so the name can never slip into the neighbouring month.
    const name = MONTH_NAME.format(new Date(`${k}-15T12:00:00Z`));
    out.set(k, years.size > 1 && (i === 0 || k.endsWith('-01')) ? `${name} ’${k.slice(2, 4)}` : name);
  });
  return out;
}

export function bucketByMonth(dates: string[]): MonthPoint[] {
  const counts = new Map<string, number>();
  dates.forEach((d) => {
    const key = monthKey(d);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  const sorted = [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  const labels = monthLabels(sorted.map(([k]) => k));
  return sorted.map(([key, count]) => ({ key, month: labels.get(key) ?? key, count }));
}

export function cumulative(points: MonthPoint[]): MonthPoint[] {
  let running = 0;
  return points.map((p) => {
    running += p.count;
    return { month: p.month, key: p.key, count: running };
  });
}

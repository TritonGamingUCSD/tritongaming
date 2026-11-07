// The dashboard's countdowns: the next holidays, when the quarter ends, when the next one starts, and the next event. Pure functions of a Pacific day (YYYY-MM-DD).
const DAY = 86_400_000;
const utc = (day: string) => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));
const key = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** The day n days after a day. */
export const addDays = (day: string, n: number) => new Date(utc(day) + n * DAY).toISOString().slice(0, 10);

/** Whole days from one day to another (negative when the second is earlier). */
export const daysBetween = (from: string, to: string) => Math.round((utc(to) - utc(from)) / DAY);

/** The nth (1-based) given weekday (0 = Sunday) of a month, or the last one with n = -1. */
export function nthWeekday(year: number, month: number, weekday: number, n: number): string {
  if (n > 0) {
    const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    return key(year, month, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
  }
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = new Date(Date.UTC(year, month - 1, lastDay)).getUTCDay();
  return key(year, month, lastDay - ((last - weekday + 7) % 7));
}

// Lunar New Year moves; these are the dates for the next few years.
const LUNAR_NEW_YEAR: Record<number, string> = { 2026: '2026-02-17', 2027: '2027-02-06', 2028: '2028-01-26', 2029: '2029-02-13', 2030: '2030-02-03', 2031: '2031-01-23' };

export interface Holiday {
  name: string;
  day: string;
  /** A short emoji-free mark for the tile. */
  kind: 'fun' | 'break' | 'national';
}

/** The holidays of one year, in date order. Students care about the days off and the fun ones. */
export function holidaysOf(year: number): Holiday[] {
  const list: Holiday[] = [
    { name: 'New Year’s Day', day: key(year, 1, 1), kind: 'national' },
    { name: 'MLK Day', day: nthWeekday(year, 1, 1, 3), kind: 'break' },
    { name: 'Valentine’s Day', day: key(year, 2, 14), kind: 'fun' },
    { name: 'Presidents’ Day', day: nthWeekday(year, 2, 1, 3), kind: 'break' },
    { name: 'Memorial Day', day: nthWeekday(year, 5, 1, -1), kind: 'break' },
    { name: 'Juneteenth', day: key(year, 6, 19), kind: 'national' },
    { name: 'Independence Day', day: key(year, 7, 4), kind: 'national' },
    { name: 'Labor Day', day: nthWeekday(year, 9, 1, 1), kind: 'break' },
    { name: 'Halloween', day: key(year, 10, 31), kind: 'fun' },
    { name: 'Veterans Day', day: key(year, 11, 11), kind: 'break' },
    { name: 'Thanksgiving', day: nthWeekday(year, 11, 4, 4), kind: 'break' },
    { name: 'Christmas', day: key(year, 12, 25), kind: 'break' },
    { name: 'New Year’s Eve', day: key(year, 12, 31), kind: 'fun' },
  ];
  if (LUNAR_NEW_YEAR[year]) list.push({ name: 'Lunar New Year', day: LUNAR_NEW_YEAR[year], kind: 'fun' });
  return list.sort((a, b) => a.day.localeCompare(b.day));
}

/** The next holidays from today on (today counts, as 0 days), looking into next year when needed. */
export function nextHolidays(today: string, count = 2): (Holiday & { days: number })[] {
  const y = +today.slice(0, 4);
  return [...holidaysOf(y), ...holidaysOf(y + 1)]
    .filter((h) => h.day >= today)
    .slice(0, count)
    .map((h) => ({ ...h, days: daysBetween(today, h.day) }));
}

/** "Today", "Tomorrow", or "12 days". */
export const daysLabel = (n: number) => (n <= 0 ? 'Today' : n === 1 ? 'Tomorrow' : `${n} days`);

export interface CountdownTile {
  id: string;
  label: string;
  /** The big part: how long. */
  days: number;
  /** What it counts down to. */
  what: string;
  /** The date, short. */
  on: string;
  href?: string;
}

const short = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });

/**
 * The tiles: next holiday, the quarter (its end, or the next start during a break), the days off after it, and the next event.
 * `term` is what the dashboard already knows; anything unknown is simply left out.
 */
export function countdownTiles(input: {
  today: string;
  term?: { name: string; endsOn: string; state: 'in' | 'break'; nextName?: string; nextStartsOn?: string } | null;
  event?: { title: string; day: string; href?: string } | null;
}): CountdownTile[] {
  const { today, term, event } = input;
  const tiles: CountdownTile[] = [];
  const [first, second] = nextHolidays(today, 2);
  if (first) tiles.push({ id: 'holiday', label: 'Next Holiday', days: first.days, what: first.name, on: short(first.day) });
  if (term && term.state === 'in') {
    tiles.push({ id: 'quarter', label: 'Quarter Ends', days: Math.max(0, daysBetween(today, term.endsOn)), what: term.name, on: short(term.endsOn) });
    if (term.nextStartsOn && term.nextStartsOn > term.endsOn)
      tiles.push({
        id: 'break',
        label: 'Break Starts',
        days: Math.max(0, daysBetween(today, term.endsOn) + 1),
        what: `Back on ${short(term.nextStartsOn)}`,
        on: short(term.endsOn),
      });
  } else if (term?.nextStartsOn) {
    tiles.push({
      id: 'next',
      label: 'Next Quarter',
      days: Math.max(0, daysBetween(today, term.nextStartsOn)),
      what: term.nextName ?? 'The next quarter starts',
      on: short(term.nextStartsOn),
    });
  }
  if (event) tiles.push({ id: 'event', label: 'Next Event', days: Math.max(0, daysBetween(today, event.day)), what: event.title, on: short(event.day), href: event.href });
  if (second) tiles.push({ id: 'holiday2', label: 'Holiday', days: second.days, what: second.name, on: short(second.day) });
  // whatever comes soonest first (a tie keeps the order above), and at most four
  return tiles.sort((x, y) => x.days - y.days).slice(0, 4);
}

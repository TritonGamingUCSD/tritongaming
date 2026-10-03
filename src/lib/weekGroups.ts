// Which week a day falls in, for the "coming up" lists: this week, next week, or two weeks out and later.
// Weeks run Sunday to Saturday in Pacific time (the same as weekly meeting plans).
const TZ = 'America/Los_Angeles';
const keyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

export const pacificKey = (d: Date | string) => keyFmt.format(typeof d === 'string' ? new Date(d) : d);
const dayNumber = (key: string) => Math.floor(new Date(`${key}T12:00:00Z`).getTime() / 86_400_000);
const shortDay = (n: number) => new Date(n * 86_400_000 + 43_200_000).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
const thisWeekStart = () => { const t = pacificKey(new Date()); return dayNumber(t) - new Date(`${t}T12:00:00Z`).getUTCDay(); };

export type WeekGroup = 0 | 1 | 2;
export function weekGroup(date: string): WeekGroup {
  const w = Math.floor((dayNumber(date) - thisWeekStart()) / 7);
  return w <= 0 ? 0 : w === 1 ? 1 : 2;
}

const span = (date: string) => { const start = thisWeekStart() + Math.max(0, Math.floor((dayNumber(date) - thisWeekStart()) / 7)) * 7; return `${shortDay(start)} – ${shortDay(start + 6)}`; };
export const WEEK_GROUPS = [
  { label: 'This week', tone: 'now', range: span },
  { label: 'Next week', tone: 'next', range: span },
  { label: 'Two weeks out and later', tone: 'later', range: (date: string) => `from ${shortDay(dayNumber(date))}` },
] as const;

/** True when `date` starts a new group (or is first), so a heading goes above it. */
export const startsWeekGroup = (dates: string[], i: number) => i === 0 || weekGroup(dates[i - 1]) !== weekGroup(dates[i]);

import type { Quarter } from '@/lib/members/quarters';
import { currentQuarter, quarterName } from '@/lib/members/quarters';

export interface TermInfoData {
  name: string;
  week: number;
  weeks: number;
  daysLeft: number;
  starts: string;
  ends: string;
  state: 'in' | 'break';
  marks: { label: string; at: string }[];
  /** The term's last day and the next quarter's name and first day (YYYY-MM-DD), when that quarter is on the calendar: for the dashboard's countdowns. */
  endsOn?: string;
  nextName?: string;
  nextStartsOn?: string;
}

const DAY = 86_400_000;
const utc = (day: string) => new Date(`${day}T00:00:00Z`).getTime();
const short = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });

/** Where the quarter is today (a Pacific day, YYYY-MM-DD): its week, how many weeks it has, the days left, and up to three coming events inside it. Pure. */
export function termInfo(quarters: Quarter[], today: string, events: { title: string; start_date: string; day: string }[] = []): TermInfoData | null {
  const q = currentQuarter(quarters, today);
  if (!q) return null;
  const weeks = Math.max(1, Math.ceil(((utc(q.ends_on) - utc(q.starts_on)) / DAY + 1) / 7));
  const inTerm = today <= q.ends_on;
  const next = quarters.filter((x) => x.starts_on > today).sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0];
  const week = inTerm ? Math.min(weeks, Math.floor((utc(today) - utc(q.starts_on)) / DAY / 7) + 1) : weeks;
  return {
    name: quarterName(q),
    week,
    weeks,
    daysLeft: inTerm ? Math.max(0, Math.round((utc(q.ends_on) - utc(today)) / DAY)) : 0,
    starts: short(q.starts_on),
    ends: short(q.ends_on),
    state: inTerm ? 'in' : 'break',
    endsOn: q.ends_on,
    nextName: next ? quarterName(next) : undefined,
    nextStartsOn: next?.starts_on,
    marks: events
      .filter((e) => e.day >= today && e.day <= q.ends_on)
      .slice(0, 3)
      .map((e) => ({ label: e.title, at: short(e.day) })),
  };
}

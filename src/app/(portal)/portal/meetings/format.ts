import { formatPacificTime } from '@/lib/core/timezone';

// A card's edge takes its week's color, the same as the heading above it (repeating is shown by its icon, not a color).
export const WEEK_TONE = ['today', 'wnext', 'wlater'] as const;

export const TZ = 'America/Los_Angeles';

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const time = (iso: string) => formatPacificTime(iso);

export const timeRange = (a: string, b: string) => `${time(a)} – ${time(b)}`;

export const dayLabel = (key: string, long = false) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: long ? 'long' : 'short', month: 'short', day: 'numeric' });

export const hhmmLabel = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
};

export const pacificHHMM = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));

// The circular code marks a code only the portal's own Scan button reads (a plain camera gets nothing from it). Same code as a ticket's.
// Where a reaction floats: the free space either side of the code, never over it (the code sits in the middle of the screen). `edge` is how far in from the side, `band` how wide.
export const sideSpot = (edge = 5, band = 19) => (Math.random() < 0.5 ? edge + Math.random() * band : 100 - edge - Math.random() * band);

// ── Exec: attendance over time, and the HR export ─────────────────────────────
export const RANGES = [
  { id: '30', label: 'Last 30 days', days: 30 },
  { id: '90', label: 'Last 90 days', days: 90 },
  { id: '365', label: 'Last year', days: 365 },
  { id: 'all', label: 'All time', days: 3650 },
] as const;

export const MARK_LABEL: Record<string, string> = { p: 'Came', a: 'Missed', e: 'Excused' };

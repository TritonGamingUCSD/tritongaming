// Triton Gaming is a UC San Diego club — every event happens in Pacific
// Time, so that's what should show up everywhere a date/time is displayed,
// regardless of where the person viewing the page actually is. Without an
// explicit `timeZone`, `toLocaleDateString`/`toLocaleTimeString` fall back
// to the *viewer's* browser timezone, which is how someone opening the site
// from Taiwan ends up seeing a San Diego event's time silently shifted by
// 15-16 hours — technically "correct" as a conversion, but meaningless (and
// misleading) for a time that's inherently tied to a physical place.
//
// A named IANA zone (not a fixed "PST"/"PDT" offset) so daylight saving is
// handled automatically — the same code shows PST in January and PDT in
// July without needing to know which one applies.
export const PACIFIC_TZ = 'America/Los_Angeles';

// Date.prototype's own getters (getFullYear, getMonth, getDate, toDateString)
// always read in the *runtime's* local timezone — there's no way to ask a
// plain Date object "what day is this in Pacific time" directly. Pulling the
// individual fields back out of an Intl.DateTimeFormat that's already been
// told to render in Pacific is the only built-in way to get a same-day/
// same-month comparison that's actually correct in Pacific terms, instead of
// whatever timezone the browser (or server process) happens to be running in.
function pacificDateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PACIFIC_TZ,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

// "Today"/"Tomorrow"/"in N days" labels need a Pacific *calendar-day*
// difference, not a raw elapsed-time one. A plain
// `Math.ceil((eventMs - Date.now()) / 86400000)` rounds any positive
// fractional day up — an event later THIS SAME Pacific day (say, 6 hours
// from now) comes out to `Math.ceil(0.25) === 1` and gets mislabeled
// "tomorrow" even though it's today. Comparing Pacific calendar dates
// (via Date.UTC on the Pacific-read date parts, so only whole days are
// ever counted) is the only way to get 0/1/2... to actually mean
// today/tomorrow/day-after in San Diego terms, regardless of what time of
// day it is right now or what timezone the server process itself runs in.
export function pacificDaysUntil(iso: string, from: Date = new Date()): number {
  const target = pacificDateParts(new Date(iso));
  const now = pacificDateParts(from);
  const targetUTC = Date.UTC(target.year, target.month - 1, target.day);
  const nowUTC = Date.UTC(now.year, now.month - 1, now.day);
  return Math.round((targetUTC - nowUTC) / 86400_000);
}

// Shared by every event card/detail view (EventCard, LongEventCard, the
// public event detail page) — was previously copy-pasted three times with
// no explicit timeZone, so the same-day/same-month comparisons it makes were
// each done in whichever timezone the viewer's browser (or the server
// process, for the server-rendered detail page) happened to be in.
export function formatEventDateRange(startISO: string, endISO?: string | null, opts?: { weekday?: boolean }): string {
  const start = new Date(startISO);
  const end = endISO ? new Date(endISO) : null;
  const weekday = opts?.weekday ? ({ weekday: 'long' as const }) : {};

  if (!end) {
    return start.toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, ...weekday, month: 'long', day: 'numeric', year: 'numeric' });
  }

  const sp = pacificDateParts(start);
  const ep = pacificDateParts(end);
  const isSameDay = sp.year === ep.year && sp.month === ep.month && sp.day === ep.day;

  if (isSameDay) {
    return start.toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, ...weekday, month: 'long', day: 'numeric', year: 'numeric' });
  }

  const sameYear = sp.year === ep.year;
  const sameMonth = sp.month === ep.month && sameYear;

  const s = start.toLocaleDateString('en-US', {
    timeZone: PACIFIC_TZ,
    month: 'long',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' as const }),
  });
  // Intl.DateTimeFormat has no clean way to render "day + year" without a
  // month — passing month: undefined doesn't just omit it, it falls back to
  // an awkward "2026 (day: 31)" format. Build the same-month case by hand,
  // from the already-Pacific-derived day/year rather than end.getDate() /
  // end.getFullYear() (which would reread it in the local runtime zone).
  const e = sameMonth
    ? `${ep.day}, ${ep.year}`
    : end.toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, month: 'long', day: 'numeric', year: 'numeric' });

  return `${s} – ${e}`;
}

export function formatEventTimeRange(startISO: string, endISO?: string | null): string {
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' });
  const start = fmt(startISO);
  if (!endISO) return start;
  return `${start} – ${fmt(endISO)}`;
}

// ── Event form <input type="datetime-local"> <-> Pacific time ──────────────
//
// This pair matters more than the display helpers above: it's not just
// showing the wrong thing, it's what the event-create/edit forms use to
// decide what UTC instant to actually *store*. `new Date(datetimeLocalStr)`
// on a string with no timezone offset (exactly what a datetime-local input
// gives you) parses it in the browser's own local timezone — so a club
// officer creating or editing an event while traveling outside Pacific time
// would have the "9:00 AM" they typed silently saved as 9:00 AM in whatever
// timezone their laptop happened to be set to, corrupting the event's real
// start time for every attendee, not just how it displays to them.

function pacificPartsOf(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PACIFIC_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  // Some engines render midnight as "24:00" when hour12 is false.
  const hour = get('hour');
  return { year: get('year'), month: get('month'), day: get('day'), hour: hour === 24 ? 0 : hour, minute: get('minute'), second: get('second') };
}

// Reads a datetime-local value ("YYYY-MM-DDTHH:mm") as Pacific wall-clock
// time and returns the UTC instant it corresponds to — regardless of the
// browser's own timezone. Standard "guess as UTC, measure the Pacific
// offset that guess actually has, correct by the difference" technique;
// converges in one pass for any date that isn't inside the literal
// DST-transition hour itself, which is more than precise enough for
// scheduling a club event.
export function pacificDatetimeLocalToUTC(datetimeLocal: string): Date {
  const wall = new Date(`${datetimeLocal}:00Z`).getTime();
  // Each pass measures the Pacific offset at the *current* UTC estimate and
  // corrects by the difference. A single pass used the offset at the naive
  // "wall time as if UTC" instant, which is on the wrong side of a daylight-
  // saving change for several hours on the two transition days (e.g. times
  // before ~9 AM on the spring-forward day came out an hour off); repeating
  // it re-measures at the corrected instant and settles. (Times that don't
  // exist — the skipped hour in March — resolve to the instant just after.)
  let utc = wall;
  for (let i = 0; i < 3; i++) {
    const p = pacificPartsOf(new Date(utc));
    const asIfUTCFromPacificReading = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    utc += wall - asIfUTCFromPacificReading;
  }
  return new Date(utc);
}

// The reverse, for populating the edit form: given a stored UTC ISO
// timestamp, produce the "YYYY-MM-DDTHH:mm" string that shows the
// corresponding Pacific wall-clock time in a datetime-local input (instead
// of whatever the server process's own runtime timezone happens to be).
export function utcToPacificDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const p = pacificPartsOf(new Date(iso));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

// ── Multi-day events ────────────────────────────────────────────────────────
// Number of Pacific calendar days an event touches (1 for same-day / no end date).
export function eventDayCount(startISO: string, endISO?: string | null): number {
  if (!endISO) return 1;
  return Math.max(1, pacificDaysUntil(endISO, new Date(startISO)) + 1);
}

// "Day 2 of 3" while a multi-day event is under way, else null.
export function eventDayProgress(startISO: string, endISO?: string | null, now: Date = new Date()): { day: number; total: number } | null {
  const total = eventDayCount(startISO, endISO);
  if (total < 2) return null;
  const day = pacificDaysUntil(now.toISOString(), new Date(startISO)) + 1; // days since start, 1-based
  return day >= 1 && day <= total ? { day, total } : null;
}

// Compact version for tables: "Oct 3, 2026" or "Oct 3 – 5, 2026" / "Oct 30 – Nov 2, 2026".
export function formatEventDateRangeShort(startISO: string, endISO?: string | null): string {
  const start = new Date(startISO);
  const fmt = (d: Date, withYear: boolean) => d.toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' as const } : {}) });
  if (!endISO || eventDayCount(startISO, endISO) < 2) return fmt(start, true);
  const end = new Date(endISO);
  const sp = pacificDateParts(start);
  const ep = pacificDateParts(end);
  if (sp.year === ep.year && sp.month === ep.month) return `${fmt(start, false)} – ${ep.day}, ${ep.year}`;
  return `${fmt(start, sp.year !== ep.year)} – ${fmt(end, true)}`;
}

// "Fri, Oct 24, 6:00 PM" — built from parts instead of one toLocale…String call with date AND time
// fields, because engines disagree on the glue ("Oct 24 at 6:00 PM" vs "Oct 24, 6:00 PM", and a
// narrow no-break space before PM). That disagreement made server-rendered text differ from what
// Safari produced on the client, which React reports as a hydration error.
export function formatPacificDateTime(iso: string | Date, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PACIFIC_TZ,
    weekday: opts.weekday ? 'short' : undefined,
    month: 'short', day: 'numeric',
    year: opts.year ? 'numeric' : undefined,
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).formatToParts(typeof iso === 'string' ? new Date(iso) : iso);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const date = `${opts.weekday ? `${g('weekday')}, ` : ''}${g('month')} ${g('day')}${opts.year ? `, ${g('year')}` : ''}`;
  return `${date}, ${g('hour')}:${g('minute')} ${g('dayPeriod').toUpperCase()}`;
}

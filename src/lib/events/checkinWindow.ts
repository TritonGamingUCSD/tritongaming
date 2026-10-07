// Shared by performCheckin.ts (server-side enforcement) and TicketsClient
// (client-side display) so "is this ticket still checkin-able" reads the
// same on both sides — the UI shouldn't invite someone to view/scan a QR
// code the server is going to reject anyway. Falls back to start_date + a
// same-day grace window when an event has no explicit end_date set (most
// of ours don't) — using start_date itself as the deadline would close the
// window the instant the event starts, when in practice check-in happens
// *during* it.
const CHECKIN_GRACE_MS = 24 * 60 * 60 * 1000;

export function isCheckinWindowOpen(event: { start_date: string; end_date?: string | null }): boolean {
  const deadline = event.end_date
    ? new Date(event.end_date).getTime()
    : new Date(event.start_date).getTime() + CHECKIN_GRACE_MS;
  return Date.now() <= deadline;
}

// Per-day check-in hours for a multi-day event (Pacific time). A day without an entry is open all day.
export interface CheckinDayWindow { day: string; start: string; end: string }

const to12h = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const pacificParts = (d: Date) => {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const get = (t: string) => f.find((p) => p.type === t)!.value;
  return { day: `${get('year')}-${get('month')}-${get('day')}`, hhmm: `${get('hour')}:${get('minute')}` };
};

// null when check-in is allowed right now; otherwise what to tell the person. Only restricts days that
// have hours set (so single-day events and untouched days behave exactly as before).
export function checkinHoursError(event: { checkin_windows?: CheckinDayWindow[] | null }, now: Date = new Date()): string | null {
  const { day, hhmm } = pacificParts(now);
  const w = (event.checkin_windows ?? []).find((x) => x.day === day);
  if (!w) return null;
  if (hhmm < w.start) return `Check-in for today opens at ${to12h(w.start)}.`;
  if (hhmm > w.end) return `Check-in for today closed at ${to12h(w.end)}.`;
  return null;
}

// Query-side twins of isCheckinWindowOpen, for PostgREST `.or()` filters — so
// "which events are still open" (upcoming lists, ticket sign-up) is decided
// by the exact same rule as check-in itself: an event with an end time stays
// open until then; one without stays open for the same-day grace after its
// start. Previously these lists cut off at the event's *start*, which hid an
// event (and its Get Ticket button) the moment it began, mid-event.
export function openEventsFilter(nowMs: number = Date.now()): string {
  const now = new Date(nowMs).toISOString();
  const noEndCutoff = new Date(nowMs - CHECKIN_GRACE_MS).toISOString();
  return `end_date.gte.${now},and(end_date.is.null,start_date.gte.${noEndCutoff})`;
}

export function endedEventsFilter(nowMs: number = Date.now()): string {
  const now = new Date(nowMs).toISOString();
  const noEndCutoff = new Date(nowMs - CHECKIN_GRACE_MS).toISOString();
  return `end_date.lt.${now},and(end_date.is.null,start_date.lt.${noEndCutoff})`;
}

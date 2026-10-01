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

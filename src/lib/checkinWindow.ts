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

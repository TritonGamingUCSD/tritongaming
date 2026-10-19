// One way in for everything a person can check in with. The portal's scanner and its code box both end up here, and what comes back says plainly what was done:
//   • six typed digits: a meeting's code first, then (for staff) a ticket for an event that can still be checked into
//   • a TGcode read by the scanner (`tg:` and `m…`, `t…` or `r…` with 8 (or, in the first format, 12) hex digits):
//       meeting (`m`) checks the person in to that meeting · ticket (`t`) checks that ticket in (staff) · reward pickup (`r`) looks the reward up so staff can confirm it
// Which of these a person may do is decided by the server; this only asks, in order, and reports.

export type Outcome =
  | { kind: 'meeting'; title: string; at: string; already: boolean }
  | { kind: 'ticket'; status: string; userName: string; eventTitle: string; at?: string; selfCheckin?: boolean; dayNumber?: number | null; dayTotal?: number | null; laterDay?: boolean; requiresForm?: boolean; formCompleted?: boolean; points?: number; lifetime?: number; tier?: string }
  | { kind: 'reward'; id: string; status: string; title: string; member: string; cost: number }
  | { kind: 'rewardDone'; title: string; member: string }
  /** The six digits are valid for both a meeting and a ticket at once (a one-in-a-million coincidence): the person picks which one is meant. */
  | { kind: 'choose'; code: string; meeting: string; ticket: string }
  | { kind: 'error'; message: string };

export const TGCODE = /^tg:([mtr])([0-9a-f]{8}|[0-9a-f]{12})$/;   // the key is 8 hex digits in a code of the current format, 12 in the first one

// A request that never answers (a very bad connection) must not leave the screen waiting for ever: after 20 s it gives up and the person is told, with a way to try again.
const TIMEOUT_MS = 20_000;
async function withTimeout(run: (signal: AbortSignal) => Promise<Response>): Promise<Response> {
  const ctl = new AbortController();
  const id = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try { return await run(ctl.signal); } finally { clearTimeout(id); }
}

async function post(path: string, body: object) {
  const res = await withTimeout((signal) => fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal }));
  const json = await res.json().catch(() => ({}));
  if (!res.ok && !json.error) json.error = whyNot(res.status);
  return { ok: res.ok, status: res.status, json };
}

// When the server answered without a reason (a signed-out session, a busy server), still say something the person can act on.
const whyNot = (status: number) => status === 401 ? 'You’ve been signed out. Sign in again, then scan.' : status === 429 ? 'Too many tries. Wait a moment, then scan again.' : status >= 500 ? 'The server had a problem. Try again in a moment.' : 'Check-in failed.';

function ticketOutcome(j: Record<string, unknown>): Outcome {
  return {
    kind: 'ticket', status: String(j.status ?? 'active'), userName: String(j.user_name ?? 'Unknown'), eventTitle: String(j.event_title ?? ''),
    at: j.checked_in_at as string | undefined, selfCheckin: !!j.self_checkin, dayNumber: j.day_number as number | null | undefined, dayTotal: j.day_total as number | null | undefined,
    laterDay: !!j.later_day, requiresForm: !!j.requires_form, formCompleted: !!j.form_completed, points: j.points_awarded as number | undefined,
    lifetime: j.lifetime_points as number | undefined, tier: j.tier as string | undefined,
  };
}

/** Six typed digits: a meeting code, or a ticket's code. Both are asked first without changing anything, so a code that fits both is never guessed at. */
export async function checkInWithCode(code: string): Promise<Outcome> {
  try {
    const [m, t] = await Promise.all([post('/api/meetings/check-in', { code, preview: true }), post('/api/tickets/checkin', { code, preview: true })]);
    const isMeeting = m.ok, isTicket = t.ok && t.json.preview;
    if (isMeeting && isTicket) return { kind: 'choose', code, meeting: m.json.title, ticket: `${t.json.user_name}${t.json.event_title ? ` · ${t.json.event_title}` : ''}` };
    if (isMeeting) return await resolveChoice(code, 'meeting');
    if (isTicket) return await resolveChoice(code, 'ticket');
    // Neither: say why. A meeting that is not open yet, or one the person may not join, is the more useful answer; someone who may not scan tickets gets a 403 here.
    if (m.status === 409 || m.status === 403) return { kind: 'error', message: m.json.error };
    if (t.status === 404 || t.status === 403) return { kind: 'error', message: 'That code isn’t a meeting or ticket code right now. Check the screen for the current one.' };
    return { kind: 'error', message: t.json.error || m.json.error || 'Check-in failed.' };
  } catch { return { kind: 'error', message: 'No connection, or it is taking too long. Check your connection and try again.' }; }
}

/** Does the check-in for the kind of code the person (or the lookup) settled on. */
export async function resolveChoice(code: string, which: 'meeting' | 'ticket'): Promise<Outcome> {
  try {
    if (which === 'meeting') {
      const m = await post('/api/meetings/check-in', { code });
      return m.ok ? { kind: 'meeting', title: m.json.title, at: m.json.checked_in_at, already: !!m.json.already } : { kind: 'error', message: m.json.error || 'Check-in failed.' };
    }
    const t = await post('/api/tickets/checkin', { code });
    return t.ok ? ticketOutcome(t.json) : { kind: 'error', message: t.json.error || 'Check-in failed.' };
  } catch { return { kind: 'error', message: 'No connection, or it is taking too long. Check your connection and try again.' }; }
}

/** What a scan means, for the QRs that are made by the portal. null = not one of these. */
export async function checkInWithQr(text: string, can: { tickets: boolean; rewards: boolean }): Promise<Outcome | null> {
  const t = text.trim();
  try {
    const ring = t.match(TGCODE);
    if (ring && ring[1] === 'm') {
      const r = await post('/api/meetings/check-in', { qr_token: ring[2] });
      return r.ok ? { kind: 'meeting', title: r.json.title, at: r.json.checked_in_at, already: !!r.json.already } : { kind: 'error', message: r.json.error || 'Check-in failed.' };
    }
    if (ring && ring[1] === 't') {
      if (!can.tickets) return { kind: 'error', message: 'That is an event ticket. Show it to an officer, who scans it to check you in.' };
      const r = await post('/api/tickets/checkin', { qr_token: ring[2] });
      return r.ok ? ticketOutcome(r.json) : { kind: 'error', message: r.json.error || 'Check-in failed.' };
    }
    if (ring && ring[1] === 'r') {
      if (!can.rewards) return { kind: 'error', message: can.tickets ? 'That is a reward pickup code, and your role can’t confirm hand-overs. Ask an officer who can.' : 'That is a reward pickup code. Show it to an officer to collect your reward.' };
      const res = await withTimeout((signal) => fetch(`/api/rewards/redemptions/lookup?p=${ring[2]}`, { signal }));
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return { kind: 'error', message: j.error || (res.status === 404 ? 'Reward not found.' : whyNot(res.status)) };
      const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
      const d = j.redemption;
      return { kind: 'reward', id: d.id, status: d.status, title: one<{ title: string }>(d.reward)?.title ?? 'Reward', member: one<{ display_name: string | null }>(d.member)?.display_name ?? 'Member', cost: d.point_cost };
    }
  } catch { return { kind: 'error', message: 'No connection, or it is taking too long. Check your connection and try again.' }; }
  return null;
}

export async function confirmReward(id: string, title: string, member: string): Promise<Outcome> {
  try {
    const r = await post(`/api/rewards/redemptions/${id}/confirm`, {});
    return r.ok ? { kind: 'rewardDone', title, member } : { kind: 'error', message: r.json.error || 'Failed to confirm.' };
  } catch { return { kind: 'error', message: 'No connection, or it is taking too long. Check your connection and try again.' }; }
}

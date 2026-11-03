// One way in for everything a person can check in with. The portal's scanner and its code box both end up here, and what comes back says plainly what was done:
//   • six typed digits: a meeting's code, (for staff) a ticket for an event that can still be checked into, a Trivia game's join code (which joins that game) or a poll's: all asked at the same time
//   • a TGcode read by the scanner (`tg:` and `m…`, `t…` or `r…` with 8 (or, in the first format, 12; in a Bytecode, 7) hex digits):
//       meeting (`m`) checks the person in to that meeting · ticket (`t`) checks that ticket in (staff) · reward pickup (`r`) looks the reward up so staff can confirm it
// Which of these a person may do is decided by the server; this only asks, in order, and reports.

export type Outcome =
  | { kind: 'meeting'; title: string; at: string; already: boolean }
  | {
      kind: 'ticket';
      status: string;
      userName: string;
      eventTitle: string;
      at?: string;
      selfCheckin?: boolean;
      dayNumber?: number | null;
      dayTotal?: number | null;
      laterDay?: boolean;
      requiresForm?: boolean;
      formCompleted?: boolean;
      points?: number;
      lifetime?: number;
      tier?: string;
    }
  | { kind: 'reward'; id: string; status: string; title: string; member: string; cost: number }
  | { kind: 'rewardDone'; title: string; member: string }
  /** The six digits were an online event's check-in code: the person is checked in to it. */
  | { kind: 'online'; eventTitle: string }
  /** The six digits were a Trivia game's join code: the person has joined it and the screen opens the game. */
  | { kind: 'trivia'; code: string }
  /** The six digits were a poll's code: the screen opens the poll's voting page. */
  | { kind: 'poll'; code: string }
  /** A ticket for an event that is not the one on right now: staff are asked before the person is checked in. `redo` is what to send again to go ahead. */
  | { kind: 'confirmEvent'; userName: string; eventTitle: string; nowEvent: string; redo: { code?: string; qr_token?: string } }
  /** Not a mistake, just not for this person (a ticket or a reward pickup opened by someone who is not staff): said calmly, with no error look and nothing to try again. */
  | { kind: 'info'; title: string; message: string }
  | { kind: 'error'; message: string };

export const TGCODE = /^tg:([mtr])([0-9a-f]{7,8}|[0-9a-f]{12})$/; // the key is 8 hex digits in a TGcode of the current format, 12 in the first one, and 7 in a Bytecode

// A request that never answers (a very bad connection) must not leave the screen waiting for ever: after 8 s it gives up (and, for a check-in, tries once more) and the person is told, with a way to try again.
const TIMEOUT_MS = 8_000;
async function withTimeout(run: (signal: AbortSignal) => Promise<Response>): Promise<Response> {
  const ctl = new AbortController();
  const id = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await run(ctl.signal);
  } finally {
    clearTimeout(id);
  }
}

// No signal at all: say so at once instead of waiting for a timeout.
const OFFLINE = new Error('offline');
const assertOnline = () => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw OFFLINE;
};

// A check-in is safe to send again (the server only ever checks a ticket in once, and a second answer is "already checked in"), so a request lost to a weak signal is tried once more before giving up.
async function post(path: string, body: object) {
  assertOnline();
  let res: Response;
  try {
    res = await withTimeout((signal) => fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal }));
  } catch {
    assertOnline();
    res = await withTimeout((signal) => fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal }));
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok && !json.error) json.error = whyNot(res.status);
  return { ok: res.ok, status: res.status, json };
}

// When the server answered without a reason (a signed-out session, a busy server), still say something the person can act on.
const whyNot = (status: number) =>
  status === 401
    ? 'You’ve been signed out. Sign in again, then scan.'
    : status === 429
      ? 'Too many tries. Wait a moment, then scan again.'
      : status >= 500
        ? 'The server had a problem. Try again in a moment.'
        : 'Check-in failed.';

const wrongEvent = (j: Record<string, unknown>, redo: { code?: string; qr_token?: string }): Outcome => ({
  kind: 'confirmEvent',
  userName: String(j.user_name ?? 'Unknown'),
  eventTitle: String(j.event_title ?? ''),
  nowEvent: String(j.now_event ?? ''),
  redo,
});

function ticketOutcome(j: Record<string, unknown>): Outcome {
  return {
    kind: 'ticket',
    status: String(j.status ?? 'active'),
    userName: String(j.user_name ?? 'Unknown'),
    eventTitle: String(j.event_title ?? ''),
    at: j.checked_in_at as string | undefined,
    selfCheckin: !!j.self_checkin,
    dayNumber: j.day_number as number | null | undefined,
    dayTotal: j.day_total as number | null | undefined,
    laterDay: !!j.later_day,
    requiresForm: !!j.requires_form,
    formCompleted: !!j.form_completed,
    points: j.points_awarded as number | undefined,
    lifetime: j.lifetime_points as number | undefined,
    tier: j.tier as string | undefined,
  };
}

/** Six typed digits: a meeting's code, an online event's, a ticket's, a reward pickup's, a Trivia game's or a poll's. Everything is asked at once (one round trip, not one after another), so the answer comes back as fast as the slowest single question:
 *  • a meeting's code, or an online event's check-in code, checks the person in at once (a typed code like that is only ever meant for them)
 *  • a ticket is only asked about first ("preview": which person and event), because many tickets exist and a six-digit number can be a ticket's by chance; staff then confirm it in a second step
 *  • a reward pickup's short code (staff only) shows the pickup to confirm; a Trivia game's code joins that game, a poll's (or Q&A's) code opens it */
export async function checkInWithCode(code: string): Promise<Outcome> {
  try {
    const [m, online, t, game, poll, reward] = await Promise.all([
      post('/api/meetings/check-in', { code }),
      post('/api/checkin/online/by-code', { code }),
      post('/api/tickets/checkin', { code, preview: true }),
      post('/api/trivia/join', { code }),
      post('/api/polls/join', { code }),
      get(`/api/rewards/redemptions/lookup?c=${code}`),
    ]);
    if (m.ok) return { kind: 'meeting', title: m.json.title, at: m.json.checked_in_at, already: !!m.json.already };
    if (online.ok) return { kind: 'online', eventTitle: String(online.json.event_title ?? 'the event') };
    if (online.status === 409 || online.status >= 500) return { kind: 'error', message: online.json.error }; // (it was an online event's code, but the check-in itself was refused)
    return { kind: 'error', message: online.json.error };
    if (t.ok && t.json.preview) return await checkInTicketCode(code);
    // Not a meeting, an online event or a ticket: a Trivia game with that code is joined, and a poll with that code is opened. (A 403 from the meeting side is not an answer: meetings and tickets are for staff, so every ordinary member gets one for any code.)
    if (game.ok) return { kind: 'trivia', code };
    if (game.status === 403 || game.status === 409) return { kind: 'error', message: game.json.error };
    if (poll.ok) return { kind: 'poll', code };
    if (poll.status === 409) return { kind: 'error', message: poll.json.error };
    if (reward.ok && reward.json.redemption) return rewardOutcome(reward.json.redemption);
    if (reward.status === 409) return { kind: 'error', message: reward.json.error };
    // None of them: say why, as plainly as it can be said. A meeting that is not open yet is the most useful answer when one is expected; a Trivia game or poll that has ended says so.
    if (m.status === 409) return { kind: 'error', message: `${m.json.error} If you meant a Trivia game or a poll, check its code on the screen.` };
    const hints = [
      'Meeting codes change every 30 seconds and online-event codes every few minutes, so check the screen for the current one.',
      'Trivia, poll and Q&A codes only work while the game or vote is on.',
    ];
    if (t.status === 404 || t.status === 403)
      return { kind: 'error', message: `That code didn’t match a meeting, an online event, a ticket, a Trivia game or a poll. ${hints.join(' ')}` };
    return { kind: 'error', message: t.json.error || m.json.error || 'The check-in failed. Try the code again.' };
  } catch {
    return { kind: 'error', message: 'No connection, or it is taking too long. Check the signal and try again (if it did go through, it will say you’re already checked in).' };
  }
}

/** Checks a ticket in by its typed code (after it was asked about and found to be a ticket's). */
async function checkInTicketCode(code: string): Promise<Outcome> {
  try {
    const t = await post('/api/tickets/checkin', { code });
    if (t.status === 409 && t.json.code === 'confirm_event') return wrongEvent(t.json, { code });
    return t.ok ? ticketOutcome(t.json) : { kind: 'error', message: t.json.error || 'Check-in failed.' };
  } catch {
    return { kind: 'error', message: 'No connection, or it is taking too long. Check the signal and scan again (if it did go through, it will say already checked in).' };
  }
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
      if (!can.tickets) return { kind: 'info', title: 'This is an event ticket', message: 'Show it to an officer, who scans it to check you in.' };
      const r = await post('/api/tickets/checkin', { qr_token: ring[2] });
      if (r.status === 409 && r.json.code === 'confirm_event') return wrongEvent(r.json, { qr_token: ring[2] });
      return r.ok ? ticketOutcome(r.json) : { kind: 'error', message: r.json.error || 'Check-in failed.' };
    }
    if (ring && ring[1] === 'r') {
      if (!can.rewards)
        return can.tickets
          ? { kind: 'error', message: 'That is a reward pickup code, and your role can’t confirm hand-overs. Ask an officer who can.' }
          : { kind: 'info', title: 'This is a reward pickup code', message: 'Show it to an officer to collect your reward.' };
      const res = await withTimeout((signal) => fetch(`/api/rewards/redemptions/lookup?p=${ring[2]}`, { signal }));
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return { kind: 'error', message: j.error || (res.status === 404 ? 'Reward not found.' : whyNot(res.status)) };
      return rewardOutcome(j.redemption);
    }
  } catch {
    return { kind: 'error', message: 'No connection, or it is taking too long. Check the signal and scan again (if it did go through, it will say already checked in).' };
  }
  return null;
}

const one = <T>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
/** A reward pickup as staff see it (from the lookup's answer), ready to be confirmed. */
function rewardOutcome(d: { id: string; status: string; point_cost: number; reward: unknown; member: unknown }): Outcome {
  return {
    kind: 'reward',
    id: d.id,
    status: d.status,
    title: one<{ title: string }>(d.reward as { title: string } | { title: string }[] | null)?.title ?? 'Reward',
    member: one<{ display_name: string | null }>(d.member as { display_name: string | null } | { display_name: string | null }[] | null)?.display_name ?? 'Member',
    cost: d.point_cost,
  };
}

/** A GET with the same patience as `post` (the reward lookup). */
async function get(path: string) {
  assertOnline();
  const res = await withTimeout((signal) => fetch(path, { signal, cache: 'no-store' }));
  const json = await res.json().catch(() => ({}));
  if (!res.ok && !json.error) json.error = whyNot(res.status);
  return { ok: res.ok, status: res.status, json };
}

export async function confirmReward(id: string, title: string, member: string): Promise<Outcome> {
  try {
    const r = await post(`/api/rewards/redemptions/${id}/confirm`, {});
    return r.ok ? { kind: 'rewardDone', title, member } : { kind: 'error', message: r.json.error || 'Failed to confirm.' };
  } catch {
    return { kind: 'error', message: 'No connection, or it is taking too long. Check the signal and scan again (if it did go through, it will say already checked in).' };
  }
}

/** Staff saw the wrong-event warning and chose to check the person in anyway. */
export async function confirmEventCheckIn(redo: { code?: string; qr_token?: string }): Promise<Outcome> {
  try {
    const t = await post('/api/tickets/checkin', { ...redo, confirm_event: true });
    return t.ok ? ticketOutcome(t.json) : { kind: 'error', message: t.json.error || 'Check-in failed.' };
  } catch {
    return { kind: 'error', message: 'No connection, or it is taking too long. Check the signal and scan again (if it did go through, it will say already checked in).' };
  }
}

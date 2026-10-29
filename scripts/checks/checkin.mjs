// Drives the check-in flow as temporary accounts against a running dev server, and removes everything it made. Run: npm run test:checkin
// Covers the officer scanner (right code, repeat scan, two scans at once, wrong event, bad code, a closed event), points awarded once, member self
// check-in for an online event, the manual check-in and undoing a check-in.
import { createHmac } from 'node:crypto';
import { svc, tracker, accounts } from './lib.mjs';

const t = tracker();
const ok = t.ok;
const { user, made, cleanup } = accounts('checkin');
const eventIds = [];
const code = (secret, windowIndex) => (BigInt(`0x${createHmac('sha256', secret).update(String(windowIndex)).digest('hex').slice(0, 12)}`) % 1000000n).toString().padStart(6, '0');
const win = () => Math.floor(Date.now() / 1000 / 30);
const hours = (n) => new Date(Date.now() + n * 3600e3).toISOString();
async function event(title, over = {}) {
  const { data } = await svc
    .from('events')
    .insert({
      title,
      slug: `zz-checkin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      start_date: hours(-1),
      end_date: hours(2),
      points_value: 5,
      is_published: true,
      ...over,
    })
    .select('id, checkin_secret')
    .single();
  eventIds.push(data.id);
  return data;
}
async function ticket(userId, eventId) {
  const { data } = await svc.from('tickets').insert({ event_id: eventId, user_id: userId }).select('id, ticket_code').single();
  return data;
}
const points = async (userId) => (await svc.from('point_transactions').select('amount, reversed_at').eq('user_id', userId).eq('type', 'event_checkin')).data ?? [];
try {
  const staff = await user('staff', ['officer']),
    exec = await user('exec', ['exec']);
  const A = await user('a', ['ucsd']),
    B = await user('b', ['ucsd']),
    C = await user('c', ['ucsd']),
    D = await user('d', ['ucsd']);
  const ev = await event('ZZ Checkin Event'),
    other = await event('ZZ Checkin Other'),
    over = await event('ZZ Checkin Ended', { start_date: hours(-72), end_date: hours(-48) });
  const ta = await ticket(A.id, ev.id),
    tb = await ticket(B.id, ev.id),
    tc = await ticket(C.id, other.id),
    td = await ticket(D.id, over.id);
  let r;

  r = await A.call('POST', '/api/tickets/checkin', { code: code(ta.ticket_code, win()), event_id: ev.id });
  ok('a member cannot scan', r.s === 403, r.s);
  r = await staff.call('POST', '/api/tickets/checkin', { code: '000000', event_id: ev.id });
  ok('a bad code is not recognized', r.s === 404, JSON.stringify(r));
  r = await staff.call('POST', '/api/tickets/checkin', { code: code(tc.ticket_code, win()), event_id: ev.id });
  ok('a ticket for another open event says so', r.s === 409 && /different event/.test(r.j.error), JSON.stringify(r));
  r = await staff.call('POST', '/api/tickets/checkin', { code: `slug:${code(ta.ticket_code, win())}`, event_id: ev.id });
  ok('the right code checks them in (slug prefix ignored)', r.s === 200 && r.j.points_awarded === 5 && r.j.status === 'active', JSON.stringify(r));
  r = await staff.call('POST', '/api/tickets/checkin', { code: code(ta.ticket_code, win()), event_id: ev.id });
  ok('scanning again reports already checked in, no points', r.s === 200 && r.j.status === 'used' && !r.j.points_awarded, JSON.stringify(r));
  ok('points were awarded exactly once', (await points(A.id)).length === 1);
  // Two scanners at the same moment
  const both = await Promise.all([0, 1].map(() => staff.call('POST', '/api/tickets/checkin', { code: code(tb.ticket_code, win()), event_id: ev.id })));
  ok(
    'two scans at once: one check-in, no double points',
    (await points(B.id)).length === 1 && both.filter((x) => x.s === 200 && x.j.points_awarded === 5).length === 1,
    JSON.stringify(both),
  );
  r = await staff.call('POST', '/api/tickets/checkin', { code: code(td.ticket_code, win()), event_id: over.id });
  ok('an ended event rejects the scan', r.s === 409 && /ended/.test(r.j.error), JSON.stringify(r));
  // Manual check-in and undo
  const tm = await ticket((await user('e', ['ucsd'])).id, ev.id);
  r = await staff.call('POST', '/api/checkin/manual', { ticket_id: tm.id });
  ok('an officer cannot check in by hand', r.s === 403, r.s);
  r = await exec.call('POST', '/api/checkin/manual', { ticket_id: tm.id });
  ok('exec checks someone in by hand', r.s === 200, JSON.stringify(r));
  r = await exec.call('POST', '/api/checkin/manual', { ticket_id: tm.id });
  ok('doing it twice is refused', r.s === 409, JSON.stringify(r));
  r = await staff.call('POST', '/api/checkin/reverse', { ticket_id: ta.id });
  ok('an officer cannot undo a check-in', r.s === 403, r.s);
  r = await exec.call('POST', '/api/checkin/reverse', { ticket_id: ta.id });
  ok('exec undoes a check-in', r.s === 200, JSON.stringify(r));
  ok(
    'undoing reverses the points',
    (await points(A.id)).every((p) => p.reversed_at),
  );
  r = await staff.call('POST', '/api/tickets/checkin', { code: code(ta.ticket_code, win()), event_id: ev.id });
  ok('after an undo they can be scanned again', r.s === 200 && r.j.points_awarded === 5, JSON.stringify(r));
  // Online self check-in
  const online = await event('ZZ Checkin Online');
  const ton = await ticket(C.id, online.id);
  const ewin = Math.floor(Date.now() / 1000 / 300);
  r = await D.call('POST', '/api/checkin/online', { event_id: online.id, code: code(online.checkin_secret, ewin) });
  ok('online: no ticket, no check-in', r.s === 403, JSON.stringify(r));
  r = await C.call('POST', '/api/checkin/online', { event_id: online.id, code: '123456' });
  ok('online: a wrong code is refused', r.s === 400, JSON.stringify(r));
  r = await C.call('POST', '/api/checkin/online', { event_id: online.id, code: code(online.checkin_secret, ewin) });
  ok('online: the right code checks the ticket holder in', r.s === 200, JSON.stringify(r));
  r = await C.call('POST', '/api/checkin/online', { event_id: online.id, code: code(online.checkin_secret, ewin) });
  ok('online: a second try says already checked in', r.s === 409, JSON.stringify(r));
  ok('online: points once', (await points(C.id)).filter((p) => !p.reversed_at).length === 1);
  // The portal's one scanner (no event chosen): a ticket for an event that is not on right now is only checked in after staff confirm
  const later = await event('ZZ Checkin Later', { start_date: hours(48), end_date: hours(52) });
  const F = await user('f', ['ucsd']),
    G = await user('g', ['ucsd']);
  const tf = await ticket(F.id, later.id),
    tg = await ticket(G.id, ev.id);
  r = await staff.call('POST', '/api/tickets/checkin', { code: code(tf.ticket_code, win()), preview: true });
  ok('wrong event: the preview just says whose ticket it is', r.s === 200 && r.j.preview === true, JSON.stringify(r));
  r = await staff.call('POST', '/api/tickets/checkin', { code: code(tf.ticket_code, win()) });
  ok(
    'wrong event: a ticket for an event that is not on now asks first, nothing is checked in',
    r.s === 409 && r.j.code === 'confirm_event' && /Later/.test(r.j.event_title) && r.j.now_event.length > 0,
    JSON.stringify(r),
  );
  ok('wrong event: the ticket is still unused', (await svc.from('tickets').select('status').eq('id', tf.id).single()).data.status === 'active');
  r = await staff.call('POST', '/api/tickets/checkin', { code: code(tf.ticket_code, win()), confirm_event: true });
  ok('wrong event: confirming checks them in (points awarded)', r.s === 200 && r.j.points_awarded === 5, JSON.stringify(r));
  r = await staff.call('POST', '/api/tickets/checkin', { code: code(tg.ticket_code, win()) });
  ok('a ticket for the event that is on now is checked in with no question', r.s === 200 && r.j.points_awarded === 5, JSON.stringify(r));
  void ton;
} finally {
  for (const id of eventIds) {
    await svc.from('ticket_checkins').delete().eq('event_id', id);
    await svc.from('point_transactions').delete().eq('event_id', id);
    await svc.from('tickets').delete().eq('event_id', id);
    await svc.from('events').delete().eq('id', id);
  }
  await svc.from('audit_log').delete().eq('entity_type', 'check-in').in('actor_id', made);
  await cleanup();
}
process.exit(t.result());

// Drives self check-in (api/checkin/self) as temporary accounts against a running dev server and removes everything it made. Run: npm run test:selfcheckin
// Covers: off by default, who may switch it on, a student with no ticket, a repeat tap, an incomplete profile, a priced event, an ended event, a ucsd-only event,
// a staff scan of someone who already checked themselves in, and that the staff scanner still works for an event with self check-in off.
import { createHmac } from 'node:crypto';
import { svc, tracker, accounts } from './lib.mjs';

const t = tracker();
const ok = t.ok;
const { user, made, cleanup } = accounts('selfin');
const eventIds = [];
const code = (secret, windowIndex) => (BigInt(`0x${createHmac('sha256', secret).update(String(windowIndex)).digest('hex').slice(0, 12)}`) % 1000000n).toString().padStart(6, '0');
const win = () => Math.floor(Date.now() / 1000 / 30);
const hours = (n) => new Date(Date.now() + n * 3600e3).toISOString();
async function event(title, over = {}) {
  const { data, error } = await svc
    .from('events')
    .insert({
      title,
      slug: `zz-selfin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      start_date: hours(-1),
      end_date: hours(2),
      points_value: 5,
      is_published: true,
      ...over,
    })
    .select('id')
    .single();
  if (error) throw error;
  eventIds.push(data.id);
  return data;
}
const tickets = async (userId, eventId) =>
  (await svc.from('tickets').select('id, status, ticket_code, source, checked_in_by').eq('user_id', userId).eq('event_id', eventId)).data ?? [];
const points = async (userId) => (await svc.from('point_transactions').select('amount, reversed_at').eq('user_id', userId).eq('type', 'event_checkin')).data ?? [];
try {
  const exec = await user('exec', ['exec']),
    member = await user('member', ['ucsd']);
  const student = await user('student', ['ucsd']);
  const guest = await user('guest', [], { profile: { year: null, college: null, major: null } });
  for (const u of [student, member]) await svc.from('profile_private').upsert({ user_id: u.id, gender: 'Prefer not to say' });
  const ev = await event('ZZ Self Event');
  let r;

  const { data: fresh } = await svc.from('events').select('self_checkin_mode').eq('id', ev.id).single();
  ok('a new event starts with self check-in off', fresh?.self_checkin_mode === 'off');

  r = await student.call('POST', '/api/checkin/self', { event_id: ev.id });
  ok('off: self check-in is refused', r.s === 403 && r.j.code === 'closed', JSON.stringify(r));
  ok('off: no ticket was made', (await tickets(student.id, ev.id)).length === 0);

  const officer = await user('officer', ['officer']);
  const other = await user('other', ['ucsd']);
  await svc.from('profile_private').upsert({ user_id: other.id, gender: 'Other' });
  r = await member.call('PATCH', `/api/events/${ev.id}/self-checkin`, { mode: 'until_end' });
  ok('a member cannot change it', r.s === 403, JSON.stringify(r));
  r = await officer.call('PATCH', `/api/events/${ev.id}/self-checkin`, { mode: 'until_end' });
  ok('an officer cannot change it either', r.s === 403, JSON.stringify(r));
  r = await exec.call('PATCH', `/api/events/${ev.id}/self-checkin`, { mode: 'sometimes' });
  ok('a bad mode is refused', r.s === 400, JSON.stringify(r));
  r = await exec.call('PATCH', `/api/events/${ev.id}/self-checkin`, { mode: 'until_end' });
  ok('exec turns it on until the event ends', r.s === 200, JSON.stringify(r));

  r = await student.call('POST', '/api/checkin/self', { event_id: ev.id });
  ok('on: a student with no ticket is checked in', r.s === 200 && r.j.status === 'checked_in', JSON.stringify(r));
  const [st] = await tickets(student.id, ev.id);
  ok('a free ticket was made, used, and marked as self check-in', st?.status === 'used' && st.source === 'self_checkin' && st.checked_in_by === student.id, JSON.stringify(st));
  ok('points were awarded once', (await points(student.id)).length === 1);
  r = await student.call('POST', '/api/checkin/self', { event_id: ev.id });
  ok('a second tap says already checked in', r.s === 200 && r.j.status === 'already', JSON.stringify(r));
  ok('still one ticket and one award', (await tickets(student.id, ev.id)).length === 1 && (await points(student.id)).length === 1);
  const both = await Promise.all([1, 2].map(() => member.call('POST', '/api/checkin/self', { event_id: ev.id })));
  ok(
    'two taps at once: one ticket, one award',
    (await tickets(member.id, ev.id)).length === 1 && (await points(member.id)).length === 1 && both.every((x) => x.s === 200),
    JSON.stringify(both),
  );

  // Staff scan of someone who is already in
  r = await exec.call('POST', '/api/tickets/checkin', { code: code(st.ticket_code, win()), event_id: ev.id });
  ok('staff scan shows already in, marked self check-in', r.s === 200 && r.j.status === 'used' && r.j.self_checkin === true, JSON.stringify(r));

  r = await guest.call('POST', '/api/checkin/self', { event_id: ev.id });
  ok('an incomplete profile must be finished first', r.s === 400 && r.j.code === 'needs_profile', JSON.stringify(r));
  ok('and no ticket was made for them', (await tickets(guest.id, ev.id)).length === 0);

  const paid = await event('ZZ Self Paid', { ticket_price: 5, self_checkin_mode: 'until_end', audience: 'public' });
  await svc.from('profiles').update({ display_name: 'ZZ Mtg guest', pronouns: 'they/them' }).eq('id', guest.id);
  await svc.from('profile_private').upsert({ user_id: guest.id, gender: 'Other' });
  r = await guest.call('POST', '/api/checkin/self', { event_id: paid.id });
  ok('a priced event sends a guest to get a ticket first', r.s === 402 && r.j.code === 'needs_payment', JSON.stringify(r));
  ok('and no ticket was made', (await tickets(guest.id, paid.id)).length === 0);
  r = await guest.call('POST', '/api/checkin/self', { event_id: ev.id });
  ok('a guest with a finished profile checks in at a free event', r.s === 200 || (r.s === 403 && r.j.code === 'ucsd_only'), JSON.stringify(r));

  const ended = await event('ZZ Self Ended', { start_date: hours(-72), end_date: hours(-48), self_checkin_mode: 'until_end' });
  r = await student.call('POST', '/api/checkin/self', { event_id: ended.id });
  ok('an ended event is closed', r.s === 409 && r.j.code === 'ended', JSON.stringify(r));
  const ucsdOnly = await event('ZZ Self UCSD', { self_checkin_mode: 'until_end', audience: 'ucsd_only' });
  r = await guest.call('POST', '/api/checkin/self', { event_id: ucsdOnly.id });
  ok('a ucsd-only event refuses a guest', r.s === 403 && r.j.code === 'ucsd_only', JSON.stringify(r));
  const draft = await event('ZZ Self Draft', { self_checkin_mode: 'until_end', is_published: false });
  r = await student.call('POST', '/api/checkin/self', { event_id: draft.id });
  ok('an unpublished event is not found', r.s === 404, JSON.stringify(r));
  r = await student.call('POST', '/api/checkin/self', { event_id: 'not-a-uuid' });
  ok('a bad event id is not found', r.s === 404, JSON.stringify(r));

  // The staff scanner for an event that has self check-in off still works exactly as before
  const plain = await event('ZZ Self Plain');
  const { data: pt } = await svc.from('tickets').insert({ event_id: plain.id, user_id: other.id }).select('ticket_code').single();
  r = await exec.call('POST', '/api/tickets/checkin', { code: code(pt.ticket_code, win()), event_id: plain.id });
  ok('staff scan still works with self check-in off', r.s === 200 && r.j.points_awarded === 5, JSON.stringify(r));
  r = await exec.call('POST', '/api/tickets/checkin', { code: code(pt.ticket_code, win()), event_id: plain.id });
  ok('and its repeat message is unchanged (not marked self)', r.s === 200 && r.j.status === 'used' && r.j.self_checkin === false, JSON.stringify(r));

  // On with no end: works after the event is over; until_end does not
  const longAgo = await event('ZZ Self Forever', { start_date: hours(-72), end_date: hours(-48), self_checkin_mode: 'forever' });
  const rf = await member.call('POST', '/api/checkin/self', { event_id: longAgo.id });
  ok('no end: still works after the event is over', rf.s === 200 && rf.j.status === 'checked_in', JSON.stringify(rf));
  // Multi-day: a day whose hours have ended is closed; a day without hours is open
  const pacificDay = (d) => new Date(d.getTime() - 8 * 3600e3).toISOString().slice(0, 10);
  const closedDay = await event('ZZ Self Day Over', {
    start_date: hours(-30),
    end_date: hours(30),
    self_checkin_mode: 'until_end',
    day_hours: [{ day: pacificDay(new Date()), start: '00:00', end: '00:01' }],
  });
  const nowPac = new Date(Date.now() - 8 * 3600e3),
    minutesIntoDay = nowPac.getUTCHours() * 60 + nowPac.getUTCMinutes();
  const rd = await other.call('POST', '/api/checkin/self', { event_id: closedDay.id });
  ok('a day whose hours have ended is closed', minutesIntoDay < 2 || (rd.s === 409 && rd.j.code === 'day_over'), JSON.stringify(rd));
  const openDay = await event('ZZ Self Day Open', {
    start_date: hours(-30),
    end_date: hours(30),
    self_checkin_mode: 'until_end',
    day_hours: [{ day: pacificDay(new Date(Date.now() + 86400e3)), start: '10:00', end: '18:00' }],
  });
  const ro = await other.call('POST', '/api/checkin/self', { event_id: openDay.id });
  ok('a day without hours set is open', ro.s === 200, JSON.stringify(ro));

  // Short links: hidden from search by default, and the switch is honored
  const sl = `zz-sl-${Date.now().toString(36)}`;
  r = await exec.call('POST', '/api/admin/links', { slug: sl, destination: '/events' });
  ok('an exec cannot manage short links (admin only)', r.s === 403, JSON.stringify(r));
  await svc.from('short_links').insert({ slug: sl, destination: '/events' });
  const base0 = process.env.BASE_URL || 'http://localhost:3000';
  let h = await fetch(`${base0}/${sl}`, { redirect: 'manual' });
  ok(
    'a short link asks search engines not to list it by default',
    h.status === 307 && /noindex/.test(h.headers.get('x-robots-tag') ?? ''),
    `${h.status} ${h.headers.get('x-robots-tag')}`,
  );
  await svc.from('short_links').update({ hide_from_search: false }).eq('slug', sl);
  h = await fetch(`${base0}/${sl}`, { redirect: 'manual' });
  ok('turning the switch off lets it be listed', h.status === 307 && !h.headers.get('x-robots-tag'), `${h.status} ${h.headers.get('x-robots-tag')}`);
  await svc.from('short_links').delete().eq('slug', sl);

  // The forwarding link
  const base = process.env.BASE_URL || 'http://localhost:3000';
  const f = await fetch(`${base}/in/some-event`, { redirect: 'manual' });
  ok(
    '/in/<event> forwards to the portal page',
    f.status === 307 && (f.headers.get('location') ?? '').endsWith('/portal/in/some-event'),
    `${f.status} ${f.headers.get('location')}`,
  );
  const pg = await fetch(`${base}/portal/in/${ev.id}`, { headers: { cookie: await student.cookie }, redirect: 'manual' });
  ok('the portal page opens for a signed-in person', pg.status === 200, String(pg.status));
} finally {
  for (const id of eventIds) {
    await svc.from('ticket_checkins').delete().eq('event_id', id);
    await svc.from('point_transactions').delete().eq('event_id', id);
    await svc.from('tickets').delete().eq('event_id', id);
    await svc.from('events').delete().eq('id', id);
  }
  await svc.from('profile_private').delete().in('user_id', made);
  await svc.from('audit_log').delete().in('actor_id', made);
  await cleanup();
}
process.exit(t.result());

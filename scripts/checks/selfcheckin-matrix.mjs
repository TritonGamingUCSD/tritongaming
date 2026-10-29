// Self check-in across account states: ticket / no ticket x profile finished / not x UCSD / guest x free / paid / UCSD-only x cancelled. Run: npm run test:selfcheckin-matrix
import { svc, tracker, accounts } from './lib.mjs';

const t = tracker();
const ok = t.ok;
const { user, made, cleanup } = accounts('selfmx');
const eventIds = [];
const hours = (n) => new Date(Date.now() + n * 3600e3).toISOString();
async function event(title, over = {}) {
  const { data, error } = await svc
    .from('events')
    .insert({
      title,
      slug: `zz-selfmx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      start_date: hours(-1),
      end_date: hours(2),
      points_value: 5,
      is_published: true,
      self_checkin_mode: 'until_end',
      audience: 'public',
      ...over,
    })
    .select('id')
    .single();
  if (error) throw error;
  eventIds.push(data.id);
  return data;
}
const tix = async (u, e) => (await svc.from('tickets').select('id, status, source').eq('user_id', u).eq('event_id', e)).data ?? [];
const pts = async (u, e) => (await svc.from('point_transactions').select('amount').eq('user_id', u).eq('type', 'event_checkin').eq('event_id', e)).data ?? [];
const give = (u, ev, over = {}) =>
  svc
    .from('tickets')
    .insert({ event_id: ev, user_id: u, source: 'web', ...over })
    .select('id')
    .single();
try {
  const member = await user('member', ['ucsd']);
  const guest = await user('guest', [], { profile: { year: null, college: null, major: null } });
  const self = (u, e) => u.call('POST', '/api/checkin/self', { event_id: e });
  await svc.from('profile_private').upsert({ user_id: member.id, gender: 'Other' });
  // The guest starts with an unfinished profile.
  await svc.from('profiles').update({ display_name: null, pronouns: null }).eq('id', guest.id);
  await svc.from('profile_private').delete().eq('user_id', guest.id);
  let r;

  const free = await event('ZZ MX free');
  r = await fetch((process.env.BASE_URL || 'http://localhost:3000') + '/api/checkin/self', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event_id: free.id }),
  });
  ok('signed out: asked to sign in', r.status === 401, String(r.status));

  // A. has a ticket, profile NOT finished
  await give(guest.id, free.id);
  r = await self(guest, free.id);
  ok('A: ticket but unfinished profile -> asked to finish profile', r.s === 400 && r.j.code === 'needs_profile', JSON.stringify(r));
  const [a0] = await tix(guest.id, free.id);
  ok('A: the ticket is untouched (still active)', a0?.status === 'active');
  // finish profile, same ticket then checks in
  await svc.from('profiles').update({ display_name: 'ZZ MX Guest', pronouns: 'they/them' }).eq('id', guest.id);
  await svc.from('profile_private').upsert({ user_id: guest.id, gender: 'Other' });
  r = await self(guest, free.id);
  ok('A2: after finishing the profile -> checked in on the SAME ticket', r.s === 200 && r.j.status === 'checked_in', JSON.stringify(r));
  const a1 = await tix(guest.id, free.id);
  ok('A2: still exactly one ticket, now used', a1.length === 1 && a1[0].status === 'used' && a1[0].id === a0.id);
  r = await self(guest, free.id);
  ok('A3: scanning again -> already checked in', r.s === 200 && r.j.status === 'already', JSON.stringify(r));

  // B. UCSD member with a ticket and complete profile
  const evB = await event('ZZ MX B');
  await give(member.id, evB.id);
  r = await self(member, evB.id);
  ok('B: member with ticket -> checked in, no second ticket', r.s === 200 && r.j.status === 'checked_in' && (await tix(member.id, evB.id)).length === 1, JSON.stringify(r));
  ok('B: points awarded once', (await pts(member.id, evB.id)).length === 1);

  // C. cancelled ticket
  const evC = await event('ZZ MX C');
  await give(member.id, evC.id, { status: 'cancelled' });
  r = await self(member, evC.id);
  ok('C: cancelled ticket -> refused', r.s === 409, JSON.stringify(r));
  ok('C: no points', (await pts(member.id, evC.id)).length === 0);

  // D. guest holding a paid ticket
  const evD = await event('ZZ MX D paid', { ticket_price: 8 });
  await give(guest.id, evD.id);
  r = await self(guest, evD.id);
  ok('D: guest who already paid -> checked in', r.s === 200 && r.j.status === 'checked_in', JSON.stringify(r));
  // D2. guest, paid, no ticket
  const evD2 = await event('ZZ MX D2 paid', { ticket_price: 8 });
  r = await self(guest, evD2.id);
  ok('D2: guest without a ticket at a paid event -> needs payment, nothing created', r.s === 402 && (await tix(guest.id, evD2.id)).length === 0, JSON.stringify(r));
  r = await self(member, evD2.id);
  ok('D3: UCSD member at the same paid event -> free, checked in', r.s === 200 && r.j.status === 'checked_in', JSON.stringify(r));

  // E. UCSD-only
  const evE = await event('ZZ MX E', { audience: 'ucsd_only' });
  r = await self(guest, evE.id);
  ok('E: guest at UCSD-only -> refused with ucsd_only', r.s === 403 && r.j.code === 'ucsd_only', JSON.stringify(r));
  ok('E: no ticket created', (await tix(guest.id, evE.id)).length === 0);
  await give(guest.id, evE.id);
  r = await self(guest, evE.id);
  ok('E2: guest holding a ticket to a UCSD-only event is still refused', r.s === 403 && r.j.code === 'ucsd_only', JSON.stringify(r));
  r = await self(member, evE.id);
  ok('E3: UCSD member at UCSD-only -> checked in', r.s === 200 && r.j.status === 'checked_in', JSON.stringify(r));

  // F. guest, free public event, no ticket, finished profile
  const evF = await event('ZZ MX F');
  r = await self(guest, evF.id);
  ok(
    'F: guest, free public event, no ticket -> ticket made and checked in',
    r.s === 200 && r.j.status === 'checked_in' && (await tix(guest.id, evF.id)).length === 1,
    JSON.stringify(r),
  );

  // G. profile unfinished AND no ticket
  await svc.from('profiles').update({ display_name: null }).eq('id', guest.id);
  const evG = await event('ZZ MX G');
  r = await self(guest, evG.id);
  ok(
    'G: no ticket + unfinished profile -> finish profile, nothing created',
    r.s === 400 && r.j.code === 'needs_profile' && (await tix(guest.id, evG.id)).length === 0,
    JSON.stringify(r),
  );
  r = await guest.call('POST', '/api/tickets', { event_id: evG.id });
  ok('G2: get-ticket with unfinished profile is refused too', r.s >= 400 && r.s < 500, JSON.stringify(r));
  ok('G2: and no ticket was made', (await tix(guest.id, evG.id)).length === 0);

  // H. staff already scanned (ticket used, no source self)
  const evH = await event('ZZ MX H');
  await give(member.id, evH.id, { status: 'used', checked_in_at: new Date().toISOString() });
  r = await self(member, evH.id);
  ok('H: already checked in by staff -> already, no extra points', r.s === 200 && r.j.status === 'already' && (await pts(member.id, evH.id)).length === 0, JSON.stringify(r));
} catch (e) {
  console.error(e);
  ok('script ran without crashing', false, String(e));
} finally {
  if (eventIds.length) {
    await svc.from('ticket_checkins').delete().in('event_id', eventIds);
    await svc.from('point_transactions').delete().in('event_id', eventIds);
    await svc.from('tickets').delete().in('event_id', eventIds);
    await svc.from('events').delete().in('id', eventIds);
  }
  await svc.from('notifications').delete().in('user_id', made);
  await svc.from('profile_private').delete().in('user_id', made);
  await svc.from('audit_log').delete().in('actor_id', made);
  await cleanup();
}
process.exit(t.result());

// Checks, over HTTP against a running dev server with throwaway ZZ accounts, division ZZ events and tickets: who may check people in with the portal's code box (each event's owner decides), and the co-host invite flow. Removes everything.
// Run (after the migrations 20261105220000 and 20261105230000 are applied): node scripts/checks/division-checkin.mjs
import { createHmac } from 'node:crypto';
import { svc, tracker, accounts } from './lib.mjs';

const t = tracker();
const { user, cleanup } = accounts('divci');
const events = [];
let divA, divB;
const hours = (n) => new Date(Date.now() + n * 3600e3).toISOString();
const code = (secret) =>
  (
    BigInt(
      `0x${createHmac('sha256', secret)
        .update(String(Math.floor(Date.now() / 1000 / 30)))
        .digest('hex')
        .slice(0, 12)}`,
    ) % 1000000n
  )
    .toString()
    .padStart(6, '0');
const setRoles = (u, roles) => svc.rpc('admin_set_user_roles', { _user_id: u.id, _roles: roles, _granted_by: null });
const mkEvent = async (title, over = {}) => {
  const { data } = await svc
    .from('events')
    .insert({
      title,
      slug: `zz-divci-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      start_date: hours(-1),
      end_date: hours(2),
      points_value: 0,
      is_published: true,
      ...over,
    })
    .select('id')
    .single();
  events.push(data.id);
  return data.id;
};
const mkTicket = async (event_id, user_id) => (await svc.from('tickets').insert({ event_id, user_id }).select('id, ticket_code').single()).data;
try {
  divA = (
    await svc
      .from('divisions')
      .insert({ slug: `zz-divci-a-${Date.now()}`, name: 'ZZ Divci A' })
      .select('id')
      .single()
  ).data.id;
  divB = (
    await svc
      .from('divisions')
      .insert({ slug: `zz-divci-b-${Date.now()}`, name: 'ZZ Divci B' })
      .select('id')
      .single()
  ).data.id;
  const headA = await user('heada', ['ucsd']),
    memberA = await user('membera', ['ucsd']),
    headB = await user('headb', ['ucsd']),
    officer = await user('officer', ['officer']),
    lead = await user('lead', ['lead']),
    plain = await user('plain', ['ucsd']);
  await setRoles(headA, [{ role: 'ucsd' }, { role: 'division', division_id: divA }]);
  await setRoles(memberA, [{ role: 'ucsd' }, { role: 'division_member', division_id: divA }]);
  await setRoles(headB, [{ role: 'ucsd' }, { role: 'division', division_id: divB }]);

  // check-in with the code box (no event named)
  const evA = await mkEvent('ZZ Divci A event', { division_id: divA });
  const tk = await mkTicket(evA, plain.id);
  const scan = (u) => u.call('POST', '/api/tickets/checkin', { code: code(tk.ticket_code), preview: true });
  t.ok('a Division Member finds a ticket of their division’s event', (await scan(memberA)).s === 200);
  t.ok('a Division Head does too', (await scan(headA)).s === 200);
  t.ok('a TG officer does not find it', (await scan(officer)).s === 404);
  t.ok('another division’s Head does not find it', (await scan(headB)).s === 404);
  t.ok('a plain student is refused', (await scan(plain)).s === 403);
  const done = await memberA.call('POST', '/api/tickets/checkin', { code: code(tk.ticket_code) });
  t.ok('a Division Member checks the ticket in', done.s === 200 && !done.j.error, JSON.stringify(done));
  t.ok('the scan result names the hosting division', done.j.division === 'ZZ Divci A', String(done.j.division));
  const evTG = await mkEvent('ZZ Divci TG event');
  const tk2 = await mkTicket(evTG, plain.id);
  t.ok('a TG officer finds a Triton Gaming ticket as before', (await officer.call('POST', '/api/tickets/checkin', { code: code(tk2.ticket_code), preview: true })).s === 200);
  t.ok('a Division Member does not find a Triton Gaming ticket', (await memberA.call('POST', '/api/tickets/checkin', { code: code(tk2.ticket_code), preview: true })).s === 404);

  // self check-in setting
  const mode = (u, ev) => u.call('PATCH', `/api/events/${ev}/self-checkin`, { mode: 'until_end' });
  t.ok('a Division Head turns on self check-in for their event', (await mode(headA, evA)).s === 200);
  t.ok('a Division Member cannot', (await mode(memberA, evA)).s === 403);
  t.ok('a TG lead cannot change a division event', (await mode(lead, evA)).s === 403);
  t.ok('a Division Head cannot change a Triton Gaming event', (await mode(headA, evTG)).s === 403);

  // co-hosts
  const co = (u, ev, m, division_id, extra = {}) => u.call(m, `/api/events/${ev}/cohosts`, { division_id, ...extra });
  t.ok('another division’s Head cannot invite for an event that is not theirs', (await co(headB, evA, 'POST', divB)).s === 403);
  const inv = await co(headA, evA, 'POST', divB);
  t.ok('a Head invites another division', inv.s === 200 && inv.j.status === 'invited', JSON.stringify(inv));
  t.ok('inviting twice is refused', (await co(headA, evA, 'POST', divB)).s === 409);
  t.ok('the host cannot accept for the invited division', (await co(headA, evA, 'PATCH', divB, { action: 'accept' })).s === 403);
  t.ok('a Member of the invited division cannot accept', (await co(memberA, evA, 'PATCH', divB, { action: 'accept' })).s === 403);
  const waiting = await headB.call('GET', `/api/divisions/${divB}/invites`);
  t.ok('the invited Head sees the invitation', waiting.s === 200 && waiting.j.invites?.some((i) => i.event_id === evA), JSON.stringify(waiting));
  t.ok('the invited Head accepts', (await co(headB, evA, 'PATCH', divB, { action: 'accept' })).s === 200);
  const listed = await headB.call('GET', `/api/divisions/${divB}/events`);
  t.ok(
    'the event is now on the co-host’s Events page',
    listed.j.events?.some((e) => e.id === evA && e.owned === false),
    JSON.stringify(listed.j).slice(0, 200),
  );
  t.ok('the co-host can leave', (await co(headB, evA, 'DELETE', divB)).s === 200);
  const listed2 = await headB.call('GET', `/api/divisions/${divB}/events`);
  t.ok('and it is gone from their page', !(listed2.j.events ?? []).some((e) => e.id === evA));
  // a co-host's Head checks people in at the event (and cannot edit it)
  await co(headA, evA, 'POST', divB);
  await co(headB, evA, 'PATCH', divB, { action: 'accept' });
  const tk3 = await mkTicket(evA, memberA.id);
  t.ok('a co-hosting division’s Head finds the ticket', (await headB.call('POST', '/api/tickets/checkin', { code: code(tk3.ticket_code), preview: true })).s === 200);
  t.ok('but cannot change the event’s self check-in', (await mode(headB, evA)).s === 403);
  await co(headB, evA, 'DELETE', divB);
  t.ok('after leaving they no longer find it', (await headB.call('POST', '/api/tickets/checkin', { code: code(tk3.ticket_code), preview: true })).s === 404);
  const toTG = await co(headA, evA, 'POST', null);
  t.ok('a division can invite Triton Gaming', toTG.s === 200 && toTG.j.status === 'invited', JSON.stringify(toTG));
  t.ok('a TG officer cannot accept for Triton Gaming', (await co(officer, evA, 'PATCH', null, { action: 'accept' })).s === 403);
} finally {
  await svc.from('tickets').delete().in('event_id', events);
  await svc.from('event_cohosts').delete().in('event_id', events);
  for (const id of events) await svc.from('events').delete().eq('id', id);
  for (const id of [divA, divB]) if (id) await svc.from('divisions').delete().eq('id', id);
  await svc
    .from('role_change_log')
    .delete()
    .in('user_id', (await svc.from('profiles').select('id').like('display_name', 'ZZ Mtg%')).data?.map((p) => p.id) ?? []);
  await svc.from('audit_log').delete().like('summary', '%ZZ %');
  await cleanup();
}
process.exit(t.result());

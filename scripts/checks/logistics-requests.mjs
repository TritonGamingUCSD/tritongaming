// Logistics stage 4 (requests for devices and prizes, who may see and change them, who is told), end to end against a running dev server as temporary "ZZ" accounts.
// Notifications only reach the ZZ accounts (they are named ZZ…). Everything made is deleted at the end.
// Run: BASE_URL=http://localhost:3222 node scripts/checks/logistics-requests.mjs
import { accounts, svc, day, tracker } from './lib.mjs';

const t = tracker();
const { user, made, cleanup } = accounts('logireq');
const told = async (id, type) => (await svc.from('notifications').select('title, body, href').eq('user_id', id).eq('type', type)).data ?? [];
try {
  const exec = await user('exec', ['exec']);
  const lead = await user('lead', ['lead']);
  const other = await user('other', ['officer']);
  const student = await user('student', ['ucsd']);
  const P = (await exec.call('POST', '/api/logistics/plans', { name: 'ZZ Request Night', starts_on: day(0), ends_on: day(1) })).j.plan;
  const URL_ = `/api/logistics/plans/${P.id}/requests`;
  const bundle = (await exec.call('GET', '/api/logistics')).j.lists.bundle[0]?.value;

  t.ok('a student cannot see or make requests', (await student.call('GET', URL_)).s === 403 && (await student.call('POST', URL_, { kind: 'prizes', items: [{ qty: 1, value: 5 }] })).s === 403);
  t.ok('a request needs a kind', (await lead.call('POST', URL_, { kind: 'snacks', items: [] })).s === 400);
  t.ok('a device request needs a real bundle or type', (await lead.call('POST', URL_, { kind: 'devices', items: [{ what: 'Toaster', qty: 1 }] })).s === 400);
  t.ok('how many has to make sense', (await lead.call('POST', URL_, { kind: 'devices', items: [{ what: bundle, qty: 0 }] })).s === 400);
  t.ok('a prize request needs a number and a dollar value', (await lead.call('POST', URL_, { kind: 'prizes', items: [{ qty: 3, value: 'lots' }] })).s === 400);

  const a = await lead.call('POST', URL_, { kind: 'devices', team: 'ZZ Valorant', items: [{ what: bundle.toLowerCase(), qty: 4, games: ['Valorant'] }], notes: 'Need by 9am' });
  t.ok('a lead asks for devices (a bundle written in any capitals)', a.s === 201 && a.j.request.items[0].what === bundle && a.j.request.status === 'submitted', JSON.stringify(a.j));
  const A = a.j.request.id;
  const b = await lead.call('POST', URL_, { kind: 'prizes', items: [{ qty: 10, value: 24.999 }, { qty: 3, value: 100 }] });
  t.ok('a lead asks for prizes by count and value, rounded to cents', b.s === 201 && b.j.request.items[0].value === 25);
  const B = b.j.request.id;
  const e = await exec.call('POST', URL_, { kind: 'prizes', requester_id: other.id, items: [{ qty: 2, value: 10 }] });
  t.ok('logistics can write a request for someone else', e.s === 201 && e.j.request.requester_id === other.id);
  const E = e.j.request.id;

  const newOnes = await told(exec.id, 'logistics_request');
  t.ok('the logistics team is told about a new request, with a link', newOnes.length >= 2 && newOnes.some((n) => n.href === `/portal/logistics/events/${P.slug}/requests` && /device request/.test(n.title)), JSON.stringify(newOnes));
  t.ok('the person who made it is not told about their own', (await told(lead.id, 'logistics_request')).length === 0);

  const mine = (await lead.call('GET', URL_)).j;
  t.ok('a lead sees only their own requests', mine.requests.length === 2 && mine.requests.every((r) => r.requester_id === lead.id) && mine.canManage === false);
  t.ok('another officer sees only theirs (the one logistics wrote)', (await other.call('GET', URL_)).j.requests.map((r) => r.id).join() === E);
  t.ok('logistics sees all of them, with names', (await exec.call('GET', URL_)).j.requests.length === 3 && (await exec.call('GET', URL_)).j.requests.every((r) => r.requester.startsWith('ZZ')));

  t.ok('someone else cannot change a request', (await other.call('PATCH', URL_, { request_id: A, notes: 'x' })).s === 403);
  t.ok('someone else cannot take it back', (await other.call('DELETE', URL_, { request_id: A })).s === 403);
  t.ok('the person who asked can change it before it is planned', (await lead.call('PATCH', URL_, { request_id: A, items: [{ what: bundle, qty: 5, games: ['Valorant'] }], notes: 'Need by 8am' })).j.request.items[0].qty === 5);
  t.ok('the logistics team is told it was changed', (await told(exec.id, 'logistics_request')).some((n) => /was changed/.test(n.title)));
  t.ok('a requester cannot set the status', (await lead.call('PATCH', URL_, { request_id: A, status: 'done' })).j.request.status === 'submitted');

  const ans = await exec.call('PATCH', URL_, { request_id: A, status: 'planned', response: 'Added to the allocation' });
  t.ok('logistics plans it with a note', ans.s === 200 && ans.j.request.status === 'planned' && ans.j.request.response === 'Added to the allocation' && !!ans.j.request.planned_at);
  const upd = await told(lead.id, 'logistics_update');
  t.ok('the person who asked is told it is planned, with the note', upd.length === 1 && /planned/.test(upd[0].title) && /Added to the allocation/.test(upd[0].body), JSON.stringify(upd));
  t.ok('once planned the requester can no longer change or remove it', (await lead.call('PATCH', URL_, { request_id: A, notes: 'late' })).s === 403 && (await lead.call('DELETE', URL_, { request_id: A })).s === 403);
  t.ok('logistics can still change it', (await exec.call('PATCH', URL_, { request_id: A, notes: 'moved to Ballroom' })).s === 200);
  // A device request is what makes the empty rows in the allocation.
  const plan1 = async () => (await exec.call('GET', `/api/logistics/plans/${P.id}`)).j;
  const mineRows = async () => (await plan1()).slots.filter((x) => x.request_id === A);
  const n0 = (await mineRows()).length;
  t.ok('a device request makes its empty rows under its team', n0 >= 4 && (await plan1()).stations.some((x) => x.name === 'ZZ Valorant'), String(n0));
  const upQ = await exec.call('PATCH', URL_, { request_id: A, items: [{ what: bundle, qty: 9, games: ['Valorant'] }] });
  const n1 = (await mineRows()).length;
  t.ok('asking for more adds rows', upQ.s === 200 && n1 > n0, `${upQ.s} ${n0} ${n1} ${JSON.stringify(upQ.j).slice(0, 200)}`);
  const upD = await exec.call('PATCH', URL_, { request_id: A, items: [{ what: bundle, qty: 2, games: ['Valorant'] }] });
  t.ok('asking for less removes empty rows', upD.s === 200 && (await mineRows()).length < n0);
  const listed = (await exec.call('GET', URL_)).j.requests.find((r) => r.id === A);
  t.ok('the request shows filled / total rows', listed.rowsTotal === (await mineRows()).length && listed.filled === 0);
  const emptyPlain = await exec.call('POST', `/api/logistics/plans/${P.id}/slots`, { action: 'empty', device_id: '00000000-0000-4000-8000-000000000000' });
  t.ok('emptying a device that is not in the plan is refused', emptyPlain.s === 404);
  const dec = await exec.call('PATCH', URL_, { request_id: E, status: 'declined', response: 'Not enough stock' });
  t.ok('a request logistics wrote for someone tells that person, when declined', dec.s === 200 && (await told(other.id, 'logistics_update')).some((n) => /declined/.test(n.title)));
  t.ok('an unknown status is refused', (await exec.call('PATCH', URL_, { request_id: A, status: 'maybe' })).s === 400);
  t.ok('the person who asked can take back a request that is still waiting', (await lead.call('DELETE', URL_, { request_id: B })).s === 200 && (await lead.call('GET', URL_)).j.requests.length === 1);

  await exec.call('PATCH', `/api/logistics/plans/${P.id}`, { status: 'closed' });
  t.ok('a closed event takes no more requests', (await lead.call('POST', URL_, { kind: 'prizes', items: [{ qty: 1, value: 5 }] })).s === 409);
  const { data: audit } = await svc.from('audit_log').select('action, entity_type').in('actor_id', made).eq('entity_type', 'logistics request');
  t.ok('requests are in the audit log as create / remove, never "delete"', audit.some((x) => x.action === 'create') && audit.some((x) => x.action === 'remove') && !audit.some((x) => x.action === 'delete'));
  t.ok('removing the event removes its requests', (await exec.call('DELETE', `/api/logistics/plans/${P.id}`)).s === 200 && (await svc.from('logistics_requests').select('id', { count: 'exact', head: true }).eq('plan_id', P.id)).count === 0);
} finally {
  await svc.from('logistics_plans').delete().like('name', 'ZZ%');
  await svc.from('notifications').delete().in('user_id', made);
  await svc.from('audit_log').delete().in('actor_id', made);
  await cleanup();
}
process.exit(t.result());

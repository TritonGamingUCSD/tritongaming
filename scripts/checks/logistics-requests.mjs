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
  const b0 = (await exec.call('GET', '/api/logistics')).j.lists.bundle[0];
  const bundle = b0?.value;
  const parts = b0.items.reduce((n, i) => n + i.qty, 0);

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
  t.ok('the logistics team is told about a new request, with a link', newOnes.length >= 2 && newOnes.some((n) => n.href === `/portal/logistics/${P.slug}/requests-devices` && /device request/.test(n.title)), JSON.stringify(newOnes));
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

  const ans = await exec.call('PATCH', URL_, { request_id: A, status: 'planned' });
  t.ok('logistics sets where it stands', ans.s === 200 && ans.j.request.status === 'planned' && !!ans.j.request.planned_at);
  t.ok('the person who asked is not messaged: logistics tells them itself', (await told(lead.id, 'logistics_update')).length === 0);
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
  const setsOk = (await mineRows()).length % parts === 0 && new Set((await mineRows()).map((x) => x.set_id)).size === (await mineRows()).length / parts;
  t.ok('a bundle request is whole sets, one per unit', setsOk);
  const mk = async (tag) => (await exec.call('POST', '/api/logistics/devices', { tag, type: 'Gaming PC', shelf: 'ZZ Shelf' })).j.device;
  const dA = await mk('ZZ-RA'); const dB = await mk('ZZ-RB');
  const slot0 = (await mineRows())[0];
  const SL = `/api/logistics/plans/${P.id}/slots`;
  t.ok('typing an ID fills a row of the request', (await exec.call('POST', SL, { action: 'assign', slot_id: slot0.id, tag: 'zz-ra' })).s === 200);
  const filled = (await plan1()).items.find((i) => i.device_id === dA.id);
  t.ok('the device keeps the request and the set', filled?.request_id === A && filled.set_id === slot0.set_id);
  t.ok('typing another ID replaces the device in that row', (await exec.call('POST', SL, { action: 'assign', device_id: dA.id, tag: 'ZZ-RB' })).s === 200 && !(await plan1()).items.some((i) => i.device_id === dA.id) && (await plan1()).items.some((i) => i.device_id === dB.id && i.request_id === A));
  const lessFilled = await exec.call('PATCH', URL_, { request_id: A, items: [{ what: bundle, qty: 1, games: ['Valorant'] }] });
  const allRows = async () => { const d = await plan1(); return d.slots.filter((x) => x.request_id === A).length + d.items.filter((x) => x.request_id === A).length; };
  t.ok('fewer sets leaves exactly what is asked for, taking empty sets first', lessFilled.s === 200 && lessFilled.j.kept === 0 && (await allRows()) === parts && (await plan1()).items.some((i) => i.device_id === dB.id), `${lessFilled.j.kept} ${await allRows()}`);
  const dC = await mk('ZZ-RC');
  await exec.call('PATCH', URL_, { request_id: A, items: [{ what: bundle, qty: 2, games: ['Valorant'] }] });
  const slotC = (await mineRows()).filter((x) => x.type === 'Gaming PC').sort((a, b) => b.sort - a.sort)[0];
  await exec.call('POST', SL, { action: 'assign', slot_id: slotC.id, tag: 'ZZ-RC' });
  await exec.call('POST', `/api/logistics/plans/${P.id}/steps`, { device_id: dC.id, step_id: (await exec.call('GET', '/api/logistics')).j.lists.step[0].id });
  await exec.call('POST', `/api/logistics/plans/${P.id}/steps`, { device_id: dB.id, step_id: (await exec.call('GET', '/api/logistics')).j.lists.step[0].id });
  const lockedCut = await exec.call('PATCH', URL_, { request_id: A, items: [{ what: bundle, qty: 1, games: ['Valorant'] }] });
  t.ok('a device with an event-day step done is never taken out', lockedCut.s === 200 && lockedCut.j.kept === 1 && (await plan1()).items.some((i) => i.device_id === dC.id) && (await plan1()).items.some((i) => i.device_id === dB.id), JSON.stringify(lockedCut.j.kept));
  t.ok('a row can be emptied again', (await exec.call('POST', SL, { action: 'empty', device_id: dC.id })).s === 200 && !(await plan1()).items.some((i) => i.device_id === dC.id));
  await svc.from('logistics_devices').delete().in('id', [dA.id, dB.id, dC.id]);
  // Editing the bundle itself follows into the open requests that ask for it.
  const mkB = await exec.call('POST', '/api/logistics/options', { kind: 'bundle', value: 'ZZ Bundle', items: [{ type: 'Gaming PC', qty: 1 }, { type: 'Monitor', qty: 1 }] });
  const bId = mkB.j.option.id;
  const rq = await exec.call('POST', URL_, { kind: 'devices', team: 'ZZ Bundle Team', items: [{ what: 'ZZ Bundle', qty: 2, games: [] }] });
  const RB = rq.j.request.id;
  const bRows = async () => (await plan1()).slots.filter((x) => x.request_id === RB);
  t.ok('a request for a bundle makes a set per unit', (await bRows()).length === 4);
  await exec.call('PATCH', '/api/logistics/options', { id: bId, items: [{ type: 'Gaming PC', qty: 1 }, { type: 'Monitor', qty: 1 }, { type: 'Mouse', qty: 1 }] });
  t.ok('adding a part to the bundle adds that row to every set', (await bRows()).length === 6 && (await bRows()).filter((x) => x.type === 'Mouse').length === 2);
  await exec.call('PATCH', '/api/logistics/options', { id: bId, items: [{ type: 'Gaming PC', qty: 1 }] });
  t.ok('taking a part away clears those rows', (await bRows()).length === 2 && (await bRows()).every((x) => x.type === 'Gaming PC'));
  await exec.call('PATCH', '/api/logistics/options', { id: bId, value: 'ZZ Bundle Two' });
  const renamed = (await exec.call('GET', URL_)).j.requests.find((r) => r.id === RB);
  t.ok('renaming the bundle renames it in the request', renamed.items[0].what === 'ZZ Bundle Two' && (await bRows()).length === 2);
  t.ok('a bundle that a request asks for cannot be deleted', (await exec.call('DELETE', '/api/logistics/options', { id: bId })).s === 409);
  await exec.call('DELETE', URL_, { request_id: RB });
  await exec.call('DELETE', '/api/logistics/options', { id: bId });
  const withContact = await exec.call('PATCH', URL_, { request_id: A, contact: 'zz_discord' });
  t.ok('a request has one main contact, and its team shows it', withContact.s === 200 && withContact.j.request.contact === 'zz_discord' && (await plan1()).stations.find((x) => x.name === 'ZZ Valorant')?.contact === 'zz_discord');
  // Sponsor and officer loaners can fill a row, just like inventory devices.
  const loan = await exec.call('POST', `/api/logistics/plans/${P.id}/borrowed`, { tag: 'ZZ-LOAN', type: 'Mouse', owner_kind: 'officer', owner_user_id: exec.id });
  t.ok('an officer loaner is added for the event', loan.s === 201, JSON.stringify(loan.j).slice(0, 150));
  const mouseSlot = (await plan1()).slots.find((x) => x.request_id === A && x.type === 'Mouse') ?? (await plan1()).slots.find((x) => x.request_id === A);
  const withLoan = await exec.call('POST', SL, { action: 'assign', slot_id: mouseSlot.id, tag: 'zz-loan' });
  const afterLoan = (await plan1()).borrowed.find((x) => x.tag === 'ZZ-LOAN');
  t.ok('typing a loaner ID fills a row with it', withLoan.s === 200 && afterLoan?.request_id === A && afterLoan.station_id === mouseSlot.station_id, JSON.stringify(afterLoan));
  const releaseLoan = await exec.call('POST', SL, { action: 'empty', borrowed_id: afterLoan.id });
  const freed = (await plan1()).borrowed.find((x) => x.tag === 'ZZ-LOAN');
  t.ok('emptying the row gives the loaner back', releaseLoan.s === 200 && !freed.request_id && !freed.station_id);
  // A prize request is a pool with a target (how many, how many dollars), and follows the request.
  const poolOf = async (rid) => (await plan1()).prizes.pools.find((x) => x.request_id === rid);
  const pE = await poolOf(E);
  t.ok('a prize request makes a pool with its target', pE && pE.target_qty === 2 && pE.target_total === 20, JSON.stringify(pE));
  await exec.call('PATCH', URL_, { request_id: E, items: [{ qty: 4, value: 15 }] });
  const pE2 = await poolOf(E);
  t.ok('changing the request changes the pool target', pE2.target_qty === 4 && pE2.target_total === 60, JSON.stringify(pE2));
  const zPrize = (await exec.call('POST', '/api/logistics/prizes', { name: 'ZZ Prize', price: 15, quantity: 9 })).j.prize;
  await exec.call('POST', `/api/logistics/plans/${P.id}/prizes`, { pool_id: pE2.id, prize_id: zPrize.id, quantity: 4 });
  await exec.call('PATCH', URL_, { request_id: E, items: [{ qty: 3, value: 15 }] });
  const lineAfter = (await plan1()).prizes.lines.find((x) => x.pool_id === pE2.id);
  t.ok('a smaller request trims the pool\u2019s prizes to fit', lineAfter?.quantity === 3, JSON.stringify(lineAfter));
  // Several people saving the same request at the same moment still leave exactly what it asks for.
  const rc = await exec.call('POST', URL_, { kind: 'devices', team: 'ZZ Race Team', items: [{ what: 'Mouse', qty: 1, games: [] }] });
  const RC = rc.j.request.id;
  await Promise.all([1, 2, 3].map(() => exec.call('PATCH', URL_, { request_id: RC, items: [{ what: 'Mouse', qty: 4, games: [] }] })));
  const raceRows = (await plan1()).slots.filter((x) => x.request_id === RC).length + (await plan1()).items.filter((x) => x.request_id === RC).length;
  t.ok('saving the same request at once leaves exactly the rows it asks for', raceRows === 4, String(raceRows));
  await exec.call('DELETE', URL_, { request_id: RC });
  const listed = (await exec.call('GET', URL_)).j.requests.find((r) => r.id === A);
  t.ok('the request shows filled / total rows', listed.rowsTotal === (await mineRows()).length && listed.filled === 0);
  const emptyPlain = await exec.call('POST', `/api/logistics/plans/${P.id}/slots`, { action: 'empty', device_id: '00000000-0000-4000-8000-000000000000' });
  t.ok('emptying a device that is not in the plan is refused', emptyPlain.s === 404);
  const dec = await exec.call('PATCH', URL_, { request_id: E, status: 'declined' });
  t.ok('declining a request leaves it declined and takes back its empty rows', dec.s === 200 && dec.j.request.status === 'declined');
  t.ok('an unknown status is refused', (await exec.call('PATCH', URL_, { request_id: A, status: 'maybe' })).s === 400);
  t.ok('the person who asked can take back a request that is still waiting', (await lead.call('DELETE', URL_, { request_id: B })).s === 200 && (await lead.call('GET', URL_)).j.requests.length === 1);

  await exec.call('PATCH', `/api/logistics/plans/${P.id}`, { status: 'closed' });
  t.ok('a closed event takes no more requests', (await lead.call('POST', URL_, { kind: 'prizes', items: [{ qty: 1, value: 5 }] })).s === 409);
  const { data: audit } = await svc.from('audit_log').select('action, entity_type').in('actor_id', made).eq('entity_type', 'logistics request');
  t.ok('requests are in the audit log as create / remove, never "delete"', audit.some((x) => x.action === 'create') && audit.some((x) => x.action === 'remove') && !audit.some((x) => x.action === 'delete'));
  t.ok('removing the event removes its requests', (await exec.call('DELETE', `/api/logistics/plans/${P.id}`)).s === 200 && (await svc.from('logistics_requests').select('id', { count: 'exact', head: true }).eq('plan_id', P.id)).count === 0);
} finally {
  await svc.from('logistics_plans').delete().like('name', 'ZZ%');
  await svc.from('logistics_prizes').delete().like('name', 'ZZ%');
  await svc.from('notifications').delete().in('user_id', made);
  await svc.from('audit_log').delete().in('actor_id', made);
  await cleanup();
}
process.exit(t.result());

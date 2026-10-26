// Logistics prizes: the stock (on hand, a history for every prize), stations and what each gets, event-day counters, closing an event, and several people at once.
// End to end against a running dev server as temporary "ZZ" accounts. It only writes ZZ prizes, plans, sponsors and list entries, all deleted at the end.
// Run: BASE_URL=http://localhost:3222 node scripts/checks/logistics-prizes.mjs
import { accounts, svc, day, tracker } from './lib.mjs';

const t = tracker();
const { user, made, cleanup } = accounts('logiprize');
try {
  const exec = await user('exec', ['exec']);
  const exec2 = await user('exec2', ['exec']);
  const officer = await user('officer', ['officer']);
  const student = await user('student', ['ucsd']);
  const boot = (await officer.call('GET', '/api/logistics')).j;
  t.ok('the prize lists and steps are there', boot.lists.prize_size.length >= 3 && ['Sorted', 'Picked Up', 'Given Out', 'Back To Storage'].every((n) => boot.lists.prize_step.some((x) => x.value === n)) && boot.lists.prize_step.length === 5);
  t.ok('the page is told who is looking (for "who is here")', boot.me?.id === officer.id && /ZZ/.test(boot.me.name), JSON.stringify(boot.me));
  const steps = Object.fromEntries(boot.lists.prize_step.map((s) => [s.value, s]));
  const sid = (n) => steps[n].id;
  t.ok('Given Out gives prizes out and Back To Storage counts only what is left', steps['Given Out'].gives === true && steps['Back To Storage'].leftover === true);

  // ---- the stock
  t.ok('a student cannot see prizes', (await student.call('GET', '/api/logistics/prizes')).s === 403);
  const list0 = await officer.call('GET', '/api/logistics/prizes');
  t.ok('an officer can see prizes, and gets the channel the stock is announced on', list0.s === 200 && /^logi-stock-[0-9a-f]{20}$/.test(list0.j.channel), JSON.stringify(list0.j.channel));
  t.ok('an officer cannot add a prize', (await officer.call('POST', '/api/logistics/prizes', { name: 'ZZ Mouse', quantity: 3 })).s === 403);
  t.ok('a prize needs a name', (await exec.call('POST', '/api/logistics/prizes', { name: ' ', quantity: 3 })).s === 400);
  t.ok('a price must be a number', (await exec.call('POST', '/api/logistics/prizes', { name: 'ZZ Bad', price: 'lots', quantity: 1 })).s === 400);
  const sp = await exec.call('POST', '/api/logistics/sponsors', { name: 'ZZ Prize Sponsor' });
  const a = await exec.call('POST', '/api/logistics/prizes', { name: 'ZZ Mouse', sponsor_id: sp.j.sponsor.id, size: 'Small Prizing', price: 24.5, quantity: 10, bin: 'Blue bin 2', source: 'Bought at Costco', note: 'First batch' });
  t.ok('exec adds a prize (on hand 10, left 10, bin and source kept)', a.s === 201 && a.j.prize.left === 10 && a.j.prize.price === 24.5 && a.j.prize.bin === 'Blue bin 2' && a.j.prize.source === 'Bought at Costco', JSON.stringify(a.j));
  const A = a.j.prize.id;
  const b = await exec.call('POST', '/api/logistics/prizes', { name: 'ZZ Soda', price: 3, quantity: 500, quantity_is_estimate: true, size: 'Free' });
  const B = b.j.prize.id;
  t.ok('a quantity can be an estimate', b.s === 201 && b.j.prize.quantity_is_estimate === true);
  const typed = await exec.call('PATCH', '/api/logistics/prizes', { id: A, type: 'Wireless mouse', in_hand: false });
  t.ok('a prize can have a type and be marked not here yet, and back', typed.s === 200 && typed.j.prize.type === 'Wireless mouse' && typed.j.prize.in_hand === false && (await exec.call('PATCH', '/api/logistics/prizes', { id: A, in_hand: true })).j.prize.in_hand === true);
  const log = async (id) => (await officer.call('GET', `/api/logistics/prizes/${id}/log`)).j.log;
  const log0 = await log(A);
  t.ok('the history starts with the add, with its reason', log0.length === 1 && log0[0].kind === 'add' && log0[0].qty === 10 && log0[0].note === 'First batch' && log0[0].sponsor === 'ZZ Prize Sponsor' && /ZZ/.test(log0[0].by), JSON.stringify(log0));
  t.ok('a student cannot read the history', (await student.call('GET', `/api/logistics/prizes/${A}/log`)).s === 403);

  // ---- correcting the count (a recount)
  t.ok('an officer cannot correct a count', (await officer.call('PATCH', '/api/logistics/prizes', { id: A, quantity: 5 })).s === 403);
  const fix = await exec.call('PATCH', '/api/logistics/prizes', { id: A, quantity: 12, expected_quantity: 10, note: 'Found two more' });
  t.ok('exec corrects the count with a reason, and it shows in the history', fix.s === 200 && fix.j.prize.quantity === 12 && (await log(A))[0].kind === 'correct' && (await log(A))[0].qty === 2 && (await log(A))[0].note === 'Found two more');
  const stale = await exec2.call('PATCH', '/api/logistics/prizes', { id: A, quantity: 20, expected_quantity: 10 });
  t.ok('a second person who was looking at the old count is refused and told what it is now and who changed it', stale.s === 409 && stale.j.code === 'changed' && stale.j.current === 12 && /ZZ/.test(stale.j.by), JSON.stringify(stale.j));
  t.ok('their change did not go in', (await officer.call('GET', '/api/logistics/prizes')).j.prizes.find((x) => x.id === A).quantity === 12);
  const race = await Promise.all([exec.call('PATCH', '/api/logistics/prizes', { id: A, quantity: 14, expected_quantity: 12 }), exec2.call('PATCH', '/api/logistics/prizes', { id: A, quantity: 15, expected_quantity: 12 })]);
  t.ok('two people saving the same count at the same moment: exactly one goes in', race.filter((r) => r.s === 200).length === 1 && race.filter((r) => r.s === 409).length === 1, JSON.stringify(race.map((r) => r.s)));
  await exec.call('PATCH', '/api/logistics/prizes', { id: A, quantity: 12 });

  // ---- an event with stations
  const P = (await exec.call('POST', '/api/logistics/plans', { name: 'ZZ Prize Night', starts_on: day(0), ends_on: day(1) })).j.plan.id;
  t.ok('an officer cannot add a station', (await officer.call('POST', `/api/logistics/plans/${P}/stations`, { names: ['ZZ Raffle'], prize_only: true })).s === 403);
  const s1 = (await exec.call('POST', `/api/logistics/plans/${P}/stations`, { names: ['ZZ Raffle'], prize_only: true })).j.stations[0];
  const s2 = (await exec.call('POST', `/api/logistics/plans/${P}/stations`, { names: ['ZZ Hunt'] })).j.stations[0];
  t.ok('a station made only for prizes is marked, a team station is not', s1.prize_only === true && s2.prize_only === false);
  t.ok('a prize line needs a prize and a number', (await exec.call('POST', `/api/logistics/plans/${P}/prizes`, { station_id: s1.id, prize_id: A, quantity: 0 })).s === 400);
  const l1 = await exec.call('POST', `/api/logistics/plans/${P}/prizes`, { station_id: s1.id, items: [{ prize_id: A, quantity: 4 }, { prize_id: B, quantity: 100 }] });
  t.ok('several prizes are added to a station at once', l1.s === 201 && l1.j.lines.length === 2, JSON.stringify(l1.j));
  const dup = await exec.call('POST', `/api/logistics/plans/${P}/prizes`, { station_id: s1.id, prize_id: A, quantity: 1 });
  t.ok('a prize cannot be on the same station twice (and the answer says what it is there)', dup.s === 409 && dup.j.code === 'exists' && dup.j.current === 4, JSON.stringify(dup.j));
  const l2 = await exec.call('POST', `/api/logistics/plans/${P}/prizes`, { station_id: s2.id, prize_id: A, quantity: 3 });
  const LA1 = l1.j.lines.find((x) => x.prize_id === A).id, LB = l1.j.lines.find((x) => x.prize_id === B).id, LA2 = l2.j.lines[0].id;
  const pa = (await officer.call('GET', '/api/logistics/prizes')).j.prizes.find((x) => x.id === A);
  t.ok('on hand stays 12 while 7 are promised, so 5 are left', pa.quantity === 12 && pa.allocated === 7 && pa.left === 5, JSON.stringify(pa));
  const d = (await officer.call('GET', `/api/logistics/plans/${P}`)).j;
  t.ok('the plan lists its stations (with the prize-only mark), its lines and how many are left', d.stations.length === 2 && d.stations.find((x) => x.id === s1.id).prize_only === true && d.prizes.lines.length === 3 && d.prizes.lines.find((x) => x.id === LA1).station_id === s1.id && d.prizes.lines.find((x) => x.id === LA1).prize.left === 5 && d.prizes.steps.length === 5 && d.prizes.pools === undefined);
  t.ok('a station cannot be promised more than is left', (await exec.call('POST', `/api/logistics/plans/${P}/prizes`, { station_id: s2.id, prize_id: B, quantity: 450 })).s === 409 && (await exec.call('POST', `/api/logistics/plans/${P}/prizes`, { station_id: s2.id, prize_id: B, quantity: 400 })).s === 201);
  t.ok('over-promising still shows if the stock is lowered afterwards', (await exec.call('PATCH', '/api/logistics/prizes', { id: B, quantity: 450 })).s === 200 && (await officer.call('GET', '/api/logistics/prizes')).j.prizes.find((x) => x.id === B).left === -50);
  t.ok('a line cannot be raised past what is left', (await exec.call('PATCH', `/api/logistics/plans/${P}/prizes`, { line_id: LB, quantity: 120 })).s === 409);
  t.ok('a prize on a line cannot be deleted', (await exec.call('DELETE', '/api/logistics/prizes', { id: A })).s === 409);
  t.ok('an officer cannot change a line', (await officer.call('PATCH', `/api/logistics/plans/${P}/prizes`, { line_id: LA1, quantity: 5 })).s === 403);

  // ---- two people changing a station's number
  const stale2 = await exec2.call('PATCH', `/api/logistics/plans/${P}/prizes`, { line_id: LA1, quantity: 6, expected: 3 });
  t.ok('a number someone else already changed is refused, with what it is and who changed it', stale2.s === 409 && stale2.j.code === 'changed' && stale2.j.current === 4, JSON.stringify(stale2.j));
  const lineRace = await Promise.all([exec.call('PATCH', `/api/logistics/plans/${P}/prizes`, { line_id: LA1, quantity: 5, expected: 4 }), exec2.call('PATCH', `/api/logistics/plans/${P}/prizes`, { line_id: LA1, quantity: 6, expected: 4 })]);
  t.ok('two people saving the same number at the same moment: exactly one goes in', lineRace.filter((r) => r.s === 200).length === 1 && lineRace.filter((r) => r.s === 409).length === 1, JSON.stringify(lineRace.map((r) => r.s)));
  const nowLine = (await officer.call('GET', `/api/logistics/plans/${P}`)).j.prizes.lines.find((x) => x.id === LA1).quantity;
  await exec.call('PATCH', `/api/logistics/plans/${P}/prizes`, { line_id: LA1, quantity: 4, expected: nowLine });
  const gone = await exec.call('POST', `/api/logistics/plans/${P}/prizes`, { station_id: s2.id, prize_id: A, quantity: 1 });
  t.ok('adding a prize that someone just added is told so', gone.s === 409 && gone.j.code === 'exists');
  t.ok('the history records what was promised where', (await log(A)).filter((e) => e.kind === 'assign' && e.station === 'ZZ Raffle' && e.plan_name === 'ZZ Prize Night').length >= 1);

  // ---- event-day counters (any officer)
  t.ok('a student cannot set a count', (await student.call('POST', `/api/logistics/plans/${P}/prize-steps`, { line_id: LA1, step_id: sid('Sorted'), done: 1 })).s === 403);
  const c1 = await officer.call('POST', `/api/logistics/plans/${P}/prize-steps`, { line_id: LA1, step_id: sid('Sorted'), done: 3 });
  t.ok('an officer sets a count', c1.s === 200 && c1.j.done === 3);
  const c2 = await officer.call('POST', `/api/logistics/plans/${P}/prize-steps`, { line_id: LA1, step_id: sid('Sorted'), done: 99 });
  t.ok('a count cannot pass how many the line has', c2.j.done === 4 && c2.j.capped === true, JSON.stringify(c2.j));
  t.ok('a negative typed count is refused', (await officer.call('POST', `/api/logistics/plans/${P}/prize-steps`, { line_id: LA1, step_id: sid('Sorted'), done: -1 })).s === 400);
  await officer.call('POST', `/api/logistics/plans/${P}/prize-steps`, { line_id: LA1, step_id: sid('Sorted'), done: 0 });
  const taps = await Promise.all(Array.from({ length: 4 }, (_, i) => (i % 2 ? officer : exec2).call('POST', `/api/logistics/plans/${P}/prize-steps`, { line_id: LA1, step_id: sid('Sorted'), add: 1 })));
  const afterTaps = (await officer.call('GET', `/api/logistics/plans/${P}`)).j.prizes.done.find((x) => x.line_id === LA1 && x.step_id === sid('Sorted'))?.done;
  t.ok('four taps from two phones at the same moment all count (never 3)', taps.every((r) => r.s === 200) && afterTaps === 4, JSON.stringify([taps.map((r) => r.j.done), afterTaps]));
  const over = await officer.call('POST', `/api/logistics/plans/${P}/prize-steps`, { line_id: LA1, step_id: sid('Sorted'), add: 5 });
  t.ok('a tap past the top stays at the top', over.s === 200 && over.j.done === 4);
  const down = await officer.call('POST', `/api/logistics/plans/${P}/prize-steps`, { line_id: LA1, step_id: sid('Picked Up'), add: -3 });
  t.ok('a tap below nothing stays at nothing', down.s === 200 && down.j.done === 0);
  const staleCount = await exec2.call('POST', `/api/logistics/plans/${P}/prize-steps`, { line_id: LA1, step_id: sid('Sorted'), done: 1, expected: 2 });
  t.ok('a typed count over one someone else changed is refused with the new count', staleCount.s === 409 && staleCount.j.code === 'changed' && staleCount.j.current === 4, JSON.stringify(staleCount.j));
  // Giving out takes stock out as it is counted, and lowering the count puts it back.
  const stock0 = (await officer.call('GET', '/api/logistics/prizes')).j.prizes.find((x) => x.id === A).quantity;
  await officer.call('POST', `/api/logistics/plans/${P}/prize-steps`, { line_id: LA1, step_id: sid('Given Out'), add: 3 });
  const stock1 = (await officer.call('GET', '/api/logistics/prizes')).j.prizes.find((x) => x.id === A);
  t.ok('three given out takes three out of stock (12 → 9) and they are no longer promised (left stays 5)', stock0 === 12 && stock1.quantity === 9 && stock1.allocated === 4 && stock1.left === 5, JSON.stringify([stock0, stock1]));
  t.ok('the history says so', (await log(A)).some((e) => e.kind === 'give' && e.qty === -3 && e.station === 'ZZ Raffle'));
  const back = await officer.call('POST', `/api/logistics/plans/${P}/prize-steps`, { line_id: LA1, step_id: sid('Back To Storage'), done: 4 });
  t.ok('Back To Storage can only count what was not given out (4 − 3)', back.j.done === 1, JSON.stringify(back.j));
  await officer.call('POST', `/api/logistics/plans/${P}/prize-steps`, { line_id: LA1, step_id: sid('Given Out'), add: -1 });
  t.ok('lowering Given Out puts one back in stock (9 → 10)', (await officer.call('GET', '/api/logistics/prizes')).j.prizes.find((x) => x.id === A).quantity === 10);
  // A count is not a change of the plan's makeup: it never bumps the plan stamp, and other phones read it from the version check.
  const stampBefore = (await officer.call('GET', `/api/logistics/plans/${P}/version`)).j.updated_at;
  const lastCount = (await svc.from('logistics_plan_prize_steps').select('updated_at').eq('plan_id', P).order('updated_at', { ascending: false }).limit(1)).data[0].updated_at;
  await officer.call('POST', `/api/logistics/plans/${P}/prize-steps`, { line_id: LA1, step_id: sid('Picked Up'), add: 2 });
  const ver = (await officer.call('GET', `/api/logistics/plans/${P}/version?prize_since=${encodeURIComponent(lastCount)}`)).j;
  t.ok('a prize count does not bump the plan stamp', ver.updated_at === stampBefore, JSON.stringify([stampBefore, ver.updated_at]));
  t.ok('the version check reports prize counts changed since a time', Array.isArray(ver.prize_changes) && ver.prize_changes.some((c) => c.line_id === LA1 && c.step_id === sid('Picked Up') && c.done === 2), JSON.stringify(ver.prize_changes));
  t.ok('lowering a line also lowers counts above it', (await exec.call('PATCH', `/api/logistics/plans/${P}/prizes`, { line_id: LA1, quantity: 3, expected: 4 })).s === 200 && (await officer.call('GET', `/api/logistics/plans/${P}`)).j.prizes.done.filter((x) => x.line_id === LA1).every((x) => x.done <= 3));

  // ---- editing the lists
  const order0 = (await officer.call('GET', '/api/logistics')).j.lists.prize_step.map((x) => x.value);
  const mv = await exec.call('PATCH', '/api/logistics/options', { id: sid('Sorted'), move: 'down' });
  const order = (await officer.call('GET', '/api/logistics')).j.lists.prize_step.map((x) => x.value);
  t.ok('prize steps can be moved', mv.s === 200 && order.indexOf('Sorted') === order0.indexOf('Sorted') + 1, order.join());
  await exec.call('PATCH', '/api/logistics/options', { id: sid('Sorted'), move: 'up' });
  t.ok('a used prize step cannot be deleted', (await exec.call('DELETE', '/api/logistics/options', { id: sid('Sorted') })).s === 409);
  const sz = await exec.call('POST', '/api/logistics/options', { kind: 'prize_size', value: 'ZZ Size' });
  await exec.call('PATCH', '/api/logistics/prizes', { id: B, size: 'ZZ Size' });
  t.ok('a size in use cannot be deleted', (await exec.call('DELETE', '/api/logistics/options', { id: sz.j.option.id })).s === 409);
  t.ok('renaming a size renames it on the prizes', (await exec.call('PATCH', '/api/logistics/options', { id: sz.j.option.id, value: 'ZZ Size Two' })).s === 200 && (await officer.call('GET', '/api/logistics/prizes')).j.prizes.find((x) => x.id === B).size === 'ZZ Size Two');

  // ---- taking a station away
  const stockA = (await officer.call('GET', '/api/logistics/prizes')).j.prizes.find((x) => x.id === A);
  t.ok('removing a station takes its prizes off it (no longer promised)', (await exec.call('DELETE', `/api/logistics/plans/${P}/stations`, { station_id: s2.id })).s === 200 && (await officer.call('GET', `/api/logistics/plans/${P}`)).j.prizes.lines.length === 2 && (await officer.call('GET', '/api/logistics/prizes')).j.prizes.find((x) => x.id === A).allocated === stockA.allocated - 3);
  t.ok('and the history says the station was removed', (await log(A)).some((e) => e.kind === 'assign' && e.qty === -3 && e.note === 'Station removed'));

  // ---- closing an event: what went out and was not counted back leaves stock; the rest is free again
  const C = (await exec.call('POST', '/api/logistics/prizes', { name: 'ZZ Pen', quantity: 10, size: 'Free' })).j.prize.id;
  const D = (await exec.call('POST', '/api/logistics/prizes', { name: 'ZZ Cup', quantity: 10, size: 'Free' })).j.prize.id;
  const P2 = (await exec.call('POST', '/api/logistics/plans', { name: 'ZZ Close Night', starts_on: day(2), ends_on: day(2) })).j.plan.id;
  const s3 = (await exec.call('POST', `/api/logistics/plans/${P2}/stations`, { names: ['ZZ Booth'], prize_only: true })).j.stations[0];
  const l3 = await exec.call('POST', `/api/logistics/plans/${P2}/prizes`, { station_id: s3.id, items: [{ prize_id: C, quantity: 4 }, { prize_id: D, quantity: 6 }] });
  const LC = l3.j.lines.find((x) => x.prize_id === C).id;
  await officer.call('POST', `/api/logistics/plans/${P2}/prize-steps`, { line_id: LC, step_id: sid('Back To Storage'), done: 1 });
  const stockOf = async (id) => (await officer.call('GET', '/api/logistics/prizes')).j.prizes.find((x) => x.id === id);
  t.ok('an officer cannot close an event', (await officer.call('PATCH', `/api/logistics/plans/${P2}`, { status: 'closed' })).s === 403);
  const noWay = await exec.call('PATCH', `/api/logistics/plans/${P2}`, { status: 'closed' });
  t.ok('closing with a line nobody counted back is refused and the lines are listed', noWay.s === 409 && noWay.j.code === 'uncounted' && noWay.j.uncounted.length === 1 && noWay.j.uncounted[0].prize === 'ZZ Cup' && noWay.j.uncounted[0].quantity === 6, JSON.stringify(noWay.j));
  t.ok('nothing changed by that refusal', (await stockOf(D)).quantity === 10 && (await stockOf(C)).quantity === 10);
  const shut = await exec.call('PATCH', `/api/logistics/plans/${P2}`, { status: 'closed', uncounted: 'given' });
  t.ok('closing says: the pens counted back (1 of 4) mean 3 went out; the cups taken as given out mean 6 went out', shut.s === 200 && (await stockOf(C)).quantity === 7 && (await stockOf(D)).quantity === 4, JSON.stringify([await stockOf(C), await stockOf(D)]));
  t.ok('a closed event holds nothing, so what is left is what is on hand', (await stockOf(C)).allocated === 0 && (await stockOf(C)).left === 7 && (await stockOf(D)).left === 4);
  t.ok('a closed plan takes no more counts', (await officer.call('POST', `/api/logistics/plans/${P2}/prize-steps`, { line_id: LC, step_id: sid('Sorted'), add: 1 })).s === 409);
  t.ok('the history shows what closing took out', (await log(D)).some((e) => e.kind === 'give' && e.qty === -6 && e.plan_name === 'ZZ Close Night'));
  t.ok('reopening puts it all back (pens 10, cups 10) and removes those history lines', (await exec.call('PATCH', `/api/logistics/plans/${P2}`, { status: 'draft' })).s === 200 && (await stockOf(C)).quantity === 10 && (await stockOf(D)).quantity === 10 && !(await log(D)).some((e) => e.qty === -6));
  const shut2 = await exec.call('PATCH', `/api/logistics/plans/${P2}`, { status: 'closed', uncounted: 'returned' });
  t.ok('closing and taking the uncounted as returned: only the pens that were not counted back leave (3)', shut2.s === 200 && (await stockOf(C)).quantity === 7 && (await stockOf(D)).quantity === 10);

  // ---- tidying up
  t.ok('exec deletes the plan, and its stations, lines and counts go with it', (await exec.call('DELETE', `/api/logistics/plans/${P}`)).s === 200);
  t.ok('then the prize can be deleted', (await exec.call('DELETE', '/api/logistics/prizes', { id: A })).s === 200);
  const { count: left } = await svc.from('logistics_plan_prizes').select('id', { count: 'exact', head: true }).eq('plan_id', P);
  t.ok('nothing of the plan is left behind', left === 0);
  const { count: logLeft } = await svc.from('logistics_prize_log').select('id', { count: 'exact', head: true }).eq('prize_id', A);
  t.ok('a deleted prize takes its history with it', logLeft === 0);
  void LA2;
} finally {
  await svc.from('logistics_plans').delete().like('name', 'ZZ%');
  await svc.from('logistics_prizes').delete().like('name', 'ZZ%');
  await svc.from('logistics_sponsors').delete().like('name', 'ZZ%');
  await svc.from('logistics_options').delete().like('value', 'ZZ%');
  await svc.from('audit_log').delete().in('actor_id', made);
  await cleanup();
}
process.exit(t.result());

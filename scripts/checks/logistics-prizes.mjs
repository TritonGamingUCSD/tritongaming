// Logistics stage 3 (prizes: inventory, pools, lines, event-day counts), end to end against a running dev server as temporary "ZZ" accounts.
// It only writes ZZ prizes, plans, sponsors and list entries, all deleted at the end.
// Run: BASE_URL=http://localhost:3222 node scripts/checks/logistics-prizes.mjs
import { accounts, svc, day, tracker } from './lib.mjs';

const t = tracker();
const { user, made, cleanup } = accounts('logiprize');
try {
  const exec = await user('exec', ['exec']);
  const officer = await user('officer', ['officer']);
  const student = await user('student', ['ucsd']);
  const boot = (await officer.call('GET', '/api/logistics')).j;
  t.ok('the prize lists and steps are there', boot.lists.prize_size.length >= 3 && ['Sorted', 'Picked Up', 'Given Out', 'Back To Storage'].every((n) => boot.lists.prize_step.some((x) => x.value === n)) && boot.lists.prize_step.length === 5, JSON.stringify(boot.lists.prize_step));
  const steps = Object.fromEntries(boot.lists.prize_step.map((s) => [s.value, s]));
  t.ok('Given Out gives prizes out and Back To Storage counts only what is left', steps['Given Out'].gives === true && steps['Back To Storage'].leftover === true);

  // ---- the inventory
  t.ok('a student cannot see prizes', (await student.call('GET', '/api/logistics/prizes')).s === 403);
  t.ok('an officer can see prizes', (await officer.call('GET', '/api/logistics/prizes')).s === 200);
  t.ok('an officer cannot add a prize', (await officer.call('POST', '/api/logistics/prizes', { name: 'ZZ Mouse', quantity: 3 })).s === 403);
  t.ok('a prize needs a name', (await exec.call('POST', '/api/logistics/prizes', { name: ' ', quantity: 3 })).s === 400);
  t.ok('a price must be a number', (await exec.call('POST', '/api/logistics/prizes', { name: 'ZZ Bad', price: 'lots', quantity: 1 })).s === 400);
  const sp = await exec.call('POST', '/api/logistics/sponsors', { name: 'ZZ Prize Sponsor' });
  const a = await exec.call('POST', '/api/logistics/prizes', { name: 'ZZ Mouse', sponsor_id: sp.j.sponsor.id, size: 'Small Prizing', price: 24.5, quantity: 10 });
  t.ok('exec adds a prize', a.s === 201 && a.j.prize.left === 10 && a.j.prize.price === 24.5, JSON.stringify(a.j));
  t.ok('a new prize is in hand unless it says otherwise, and has a free-text type', a.j.prize.in_hand === false || a.j.prize.in_hand === true);
  const typed = await exec.call('PATCH', '/api/logistics/prizes', { id: a.j.prize.id, type: 'Wireless mouse', in_hand: false });
  t.ok('a prize can have a type and be marked not here yet', typed.s === 200 && typed.j.prize.type === 'Wireless mouse' && typed.j.prize.in_hand === false, JSON.stringify(typed.j));
  const holds = await exec.call('GET', `/api/logistics/prizes/${a.j.prize.id}/holds`);
  t.ok('who holds a prize can be read', holds.s === 200 && Array.isArray(holds.j.holds));
  await exec.call('PATCH', '/api/logistics/prizes', { id: a.j.prize.id, in_hand: true });
  const held = await exec.call('PATCH', '/api/logistics/prizes', { id: a.j.prize.id, in_hand: false });
  t.ok('a prize can be marked as not here yet, and back', held.s === 200 && held.j.prize.in_hand === false && (await exec.call('PATCH', '/api/logistics/prizes', { id: a.j.prize.id, in_hand: true })).j.prize.in_hand === true);
  t.ok('who holds a prize can be looked up', (await officer.call('GET', `/api/logistics/prizes/${a.j.prize.id}/holds`)).s === 200);
  const b = await exec.call('POST', '/api/logistics/prizes', { name: 'ZZ Soda', price: 3, quantity: 500, quantity_is_estimate: true });
  const A = a.j.prize.id, B = b.j.prize.id;
  t.ok('a quantity can be an estimate', b.s === 201 && b.j.prize.quantity_is_estimate === true);
  t.ok('a prize can be edited', (await exec.call('PATCH', '/api/logistics/prizes', { id: A, quantity: 12, expires_on: '2027-01-01' })).j.prize.quantity === 12);

  // ---- a plan with pools and lines
  const P = (await exec.call('POST', '/api/logistics/plans', { name: 'ZZ Prize Night', starts_on: day(0), ends_on: day(1) })).j.plan.id;
  const st = (await exec.call('POST', `/api/logistics/plans/${P}/stations`, { name: 'ZZ Team' })).j.stations[0];
  t.ok('an officer cannot make a pool', (await officer.call('POST', `/api/logistics/plans/${P}/pools`, { name: 'ZZ Raffle' })).s === 403);
  t.ok('a pool needs a name', (await exec.call('POST', `/api/logistics/plans/${P}/pools`, { name: '' })).s === 400);
  const pool1 = (await exec.call('POST', `/api/logistics/plans/${P}/pools`, { name: 'ZZ Raffle', station_id: st.id })).j.pool;
  const pool2 = (await exec.call('POST', `/api/logistics/plans/${P}/pools`, { name: 'ZZ Hunt' })).j.pool;
  t.ok('a pool can be linked to a team', pool1.station_id === st.id && pool2.station_id === null);
  t.ok('a prize line needs a prize and a number', (await exec.call('POST', `/api/logistics/plans/${P}/prizes`, { pool_id: pool1.id, prize_id: A, quantity: 0 })).s === 400);
  const l1 = await exec.call('POST', `/api/logistics/plans/${P}/prizes`, { pool_id: pool1.id, items: [{ prize_id: A, quantity: 4 }, { prize_id: B, quantity: 100 }] });
  t.ok('several prizes are added to a pool at once', l1.s === 201 && l1.j.lines.length === 2, JSON.stringify(l1.j));
  t.ok('a prize cannot be in the same pool twice', (await exec.call('POST', `/api/logistics/plans/${P}/prizes`, { pool_id: pool1.id, prize_id: A, quantity: 1 })).s === 409);
  const l2 = await exec.call('POST', `/api/logistics/plans/${P}/prizes`, { pool_id: pool2.id, prize_id: A, quantity: 3 });
  const LA1 = l1.j.lines.find((x) => x.prize_id === A).id, LB = l1.j.lines.find((x) => x.prize_id === B).id, LA2 = l2.j.lines[0].id;
  const inv = (await officer.call('GET', '/api/logistics/prizes')).j.prizes;
  const pa = inv.find((x) => x.id === A);
  t.ok('promised and left follow the lines (12 in stock, 7 promised)', pa.allocated === 7 && pa.left === 5, JSON.stringify(pa));
  const d = (await officer.call('GET', `/api/logistics/plans/${P}`)).j;
  t.ok('the plan lists its pools, lines, and how many are left', d.prizes.pools.length === 2 && d.prizes.lines.length === 3 && d.prizes.lines.find((x) => x.id === LA1).prize.left === 5 && d.prizes.steps.length === 5);
  t.ok('a pool cannot be promised more than is left', (await exec.call('POST', `/api/logistics/plans/${P}/prizes`, { pool_id: pool2.id, prize_id: B, quantity: 450 })).s === 409 && (await exec.call('POST', `/api/logistics/plans/${P}/prizes`, { pool_id: pool2.id, prize_id: B, quantity: 400 })).s === 201);
  t.ok('over-promising still shows if the stock is lowered afterwards', (await exec.call('PATCH', '/api/logistics/prizes', { id: B, quantity: 450 })).s === 200 && (await officer.call('GET', '/api/logistics/prizes')).j.prizes.find((x) => x.id === B).left === -50);
  t.ok('a line cannot be raised past what is left', (await exec.call('PATCH', `/api/logistics/plans/${P}/prizes`, { line_id: LB, quantity: 120 })).s === 409);
  t.ok('a prize on a line cannot be deleted', (await exec.call('DELETE', '/api/logistics/prizes', { id: A })).s === 409);

  // ---- event-day counts (any officer)
  const sid = (n) => steps[n].id;
  t.ok('a student cannot set a count', (await student.call('POST', `/api/logistics/plans/${P}/prize-steps`, { line_id: LA1, step_id: sid('Sorted'), done: 1 })).s === 403);
  const c1 = await officer.call('POST', `/api/logistics/plans/${P}/prize-steps`, { line_id: LA1, step_id: sid('Sorted'), done: 3 });
  t.ok('an officer sets a count', c1.s === 200 && c1.j.done === 3);
  const c2 = await officer.call('POST', `/api/logistics/plans/${P}/prize-steps`, { line_id: LA1, step_id: sid('Sorted'), done: 99 });
  t.ok('a count cannot pass how many the line has', c2.j.done === 4 && c2.j.capped === true, JSON.stringify(c2.j));
  t.ok('a negative count is refused', (await officer.call('POST', `/api/logistics/plans/${P}/prize-steps`, { line_id: LA1, step_id: sid('Sorted'), done: -1 })).s === 400);
  await officer.call('POST', `/api/logistics/plans/${P}/prize-steps`, { line_id: LA1, step_id: sid('Given Out'), done: 3 });
  const back = await officer.call('POST', `/api/logistics/plans/${P}/prize-steps`, { line_id: LA1, step_id: sid('Back To Storage'), done: 4 });
  t.ok('Back To Storage can only count what was not given out (4 − 3)', back.j.done === 1, JSON.stringify(back.j));
  const inv2 = (await officer.call('GET', '/api/logistics/prizes')).j.prizes.find((x) => x.id === A);
  t.ok('giving out uses stock up: 3 given, 3 still promised to the other pool, 6 left', inv2.given === 3 && inv2.allocated === 4 && inv2.left === 5, JSON.stringify(inv2));
  const d2 = (await officer.call('GET', `/api/logistics/plans/${P}`)).j;
  t.ok('the plan shows the counts', d2.prizes.done.find((x) => x.line_id === LA1 && x.step_id === sid('Given Out'))?.done === 3);
  t.ok('lowering a line also lowers counts above it', (await exec.call('PATCH', `/api/logistics/plans/${P}/prizes`, { line_id: LA1, quantity: 2 })).s === 200 && (await officer.call('GET', `/api/logistics/plans/${P}`)).j.prizes.done.filter((x) => x.line_id === LA1).every((x) => x.done <= 2));
  t.ok('an officer cannot change a line', (await officer.call('PATCH', `/api/logistics/plans/${P}/prizes`, { line_id: LA1, quantity: 5 })).s === 403);

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

  // ---- a closed plan, removing
  t.ok('removing a pool removes its lines', (await exec.call('DELETE', `/api/logistics/plans/${P}/pools`, { pool_id: pool2.id })).s === 200 && (await officer.call('GET', `/api/logistics/plans/${P}`)).j.prizes.lines.length === 2);
  // ---- the Keep list: kept prizes only go back to stock when moved by hand after the event is closed
  const KEEPS = `/api/logistics/plans/${P}/keeps`;
  const lbLine = (await officer.call('GET', `/api/logistics/plans/${P}`)).j.prizes.lines.find((x) => x.id === LB);
  const bBefore = (await officer.call('GET', '/api/logistics/prizes')).j.prizes.find((x) => x.id === B);
  t.ok('an officer cannot keep a prize', (await officer.call('POST', KEEPS, { prize_id: B, quantity: 1 })).s === 403);
  t.ok('a prize can be put on the Keep list while the event is open', (await exec.call('POST', KEEPS, { prize_id: B, quantity: 1 })).s === 201 && (await exec.call('POST', KEEPS, { prize_id: A, quantity: 1 })).s === 201);
  t.ok('a prize that is not in the event cannot be kept', (await exec.call('POST', KEEPS, { prize_id: '00000000-0000-4000-8000-000000000000', quantity: 1 })).s === 400);
  const bKept = (await officer.call('GET', '/api/logistics/prizes')).j.prizes.find((x) => x.id === B);
  t.ok('keeping changes nothing about stock yet', bKept.left === bBefore.left && bKept.allocated === bBefore.allocated, JSON.stringify([bBefore, bKept]));
  t.ok('nothing can be moved while the event is open', (await exec.call('PATCH', KEEPS, {})).s === 409);
  await exec.call('PATCH', `/api/logistics/plans/${P}`, { status: 'closed' });
  t.ok('a closed plan takes no more counts', (await officer.call('POST', `/api/logistics/plans/${P}/prize-steps`, { line_id: LB, step_id: sid('Sorted'), done: 1 })).s === 409);
  const afterClose = (await officer.call('GET', '/api/logistics/prizes')).j.prizes.find((x) => x.id === A);
  t.ok('a closed plan no longer holds stock (only what was given out is gone)', afterClose.allocated === 0 && afterClose.given === 2, JSON.stringify(afterClose));
  const bClosed = (await officer.call('GET', '/api/logistics/prizes')).j.prizes.find((x) => x.id === B);
  t.ok('closing does not put anything back in stock by itself', bClosed.allocated === 0 && bClosed.given === bBefore.given + lbLine.quantity, JSON.stringify([bBefore.given, lbLine.quantity, bClosed]));
  const mvKeep = await exec.call('PATCH', KEEPS, {});
  t.ok('moving puts the kept prize back in stock, and skips what was all given out', mvKeep.s === 200 && mvKeep.j.moved === 1 && mvKeep.j.skipped.includes(A), JSON.stringify(mvKeep.j));
  const bMoved = (await officer.call('GET', '/api/logistics/prizes')).j.prizes.find((x) => x.id === B);
  t.ok('only the moved amount is back in stock', bMoved.given === bClosed.given - 1 && bMoved.left === bClosed.left + 1, JSON.stringify(bMoved));
  t.ok('a moved prize cannot be changed or moved again', (await exec.call('POST', KEEPS, { prize_id: B, quantity: 2 })).s === 409 && (await exec.call('DELETE', KEEPS, { prize_id: B })).s === 409);
  t.ok('exec deletes the plan, and its pools, lines and counts go with it', (await exec.call('DELETE', `/api/logistics/plans/${P}`)).s === 200);
  t.ok('then the prize can be deleted', (await exec.call('DELETE', '/api/logistics/prizes', { id: A })).s === 200);
  const { count: left } = await svc.from('logistics_plan_prizes').select('id', { count: 'exact', head: true }).eq('plan_id', P);
  t.ok('nothing of the plan is left behind', left === 0);
} finally {
  await svc.from('logistics_plans').delete().like('name', 'ZZ%');
  await svc.from('logistics_prizes').delete().like('name', 'ZZ%');
  await svc.from('logistics_sponsors').delete().like('name', 'ZZ%');
  await svc.from('logistics_options').delete().like('value', 'ZZ%');
  await svc.from('audit_log').delete().in('actor_id', made);
  await cleanup();
}
process.exit(t.result());

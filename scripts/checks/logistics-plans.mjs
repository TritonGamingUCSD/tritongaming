// Logistics stage 2 (event plans, choosing devices, stations, the event-day steps, swaps), end to end against a running dev server as temporary "ZZ" accounts.
// It reads the real catalog (to choose devices) but only ever writes to its own "ZZ" plans, devices, steps and list entries, all deleted at the end.
// Run: BASE_URL=http://localhost:3222 node scripts/checks/logistics-plans.mjs
import { accounts, svc, day, tracker } from './lib.mjs';

const t = tracker();
const { user, made, cleanup } = accounts('logiplan');
try {
  const exec = await user('exec', ['exec']);
  const officer = await user('officer', ['officer']);
  const student = await user('student', ['ucsd']);
  const today = day(0), tomorrow = day(1), nextMonth = day(30);

  // ---- plans
  t.ok('a student cannot list plans', (await student.call('GET', '/api/logistics/plans')).s === 403);
  t.ok('an officer can list plans', (await officer.call('GET', '/api/logistics/plans')).s === 200);
  t.ok('an officer cannot make a plan', (await officer.call('POST', '/api/logistics/plans', { name: 'ZZ Plan', starts_on: today, ends_on: today })).s === 403);
  t.ok('a plan needs a name', (await exec.call('POST', '/api/logistics/plans', { starts_on: today, ends_on: today })).s === 400);
  t.ok('the last day cannot be before the first', (await exec.call('POST', '/api/logistics/plans', { name: 'ZZ Bad', starts_on: tomorrow, ends_on: today })).s === 400);
  const p1 = await exec.call('POST', '/api/logistics/plans', { name: 'ZZ Plan One', starts_on: today, ends_on: tomorrow });
  t.ok('exec makes a Logistics-only plan', p1.s === 201 && p1.j.plan?.event_id === null, JSON.stringify(p1));
  const P1 = p1.j.plan.id;
  const ev = await officer.call('GET', '/api/logistics/plans?events=1');
  t.ok('the upcoming events can be listed for the picker', ev.s === 200 && Array.isArray(ev.j.events));
  const boot = await officer.call('GET', '/api/logistics');
  t.ok('a plan happening today shows in the catalog bootstrap (the banner)', boot.j.todayPlans?.some((p) => p.id === P1), JSON.stringify(boot.j.todayPlans));
  t.ok('the starting steps and bundles are there', ['Left Storage', 'Box Returned', 'Check done', 'Box Taken', 'Back to Storage', 'Returned to owner'].every((n, i, a) => boot.j.lists.step.some((x) => x.value === n) && (i === 0 || boot.j.lists.step.findIndex((x) => x.value === n) > boot.j.lists.step.findIndex((x) => x.value === a[i - 1]))) && boot.j.lists.bundle.length >= 3, JSON.stringify(boot.j.lists.step));
  const steps = Object.fromEntries(boot.j.lists.step.map((s) => [s.value, s]));
  t.ok('Check done reviews the kit, Back to Storage is club-only, Returned to owner is borrowed-only', steps['Check done'].kit === true && steps['Back to Storage'].applies === 'club' && steps['Returned to owner'].applies === 'borrowed');
  const sw = boot.j.lists.bundle.find((b) => b.value === 'Switch Station');
  t.ok('the Switch Station has no TV', !sw.items.some((i) => i.type === 'TV') && sw.items.length === 3, JSON.stringify(sw.items));

  // ---- choosing devices
  const pc = boot.j.lists.bundle.find((b) => b.value === 'PC Station');
  const prev = await exec.call('POST', `/api/logistics/plans/${P1}/pick`, { bundle_id: pc.id, count: 2 });
  t.ok('a bundle previews whole stations', prev.s === 200 && prev.j.preview.stations.length === 2 && prev.j.preview.stations[0].length === 5, JSON.stringify(prev.j).slice(0, 200));
  t.ok('a preview changes nothing', (await exec.call('GET', `/api/logistics/plans/${P1}`)).j.items.length === 0);
  t.ok('an officer cannot choose devices', (await officer.call('POST', `/api/logistics/plans/${P1}/pick`, { bundle_id: pc.id, count: 1, apply: true })).s === 403);
  const app = await exec.call('POST', `/api/logistics/plans/${P1}/pick`, { bundle_id: pc.id, count: 2, apply: true });
  const d1 = (await exec.call('GET', `/api/logistics/plans/${P1}`)).j;
  t.ok('applying makes the stations and puts a set at each', app.s === 200 && d1.stations.map((s) => s.name).join() === 'PC Station 1,PC Station 2' && d1.items.length === 10, JSON.stringify(d1.stations));
  const setIds = d1.stations.map((st) => new Set([...d1.items, ...d1.slots].filter((x) => x.station_id === st.id).map((x) => x.set_id)));
  t.ok('the parts of one bundle share a set, and each station has its own', setIds.every((x) => x.size === 1 && !x.has(null) && !x.has(undefined)) && setIds[0].values().next().value !== setIds[1].values().next().value, JSON.stringify([...setIds].map((x) => [...x])));
  t.ok('the plan has a short permanent name for its address', /^zz-plan-one(-\d{4})?(-\d+)?$/.test(p1.j.plan.slug), p1.j.plan.slug);
  await exec.call('PATCH', `/api/logistics/plans/${P1}`, { name: 'ZZ Plan One Renamed' });
  t.ok('renaming the plan never changes its address name', (await exec.call('GET', `/api/logistics/plans/${P1}`)).j.plan.slug === p1.j.plan.slug);
  await exec.call('PATCH', `/api/logistics/plans/${P1}`, { name: 'ZZ Plan One', slug: 'something-else' });
  t.ok('the address name cannot be set by hand', (await exec.call('GET', `/api/logistics/plans/${P1}`)).j.plan.slug === p1.j.plan.slug);
  const first = prev.j.preview.stations[0].map((c) => c.device?.id).sort().join();
  t.ok('what was previewed is what was added', d1.items.filter((i) => i.station_id === d1.stations[0].id).map((i) => i.device_id).sort().join() === first);
  const app2 = await exec.call('POST', `/api/logistics/plans/${P1}/pick`, { bundle_id: pc.id, count: 1, apply: true });
  const d2 = (await exec.call('GET', `/api/logistics/plans/${P1}`)).j;
  t.ok('choosing again never reuses a device, and numbering continues', app2.s === 200 && d2.stations.at(-1).name === 'PC Station 3' && new Set(d2.items.map((i) => i.device_id)).size === d2.items.length && d2.items.length === 15);
  const gm = await exec.call('POST', `/api/logistics/plans/${P1}/pick`, { type: 'Monitor', count: 2, games: ['Valorant'] });
  t.ok('a single type previews devices', gm.s === 200 && gm.j.preview.stations[0].filter((c) => c.device).length === 2);
  const pcs = await exec.call('POST', `/api/logistics/plans/${P1 }/pick`, { type: 'Gaming PC', count: 3, games: ['Valorant'] });
  t.ok('devices with the game installed come first', pcs.j.preview.stations[0].slice(0, 1).every((c) => !c.device || c.device.tag) && pcs.s === 200);
  t.ok('an unknown bundle is refused', (await exec.call('POST', `/api/logistics/plans/${P1}/pick`, { bundle_id: '00000000-0000-0000-0000-000000000000', count: 1 })).s === 404);

  // overlapping plan: nothing already booked is offered again; a later plan can reuse them
  const p2 = (await exec.call('POST', '/api/logistics/plans', { name: 'ZZ Plan Two', starts_on: tomorrow, ends_on: tomorrow })).j.plan;
  const ov = await exec.call('POST', `/api/logistics/plans/${p2.id}/pick`, { type: 'Gaming PC', count: 20 });
  const bookedIds = new Set(d2.items.map((i) => i.device_id));
  t.ok('a plan on overlapping dates never gets devices already booked', ov.j.preview.stations[0].every((c) => !c.device || !bookedIds.has(c.device.id)));
  const p3 = (await exec.call('POST', '/api/logistics/plans', { name: 'ZZ Plan Later', starts_on: nextMonth, ends_on: nextMonth })).j.plan;
  const later = await exec.call('POST', `/api/logistics/plans/${p3.id}/pick`, { type: 'Gaming PC', count: 3 });
  t.ok('a plan on other dates can use the same devices', later.j.preview.stations[0].some((c) => c.device && bookedIds.has(c.device.id)));

  // ---- stations and moving devices
  const st = await exec.call('POST', `/api/logistics/plans/${P1}/stations`, { name: 'ZZ Main Stage' });
  t.ok('a station is added', st.s === 201 && st.j.stations[0].name === 'ZZ Main Stage');
  const stId = st.j.stations[0].id;
  const anyDev = d2.items[0].device_id;
  t.ok('devices move to a station', (await exec.call('PATCH', `/api/logistics/plans/${P1}/devices`, { device_ids: [anyDev], station_id: stId })).s === 200 && (await exec.call('GET', `/api/logistics/plans/${P1}`)).j.items.find((i) => i.device_id === anyDev).station_id === stId);
  t.ok('a station from another plan is refused', (await exec.call('PATCH', `/api/logistics/plans/${P1}/devices`, { device_ids: [anyDev], station_id: '00000000-0000-0000-0000-000000000000' })).s === 400);
  t.ok('renaming a station works', (await exec.call('PATCH', `/api/logistics/plans/${P1}/stations`, { station_id: stId, name: 'ZZ Main Stage 2' })).s === 200);
  t.ok('removing a station keeps its devices, unassigned', (await exec.call('DELETE', `/api/logistics/plans/${P1}/stations`, { station_id: stId })).s === 200 && (await exec.call('GET', `/api/logistics/plans/${P1}`)).j.items.find((i) => i.device_id === anyDev).station_id === null);
  t.ok('a device can be taken out of a plan', (await exec.call('DELETE', `/api/logistics/plans/${P1}/devices`, { device_ids: [anyDev] })).s === 200 && !(await exec.call('GET', `/api/logistics/plans/${P1}`)).j.items.some((i) => i.device_id === anyDev));

  // ---- the event-day steps (any officer), on throwaway devices
  const mk = async (tag, extra = {}) => (await exec.call('POST', '/api/logistics/devices', { tag, type: 'Monitor', shelf: 'Shelf A', tier: 'T1', ...extra })).j.device;
  const zA = await mk('ZZ-A', { kit: [{ item: 'Power cable', qty: 1, missing: false }, { item: 'HDMI cable', qty: 1, missing: false }] });
  const zB = await mk('ZZ-B');
  const zDead = await mk('ZZ-DEAD', { condition: 'dead' });
  await exec.call('POST', `/api/logistics/plans/${P1}/devices`, { device_ids: [zA.id, zDead.id] });

  // ---- sponsor and officer-loaner devices live inside ONE event (not the inventory)
  t.ok('an officer cannot add a borrowed device', (await officer.call('POST', `/api/logistics/plans/${P1}/borrowed`, { tag: 'ZZ-LOAN', type: 'Laptop', owner_kind: 'officer' })).s === 403);
  t.ok('a borrowed device needs an owner kind', (await exec.call('POST', `/api/logistics/plans/${P1}/borrowed`, { tag: 'ZZ-X', type: 'Laptop', owner_kind: 'nobody' })).s === 400);
  const loanR = await exec.call('POST', `/api/logistics/plans/${P1}/borrowed`, { tag: 'ZZ-LOAN', type: 'Gaming Laptop', owner_kind: 'officer', owner_user_id: officer.id, owner_note: 'in the blue bag', kit: [{ item: 'Charger', qty: 1, missing: false }] });
  t.ok('an officer’s loaner is added to the event', loanR.s === 201 && loanR.j.borrowed.owner_kind === 'officer', JSON.stringify(loanR));
  const zLoan = loanR.j.borrowed;
  const spR = await exec.call('POST', '/api/logistics/sponsors', { name: 'ZZ Logitech' });
  const spDev = await exec.call('POST', `/api/logistics/plans/${P1}/borrowed`, { tag: 'ZZ-SP1', type: 'Monitor', owner_kind: 'sponsor', sponsor_id: spR.j.sponsor.id, owner_user_id: officer.id });
  await exec.call('PATCH', `/api/logistics/plans/${P1}/borrowed`, { borrowed_id: spDev.j.borrowed.id, role: 'backup' });   // held as a spare until it is swapped in
  t.ok('a sponsor’s device keeps its sponsor and drops any officer', spDev.s === 201 && spDev.j.borrowed.sponsor_id === spR.j.sponsor.id && spDev.j.borrowed.owner_user_id === null, JSON.stringify(spDev));
  t.ok('the same ID cannot be used twice at one event, however it is typed', (await exec.call('POST', `/api/logistics/plans/${P1}/borrowed`, { tag: ' zz-LOAN ', type: 'Gaming Laptop', owner_kind: 'officer' })).s === 409);
  t.ok('a borrowed ID cannot be a club device’s ID', (await exec.call('POST', `/api/logistics/plans/${P1}/borrowed`, { tag: 'zz-a', type: 'Laptop', owner_kind: 'officer' })).s === 400);
  const otherEv = (await exec.call('POST', '/api/logistics/plans', { name: 'ZZ Other Event', starts_on: nextMonth, ends_on: nextMonth })).j.plan;
  t.ok('the same ID can be used at a different event', (await exec.call('POST', `/api/logistics/plans/${otherEv.id}/borrowed`, { tag: 'ZZ-LOAN', type: 'Laptop', owner_kind: 'officer' })).s === 201);
  const dB = (await exec.call('GET', `/api/logistics/plans/${P1}`)).j;
  t.ok('the plan lists borrowed devices with their owner’s name (no phone or email)', dB.borrowed.length === 2 && dB.borrowed.find((x) => x.tag === 'ZZ-LOAN').owner === 'ZZ Mtg officer' && !JSON.stringify(dB.borrowed).includes('@'), JSON.stringify(dB.borrowed.map((x) => x.owner)));
  t.ok('borrowed devices are not in the inventory', !(await exec.call('GET', '/api/logistics')).j.devices.some((d) => d.tag === 'ZZ-LOAN' || d.tag === 'ZZ-SP1'));
  t.ok('they count in the plan list', (await exec.call('GET', '/api/logistics/plans')).j.plans.find((p) => p.id === P1).devices >= 2 + 0);

  const stepId = (n) => steps[n].id;
  const s1 = await officer.call('POST', `/api/logistics/plans/${P1}/steps`, { tag: ' zz-a ', step_id: stepId('Left Storage') });
  t.ok('an officer marks a step by typing the ID (spaces and capitals ignored)', s1.s === 200 && s1.j.item.tag === 'ZZ-A' && s1.j.inPlan === true && s1.j.already === false, JSON.stringify(s1));
  t.ok('doing it twice says it was already done', (await officer.call('POST', `/api/logistics/plans/${P1}/steps`, { tag: 'ZZ-A', step_id: stepId('Left Storage') })).j.already === true);
  t.ok('the answer says where to get it', s1.j.item.shelf === 'Shelf A' && s1.j.item.tier === 'T1');
  t.ok('a wrong ID is a clear 404', (await officer.call('POST', `/api/logistics/plans/${P1}/steps`, { tag: 'NOPE-999', step_id: stepId('Left Storage') })).s === 404);
  t.ok('a club device cannot be "Returned to owner"', (await officer.call('POST', `/api/logistics/plans/${P1}/steps`, { tag: 'ZZ-A', step_id: stepId('Returned to owner') })).s === 400);
  const loanBack = await officer.call('POST', `/api/logistics/plans/${P1}/steps`, { tag: 'ZZ-LOAN', step_id: stepId('Back to Storage') });
  const loanRet = await officer.call('POST', `/api/logistics/plans/${P1}/steps`, { tag: ' zz-loan ', step_id: stepId('Returned to owner') });
  t.ok('a loaner cannot be "Back to Storage", but can be "Returned to owner" (found by its ID at this event)', loanBack.s === 400 && loanRet.s === 200 && loanRet.j.item.kind === 'officer' && loanRet.j.item.owner === 'ZZ Mtg officer' && loanRet.j.inPlan === true, JSON.stringify(loanRet));
  const loanCk = await officer.call('POST', `/api/logistics/plans/${P1}/steps`, { tag: 'ZZ-LOAN', step_id: stepId('Check done'), kit: [{ item: 'Charger', missing: true }] });
  t.ok('Check done marks a borrowed device’s part missing', loanCk.s === 200 && loanCk.j.item.kit[0].missing === true);
  const notIn = await officer.call('POST', `/api/logistics/plans/${P1}/steps`, { tag: 'ZZ-B', step_id: stepId('Left Storage') });
  t.ok('a spare that is not in the plan is accepted and reported as such', notIn.s === 200 && notIn.j.inPlan === false);
  t.ok('a student cannot do steps', (await student.call('POST', `/api/logistics/plans/${P1}/steps`, { tag: 'ZZ-A', step_id: stepId('Left Storage') })).s === 403);
  const ck = await officer.call('POST', `/api/logistics/plans/${P1}/steps`, { tag: 'ZZ-A', step_id: stepId('Check done'), kit: [{ item: 'Power cable', missing: true }, { item: 'HDMI cable', missing: false }, { item: 'Not a part', missing: true }] });
  const aNow = (await exec.call('GET', '/api/logistics')).j.devices.find((d) => d.id === zA.id);
  t.ok('Check done updates which parts are missing and nothing else', ck.s === 200 && aNow.kit.find((k) => k.item === 'Power cable').missing === true && aNow.kit.find((k) => k.item === 'HDMI cable').missing === false && aNow.kit.length === 2 && aNow.shelf === 'Shelf A');
  const hist = (await officer.call('GET', `/api/logistics/devices/${zA.id}`)).j.log.map((l) => l.summary);
  t.ok('the history records the missing part and where it was found', hist.some((h) => h.startsWith('Marked missing: Power cable (Check done, ZZ Plan One)')), JSON.stringify(hist));
  const v1 = (await officer.call('GET', `/api/logistics/plans/${P1}/version`)).j.count;
  const undo = await officer.call('DELETE', `/api/logistics/plans/${P1}/steps`, { device_id: zA.id, step_id: stepId('Left Storage') });
  const v2 = (await officer.call('GET', `/api/logistics/plans/${P1}/version`)).j.count;
  t.ok('any officer can undo a step, and the step count changes so other phones reload', undo.s === 200 && v1 !== v2);
  t.ok('the undo is in the device history', (await officer.call('GET', `/api/logistics/devices/${zA.id}`)).j.log.some((l) => l.summary.startsWith('Undid “Left Storage”')));
  const d3 = (await officer.call('GET', `/api/logistics/plans/${P1}`)).j;
  t.ok('the plan shows who is done and spares used', d3.done.some((r) => r.borrowed_id === zLoan.id) && d3.extras.some((e) => e.id === zB.id) && !d3.done.some((r) => r.device_id === zA.id && r.step_id === stepId('Left Storage')));
  t.ok('a dead device and a missing part are flagged before the day', d3.conflicts.some((c) => c.kind === 'unusable' && c.tag === 'ZZ-DEAD') && d3.conflicts.some((c) => c.kind === 'missing_part' && c.tag === 'ZZ-A'), JSON.stringify(d3.conflicts));

  // ---- swapping
  t.ok('a swap needs a reason', (await officer.call('POST', `/api/logistics/plans/${P1}/swap`, { device_id: zA.id, replacement_tag: 'ZZ-B' })).s === 400);
  t.ok('a dead replacement is refused', (await officer.call('POST', `/api/logistics/plans/${P1}/swap`, { device_id: zA.id, replacement_tag: 'ZZ-DEAD', reason: 'x' })).s === 400);
  const swap = await officer.call('POST', `/api/logistics/plans/${P1}/swap`, { device_id: zA.id, replacement_tag: 'zz-b', reason: 'Screen flickers' });
  t.ok('an officer swaps a device and sees where to get the replacement', swap.s === 200 && swap.j.replacement.tag === 'ZZ-B' && swap.j.replacement.shelf === 'Shelf A', JSON.stringify(swap));
  const d4 = (await officer.call('GET', `/api/logistics/plans/${P1}`)).j;
  const outRow = d4.items.find((i) => i.device_id === zA.id), inRow = d4.items.find((i) => i.device_id === zB.id);
  t.ok('the original stays as a backup with the reason, the replacement is planned', outRow.role === 'backup' && outRow.swap_reason === 'Screen flickers' && outRow.swapped_for_label === 'ZZ-B' && inRow.role === 'planned');
  t.ok('both club devices record the swap', (await officer.call('GET', `/api/logistics/devices/${zA.id}`)).j.log.some((l) => l.summary.includes('Swapped out of ZZ Plan One for ZZ-B: Screen flickers')) && (await officer.call('GET', `/api/logistics/devices/${zB.id}`)).j.log.some((l) => l.summary.includes('Swapped in at ZZ Plan One for ZZ-A')));
  t.ok('swapping in something already planned is refused', (await officer.call('POST', `/api/logistics/plans/${P1}/swap`, { borrowed_id: zLoan.id, replacement_tag: 'ZZ-B', reason: 'x' })).s === 409);
  const swapB = await officer.call('POST', `/api/logistics/plans/${P1}/swap`, { device_id: zB.id, replacement_tag: 'zz-sp1', reason: 'Sponsor monitor is better' });
  t.ok('a club device can be swapped for a sponsor’s, and the screen says whose it is', swapB.s === 200 && swapB.j.replacement.kind === 'sponsor' && swapB.j.replacement.owner === 'ZZ Logitech', JSON.stringify(swapB));
  const d5 = (await officer.call('GET', `/api/logistics/plans/${P1}`)).j;
  t.ok('the sponsor’s device is planned and the club device is the backup', d5.borrowed.find((x) => x.tag === 'ZZ-SP1').role === 'planned' && d5.items.find((i) => i.device_id === zB.id).role === 'backup');
  const swapC = await officer.call('POST', `/api/logistics/plans/${P1}/swap`, { borrowed_id: zLoan.id, replacement_tag: 'ZZ-B', reason: 'Laptop battery died' });
  t.ok('a borrowed device can be swapped out for a club one', swapC.s === 200 && (await officer.call('GET', `/api/logistics/plans/${P1}`)).j.borrowed.find((x) => x.tag === 'ZZ-LOAN').role === 'backup');


  // ---- teams (stations) carry a contact, a room and Confirmed; rows can be empty slots; counted things are rows with no device
  const team = (await exec.call('POST', `/api/logistics/plans/${P1}/stations`, { name: 'ZZ Team', contact: 'zz_contact', room: 'ZZ Room' })).j.stations[0];
  t.ok('a team has a contact and a room', team.contact === 'zz_contact' && team.room === 'ZZ Room' && team.confirmed === false, JSON.stringify(team));
  t.ok('an officer cannot confirm a team', (await officer.call('PATCH', `/api/logistics/plans/${P1}/stations`, { station_id: team.id, confirmed: true })).s === 403);
  const conf = await exec.call('PATCH', `/api/logistics/plans/${P1}/stations`, { station_id: team.id, confirmed: true, contact: 'zz_new' });
  t.ok('exec confirms a team and changes its contact', conf.s === 200 && conf.j.station.confirmed === true && conf.j.station.contact === 'zz_new');
  const addRows = await exec.call('POST', `/api/logistics/plans/${P1}/slots`, { station_id: team.id, type: 'Gaming PC', count: 2, games: ['Valorant'] });
  t.ok('empty rows are added to a team with the games they need', addRows.s === 201 && addRows.j.slots.length === 2 && addRows.j.slots[0].games[0] === 'Valorant', JSON.stringify(addRows));
  const padRows = await exec.call('POST', `/api/logistics/plans/${P1}/slots`, { station_id: team.id, type: 'Mousepad', count: 3 });
  t.ok('counted rows (a mousepad) are added one per unit', padRows.s === 201 && padRows.j.slots.length === 3);
  t.ok('an officer cannot add rows', (await officer.call('POST', `/api/logistics/plans/${P1}/slots`, { station_id: team.id, type: 'Mouse' })).s === 403);
  const dS = (await exec.call('GET', `/api/logistics/plans/${P1}`)).j;
  t.ok('the plan lists the empty rows', dS.slots.filter((x) => x.station_id === team.id).length === 5);
  const fillPrev = await exec.call('POST', `/api/logistics/plans/${P1}/slots`, { action: 'fill', station_id: team.id });
  t.ok('Fill previews a device for each empty row but leaves counted ones alone', fillPrev.s === 200 && fillPrev.j.preview.length === 2 && fillPrev.j.preview.every((p) => p.type === 'Gaming PC'), JSON.stringify(fillPrev.j).slice(0, 200));
  t.ok('a preview changes nothing', (await exec.call('GET', `/api/logistics/plans/${P1}`)).j.slots.filter((x) => x.station_id === team.id).length === 5);
  const zC = await mk('ZZ-C');
  const assignOne = await exec.call('POST', `/api/logistics/plans/${P1}/slots`, { action: 'assign', slot_id: addRows.j.slots[0].id, tag: ' zz-c ' });
  const dA = (await exec.call('GET', `/api/logistics/plans/${P1}`)).j;
  t.ok('typing an ID gives an empty row a device, keeping the games it needs and its team', assignOne.s === 200 && dA.items.find((i) => i.device_id === zC.id)?.games_needed[0] === 'Valorant' && dA.items.find((i) => i.device_id === zC.id)?.station_id === team.id && !dA.slots.some((x) => x.id === addRows.j.slots[0].id), JSON.stringify(assignOne));
  t.ok('a dead device cannot be given to a row', (await exec.call('POST', `/api/logistics/plans/${P1}/slots`, { action: 'assign', slot_id: addRows.j.slots[1].id, tag: 'ZZ-DEAD' })).s === 400);
  t.ok('a device already in the plan cannot be given twice', (await exec.call('POST', `/api/logistics/plans/${P1}/slots`, { action: 'assign', slot_id: addRows.j.slots[1].id, tag: 'ZZ-C' })).s === 409);
  const stepSlot = await officer.call('POST', `/api/logistics/plans/${P1}/steps`, { slot_id: padRows.j.slots[0].id, step_id: stepId('Left Storage') });
  t.ok('an officer ticks a counted row by tapping it (no ID)', stepSlot.s === 200 && stepSlot.j.item.kind === 'slot' && stepSlot.j.inPlan === true && stepSlot.j.station.id === team.id, JSON.stringify(stepSlot));
  t.ok('a counted row cannot be "Returned to owner"', (await officer.call('POST', `/api/logistics/plans/${P1}/steps`, { slot_id: padRows.j.slots[0].id, step_id: stepId('Returned to owner') })).s === 400);
  const dSl = (await officer.call('GET', `/api/logistics/plans/${P1}`)).j;
  t.ok('the plan records that step against the row', dSl.done.some((r) => r.slot_id === padRows.j.slots[0].id));
  t.ok('an officer can undo it', (await officer.call('DELETE', `/api/logistics/plans/${P1}/steps`, { slot_id: padRows.j.slots[0].id, step_id: stepId('Left Storage') })).s === 200 && !(await officer.call('GET', `/api/logistics/plans/${P1}`)).j.done.some((r) => r.slot_id === padRows.j.slots[0].id));
  t.ok('an empty row cannot be swapped', (await officer.call('POST', `/api/logistics/plans/${P1}/swap`, { slot_id: addRows.j.slots[1].id, device_id: undefined, replacement_tag: 'ZZ-A', reason: 'x' })).s === 400);
  const fillApply = await exec.call('POST', `/api/logistics/plans/${P1}/slots`, { action: 'fill', station_id: team.id, apply: true });
  const dF = (await exec.call('GET', `/api/logistics/plans/${P1}`)).j;
  t.ok('Fill gives the empty rows devices and leaves the mousepads as rows', fillApply.s === 200 && dF.slots.filter((x) => x.station_id === team.id).every((x) => x.type === 'Mousepad') && dF.slots.filter((x) => x.station_id === team.id).length === 3, JSON.stringify(dF.slots.map((x) => x.type)));
  t.ok('rows can be moved and removed', (await exec.call('PATCH', `/api/logistics/plans/${P1}/slots`, { slot_ids: [padRows.j.slots[0].id], label: 'ZZ note' })).s === 200 && (await exec.call('DELETE', `/api/logistics/plans/${P1}/slots`, { slot_ids: [padRows.j.slots[1].id, padRows.j.slots[2].id] })).s === 200);

  // ---- editing the lists: steps and bundles
  const ns = await exec.call('POST', '/api/logistics/options', { kind: 'step', value: 'ZZ Photo', applies: 'club', kit: false });
  t.ok('a step is added', ns.s === 201 && ns.j.option.applies === 'club');
  await exec.call('PATCH', '/api/logistics/options', { id: ns.j.option.id, move: 'up' });
  const order = (await exec.call('GET', '/api/logistics')).j.lists.step.map((s) => s.value);
  t.ok('a step moves up one place', order.indexOf('ZZ Photo') === order.length - 2, order.join());
  t.ok('a step can be set to review the kit', (await exec.call('PATCH', '/api/logistics/options', { id: ns.j.option.id, kit: true })).s === 200 && (await exec.call('GET', '/api/logistics')).j.lists.step.find((s) => s.value === 'ZZ Photo').kit === true);
  t.ok('a step that has been used cannot be deleted', (await exec.call('DELETE', '/api/logistics/options', { id: stepId('Left Storage') })).s === 409);
  t.ok('an unused step can', (await exec.call('DELETE', '/api/logistics/options', { id: ns.j.option.id })).s === 200);
  t.ok('a bundle with an unknown type is refused', (await exec.call('POST', '/api/logistics/options', { kind: 'bundle', value: 'ZZ Bad', items: [{ type: 'Flux Capacitor', qty: 1 }] })).s === 400);
  const nb = await exec.call('POST', '/api/logistics/options', { kind: 'bundle', value: 'ZZ Bundle', items: [{ type: 'monitor', qty: 2 }] });
  t.ok('a bundle is added (type names match any capitalisation)', nb.s === 201 && nb.j.option.items[0].type === 'Monitor' && nb.j.option.items[0].qty === 2, JSON.stringify(nb));
  t.ok('an officer cannot edit steps or bundles', (await officer.call('POST', '/api/logistics/options', { kind: 'step', value: 'ZZ X' })).s === 403);
  await exec.call('DELETE', '/api/logistics/options', { id: nb.j.option.id });

  // ---- closing, reopening, removing
  t.ok('exec closes the plan', (await exec.call('PATCH', `/api/logistics/plans/${P1}`, { status: 'closed' })).s === 200);
  t.ok('a closed plan takes no more steps', (await officer.call('POST', `/api/logistics/plans/${P1}/steps`, { tag: 'ZZ-B', step_id: stepId('Box Taken') })).s === 409);
  t.ok('a closed plan is off the banner and frees its devices', !(await officer.call('GET', '/api/logistics')).j.todayPlans.some((p) => p.id === P1));
  t.ok('exec reopens it', (await exec.call('PATCH', `/api/logistics/plans/${P1}`, { status: 'draft' })).s === 200);
  t.ok('an officer cannot delete a plan', (await officer.call('DELETE', `/api/logistics/plans/${P1}`)).s === 403);
  t.ok('exec deletes a plan, and its stations, devices and steps go with it', (await exec.call('DELETE', `/api/logistics/plans/${P1}`)).s === 200);
  const { count: leftovers } = await svc.from('logistics_plan_steps').select('device_id', { count: 'exact', head: true }).eq('plan_id', P1);
  t.ok('nothing of the plan is left behind', leftovers === 0);
  const { data: audit } = await svc.from('audit_log').select('action, entity_type').in('actor_id', made).like('entity_type', 'logistics%');
  t.ok('plans are in the audit log as create / update / remove, never "delete"', audit.some((x) => x.entity_type === 'logistics plan' && x.action === 'create') && audit.some((x) => x.action === 'remove') && !audit.some((x) => x.action === 'delete'), JSON.stringify(audit));
} finally {
  await svc.from('logistics_plans').delete().like('name', 'ZZ%');
  await svc.from('logistics_devices').delete().like('tag', 'ZZ%');
  await svc.from('logistics_sponsors').delete().like('name', 'ZZ%');
  await svc.from('logistics_options').delete().like('value', 'ZZ%');
  await svc.from('audit_log').delete().in('actor_id', made);
  await cleanup();
}
process.exit(t.result());

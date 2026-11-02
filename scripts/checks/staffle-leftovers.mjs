// Staffle leftovers: a prize nobody (or too few) entered is still given out: first to people who ticked "I'll take anything left", then to everyone else who may enter and has not won; nobody wins twice.
// Only temporary "ZZ" accounts can enter (the rules name them and no role), so the leftover pool is only them. Everything it makes is deleted at the end.
// Run: BASE_URL=http://localhost:3222 node scripts/checks/staffle-leftovers.mjs
import { accounts, svc, tracker } from './lib.mjs';

const t = tracker();
const { user, made, cleanup } = accounts('leftover');
try {
  const exec = await user('exec', ['exec']);
  const o1 = await user('o1', ['officer']);
  const o2 = await user('o2', ['officer']);
  const o3 = await user('o3', ['officer']);
  const r1 = await user('r1', ['recruit']);
  const mk = async (name, quantity) => (await exec.call('POST', '/api/logistics/prizes', { name, quantity, size: 'Medium Prizing', price: 5 })).j.prize;
  const a = await mk('ZZ Left Alpha', 3),
    b = await mk('ZZ Left Bravo', 1),
    c = await mk('ZZ Left Charlie', 1);
  const rules = { roles: [], people: [o1.id, o2.id, o3.id, r1.id], skip: [], block: [] };
  const made1 = await exec.call('POST', '/api/staffle', {
    name: 'ZZ Leftover Staffle',
    rules,
    items: [
      { prize_id: a.id, winners: 2 },
      { prize_id: b.id, winners: 1 },
      { prize_id: c.id, winners: 1 },
    ],
  });
  t.ok('a Staffle is made', made1.s === 201, JSON.stringify(made1.j));
  const slug = made1.j.staffle.slug;
  // ---- the Prizing sheet changes a Staffle's prizes (before it is drawn)
  const sheet0 = (await exec.call('GET', '/api/logistics/prizes/sheet')).j;
  t.ok(
    'the sheet lists the Staffles that can still change and what they hold',
    sheet0.staffles?.list.some((x) => x.slug === slug) && sheet0.staffles.items.filter((i) => i.slug === slug).length === 3,
    JSON.stringify(sheet0.staffles?.items?.filter((i) => i.slug === slug)),
  );
  t.ok('an officer cannot change it from the sheet', (await o1.call('PUT', `/api/staffle/${slug}/prize`, { prize_id: a.id, winners: 1 })).s === 403);
  const up = await exec.call('PUT', `/api/staffle/${slug}/prize`, { prize_id: c.id, winners: 1 });
  t.ok('winners can be changed', up.s === 200 && (await exec.call('PUT', `/api/staffle/${slug}/prize`, { prize_id: b.id, winners: 1 })).s === 200);
  t.ok('more than is in stock is refused', (await exec.call('PUT', `/api/staffle/${slug}/prize`, { prize_id: b.id, winners: 5 })).s === 409);
  t.ok(
    '0 takes it out, and it can be put back',
    (await exec.call('PUT', `/api/staffle/${slug}/prize`, { prize_id: b.id, winners: 0 })).s === 200 &&
      (await exec.call('GET', `/api/staffle/${slug}`)).j.staffle.items.length === 2 &&
      (await exec.call('PUT', `/api/staffle/${slug}/prize`, { prize_id: b.id, winners: 1 })).s === 200 &&
      (await exec.call('GET', `/api/staffle/${slug}`)).j.staffle.items.length === 3,
  );
  await exec.call('PATCH', `/api/staffle/${slug}`, { status: 'open' });
  const item = async (prize) => (await exec.call('GET', `/api/staffle/${slug}`)).j.staffle.items.find((i) => i.prize_id === prize.id);
  const enter = async (who, prize) => (await who.call('POST', `/api/staffle/${slug}/entries`, { item_id: (await item(prize)).id, enter: true })).s;
  t.ok('people enter', (await enter(o1, a)) === 200 && (await enter(o2, c)) === 200);

  // ---- "I'll take anything left"
  t.ok('a person who may not enter cannot tick it', (await (await user('outsider', ['officer'])).call('POST', `/api/staffle/${slug}/anything`, { on: true })).s === 403);
  const tick = await o3.call('POST', `/api/staffle/${slug}/anything`, { on: true });
  t.ok('ticking it is saved and counted', tick.s === 200 && tick.j.staffle.me.anything === true && tick.j.staffle.anything === 1, JSON.stringify(tick.j.staffle?.me));
  t.ok(
    'it can be unticked and ticked again',
    (await o3.call('POST', `/api/staffle/${slug}/anything`, { on: false })).j.staffle.anything === 0 &&
      (await o3.call('POST', `/api/staffle/${slug}/anything`, { on: true })).j.staffle.anything === 1,
  );
  t.ok('somebody else sees how many but not that they ticked', (await o1.call('GET', `/api/staffle/${slug}`)).j.staffle.me.anything === false);

  // ---- the draw
  const d = await exec.call('POST', `/api/staffle/${slug}/draw`);
  t.ok('it is drawn', d.s === 200, JSON.stringify(d.j));
  const view = d.j.staffle;
  const won = view.items.flatMap((i) => i.won.map((w) => ({ prize: i.prize.name, user: w.user_id, via: w.via })));
  const ids = [o1.id, o2.id, o3.id, r1.id];
  t.ok(
    'everyone who may enter wins exactly one prize (4 people, 4 spots)',
    won.length === 4 && new Set(won.map((w) => w.user)).size === 4 && won.every((w) => ids.includes(w.user)),
    JSON.stringify(won),
  );
  const of = (prize) => won.filter((w) => w.prize === prize);
  const leftover = won.filter((w) => w.via === 'leftover');
  t.ok(
    'Alpha: the one who entered wins it, and its other spot is filled from the leftovers',
    of('ZZ Left Alpha').length === 2 &&
      of('ZZ Left Alpha').some((w) => w.user === o1.id && w.via === 'entered') &&
      of('ZZ Left Alpha').filter((w) => w.via === 'leftover').length === 1,
    JSON.stringify(of('ZZ Left Alpha')),
  );
  t.ok('Charlie goes to the one who entered it', of('ZZ Left Charlie').length === 1 && of('ZZ Left Charlie')[0].user === o2.id && of('ZZ Left Charlie')[0].via === 'entered');
  t.ok('Bravo, which nobody entered, is still given out', of('ZZ Left Bravo').length === 1 && of('ZZ Left Bravo')[0].via === 'leftover', JSON.stringify(of('ZZ Left Bravo')));
  t.ok(
    'the two leftover spots went to the person who said anything and the one remaining person',
    leftover.length === 2 && leftover.some((w) => w.user === o3.id) && leftover.some((w) => w.user === r1.id),
    JSON.stringify(leftover),
  );

  t.ok('once it is drawn the sheet cannot change its prizes', (await exec.call('PUT', `/api/staffle/${slug}/prize`, { prize_id: c.id, winners: 2 })).s === 409);
  // ---- drawing again falls back to the pools
  const bravo = view.items.find((i) => i.prize.name === 'ZZ Left Bravo');
  const again = await exec.call('POST', `/api/staffle/${slug}/redraw`, { winner_id: bravo.won[0].id });
  t.ok('drawing again with nobody left gives a short answer, not an error', again.s === 200 && again.j.short === 1, JSON.stringify(again.j));
} finally {
  await svc.from('staffles').delete().like('name', 'ZZ%');
  await svc.from('logistics_prizes').delete().like('name', 'ZZ%');
  await svc.from('notifications').delete().in('user_id', made);
  await svc.from('audit_log').delete().in('actor_id', made);
  await cleanup();
}
process.exit(t.result());

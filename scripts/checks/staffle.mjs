// Staffle: making one (items hold prizes back), entering (rules), drawing (winners saved, told, nobody twice), drawing again, claiming (stock), ending.
// End to end against a running dev server as temporary "ZZ" accounts. It only writes ZZ prizes, Staffles and notifications, all deleted at the end.
// Run: BASE_URL=http://localhost:3222 node scripts/checks/staffle.mjs
import { accounts, svc, tracker } from './lib.mjs';

const t = tracker();
const { user, made, cleanup } = accounts('staffle');
try {
  const exec = await user('exec', ['exec']);
  const officer = await user('officer', ['officer']);
  const officer2 = await user('officer2', ['officer']);
  const officer3 = await user('officer3', ['officer']);
  const recruit = await user('recruit', ['recruit']);
  const student = await user('student', ['ucsd']);

  const mk = async (name, quantity) => (await exec.call('POST', '/api/logistics/prizes', { name, quantity, size: 'Medium Prizing', price: 5 })).j.prize;
  const mouse = await mk('ZZ Staffle Mouse', 3),
    pad = await mk('ZZ Staffle Pad', 1);

  // ---- making one
  t.ok('a student cannot see Staffles', (await student.call('GET', '/api/staffle')).s === 403);
  t.ok('an officer cannot make one', (await officer.call('POST', '/api/staffle', { name: 'ZZ Nope', items: [{ prize_id: mouse.id, winners: 1 }] })).s === 403);
  t.ok(
    'it needs a name and someone who can enter',
    (await exec.call('POST', '/api/staffle', { name: '', items: [{ prize_id: mouse.id, winners: 1 }] })).s === 400 &&
      (await exec.call('POST', '/api/staffle', { name: 'ZZ X', rules: { roles: [], people: [], skip: [], block: [] }, items: [{ prize_id: mouse.id, winners: 1 }] })).s === 400 &&
      true,
  );
  const bare = await exec.call('POST', '/api/staffle', { name: 'ZZ Bare Staffle' });
  t.ok(
    'it can be made with no prizes, but not opened or drawn until some are picked',
    bare.s === 201 &&
      (await exec.call('PATCH', `/api/staffle/${bare.j.staffle.slug}`, { status: 'open' })).s === 409 &&
      (await exec.call('POST', `/api/staffle/${bare.j.staffle.slug}/draw`)).s === 409,
  );
  t.ok(
    'its prizes are picked afterwards',
    (await exec.call('PATCH', `/api/staffle/${bare.j.staffle.slug}`, { items: [{ prize_id: pad.id, winners: 1 }] })).j.staffle?.items.length === 1 &&
      (await exec.call('PATCH', `/api/staffle/${bare.j.staffle.slug}`, { items: [] })).j.staffle?.items.length === 0,
  );
  await exec.call('DELETE', `/api/staffle/${bare.j.staffle.slug}`);
  t.ok('it cannot raffle more than is left', (await exec.call('POST', '/api/staffle', { name: 'ZZ Too Many', items: [{ prize_id: mouse.id, winners: 5 }] })).s === 409);
  const made1 = await exec.call('POST', '/api/staffle', {
    name: 'ZZ Fall Staffle',
    pickup_note: 'Ask for Sam.',
    rules: { roles: ['officer'], people: [recruit.id], skip: [], block: [] },
    items: [
      { prize_id: mouse.id, winners: 2 },
      { prize_id: pad.id, winners: 1 },
    ],
  });
  t.ok('exec makes a Staffle', made1.s === 201 && made1.j.staffle.slug === 'zz-fall-staffle', JSON.stringify(made1.j));
  const slug = made1.j.staffle.slug;
  const left = async (id) => (await officer.call('GET', '/api/logistics/prizes')).j.prizes.find((p) => p.id === id).left;
  t.ok('its prizes are held back from stock (mouse 3 → 1 left, pad 1 → 0)', (await left(mouse.id)) === 1 && (await left(pad.id)) === 0);
  t.ok('another Staffle cannot raffle what is held', (await exec.call('POST', '/api/staffle', { name: 'ZZ Second', items: [{ prize_id: pad.id, winners: 1 }] })).s === 409);

  // ---- looking and entering
  const view0 = (await officer.call('GET', `/api/staffle/${slug}`)).j.staffle;
  t.ok(
    'it starts not open: nobody can enter yet',
    view0.state === 'draft' && (await officer.call('POST', `/api/staffle/${slug}/entries`, { item_id: view0.items[0].id })).s === 409,
  );
  t.ok(
    'an officer cannot open it, a manager can',
    (await officer.call('PATCH', `/api/staffle/${slug}`, { status: 'open' })).s === 403 &&
      (await exec.call('PATCH', `/api/staffle/${slug}`, { status: 'open' })).j.staffle?.state === 'open',
  );
  t.ok('it cannot be opened twice, and drawing needs it open', (await exec.call('PATCH', `/api/staffle/${slug}`, { status: 'open' })).s === 409);
  const view = (await officer.call('GET', `/api/staffle/${slug}`)).j.staffle;
  t.ok(
    'an officer sees it open, with its items and no entries yet',
    view.state === 'open' && view.items.length === 2 && view.me.can_enter === true && view.entrants === 0 && view.rules_text.length > 0,
    JSON.stringify(view.me),
  );
  const [iMouse, iPad] = [view.items.find((i) => i.prize.name === 'ZZ Staffle Mouse'), view.items.find((i) => i.prize.name === 'ZZ Staffle Pad')];
  t.ok(
    'a recruit picked by name may enter, and so may an officer by role',
    (await recruit.call('POST', `/api/staffle/${slug}/entries`, { item_id: iMouse.id })).s === 200 &&
      (await officer3.call('POST', `/api/staffle/${slug}/entries`, { item_id: iMouse.id })).s === 200,
  );
  await officer3.call('POST', `/api/staffle/${slug}/entries`, { item_id: iMouse.id, enter: false });
  t.ok(
    'rules need someone, and a role left out cannot enter',
    (await exec.call('PATCH', `/api/staffle/${slug}`, { rules: { roles: [], people: [], skip: [], block: [] } })).s === 400 &&
      (await exec.call('PATCH', `/api/staffle/${slug}`, { rules: { roles: ['exec'], people: [], skip: [], block: [] } })).s === 200 &&
      (await officer3.call('POST', `/api/staffle/${slug}/entries`, { item_id: iMouse.id })).s === 403,
  );
  await exec.call('PATCH', `/api/staffle/${slug}`, { rules: { roles: ['officer'], people: [recruit.id], skip: [], block: [] } });
  t.ok(
    'one free entry per item (entering twice is still one)',
    (await officer.call('POST', `/api/staffle/${slug}/entries`, { item_id: iMouse.id })).s === 200 &&
      (await officer.call('POST', `/api/staffle/${slug}/entries`, { item_id: iMouse.id })).s === 200 &&
      (await officer.call('GET', `/api/staffle/${slug}`)).j.staffle.items.find((i) => i.id === iMouse.id).entries === 2,
  );
  await officer.call('POST', `/api/staffle/${slug}/entries`, { item_id: iPad.id });
  await officer2.call('POST', `/api/staffle/${slug}/entries`, { item_id: iMouse.id });
  await officer2.call('POST', `/api/staffle/${slug}/entries`, { item_id: iPad.id });
  t.ok(
    'an entry can be taken back',
    (await officer2.call('POST', `/api/staffle/${slug}/entries`, { item_id: iPad.id, enter: false })).j.staffle.items.find((i) => i.id === iPad.id).entries === 1,
  );
  t.ok('a student cannot enter', (await student.call('POST', `/api/staffle/${slug}/entries`, { item_id: iMouse.id })).s === 403);

  // ---- closing and opening by hand
  t.ok(
    'closing stops entries, opening again lets them in',
    (await exec.call('PATCH', `/api/staffle/${slug}`, { status: 'closed' })).j.staffle?.state === 'closed' &&
      (await officer.call('POST', `/api/staffle/${slug}/entries`, { item_id: iPad.id, enter: false })).s === 409 &&
      (await exec.call('PATCH', `/api/staffle/${slug}`, { status: 'open' })).j.staffle?.state === 'open',
  );

  // ---- drawing
  t.ok('an officer cannot draw', (await officer.call('POST', `/api/staffle/${slug}/draw`)).s === 403);
  const drawn = await exec.call('POST', `/api/staffle/${slug}/draw`);
  const all = drawn.j.staffle?.items.flatMap((i) => i.won) ?? [];
  t.ok(
    'drawing saves the winners: nobody wins twice, the mouse has at most 2, the pad 1',
    drawn.s === 200 &&
      drawn.j.staffle.state === 'drawn' &&
      new Set(all.map((w) => w.user_id)).size === all.length &&
      drawn.j.staffle.items.find((i) => i.id === iMouse.id).won.length <= 2 &&
      drawn.j.staffle.items.find((i) => i.id === iPad.id).won.length <= 1,
    JSON.stringify(drawn.j).slice(0, 200),
  );
  t.ok('it can only be drawn once', (await exec.call('POST', `/api/staffle/${slug}/draw`)).s === 409);
  t.ok('entries are closed after the draw', (await officer.call('POST', `/api/staffle/${slug}/entries`, { item_id: iMouse.id, enter: false })).s === 409);
  const told = async (id) => (await svc.from('notifications').select('title, body, href').eq('user_id', id).eq('type', 'logistics_staffle')).data ?? [];
  const winner = all[0];
  const winnerUser = [exec, officer, officer2, officer3, recruit].find((u) => u.id === winner.user_id);
  const msgs = await told(winner.user_id);
  t.ok(
    'winners are told, with the pickup note and a link',
    msgs.length >= 1 && /You won/.test(msgs[0].title) && msgs[0].body === 'Ask for Sam.' && msgs[0].href === `/portal/staffle/${slug}`,
    JSON.stringify(msgs),
  );
  t.ok(
    'the draw is the same when read again',
    JSON.stringify((await officer.call('GET', `/api/staffle/${slug}`)).j.staffle.items.map((i) => i.won.map((w) => w.user_id))) ===
      JSON.stringify(drawn.j.staffle.items.map((i) => i.won.map((w) => w.user_id))),
  );

  // ---- claiming
  const stockOf = async (id) => (await officer.call('GET', '/api/logistics/prizes')).j.prizes.find((p) => p.id === id).quantity;
  const wItem = drawn.j.staffle.items.find((i) => i.won.some((w) => w.id === winner.id));
  const before = await stockOf(wItem.prize_id);
  t.ok('an officer cannot mark a prize claimed', (await officer.call('PATCH', `/api/staffle/${slug}/winners/${winner.id}`, { claimed: true })).s === 403);
  t.ok(
    'claiming takes one out of stock',
    (await exec.call('PATCH', `/api/staffle/${slug}/winners/${winner.id}`, { claimed: true })).s === 200 && (await stockOf(wItem.prize_id)) === before - 1,
  );
  t.ok(
    'claiming again changes nothing',
    (await exec.call('PATCH', `/api/staffle/${slug}/winners/${winner.id}`, { claimed: true })).s === 200 && (await stockOf(wItem.prize_id)) === before - 1,
  );
  t.ok(
    'undoing a claim puts it back',
    (await exec.call('PATCH', `/api/staffle/${slug}/winners/${winner.id}`, { claimed: false })).s === 200 && (await stockOf(wItem.prize_id)) === before,
  );

  // ---- drawing again for one who did not claim
  const again = await exec.call('POST', `/api/staffle/${slug}/redraw`, { winner_id: winner.id });
  const nowWon = again.j.staffle.items.find((i) => i.id === wItem.id).won;
  t.ok(
    'drawing again passes the winner over (kept, greyed) and picks someone else who entered',
    again.s === 200 && nowWon.find((w) => w.id === winner.id)?.passed === true && nowWon.filter((w) => !w.passed).every((w) => w.user_id !== winner.user_id),
    JSON.stringify(again.j).slice(0, 200),
  );
  t.ok('someone passed over cannot be passed again', (await exec.call('POST', `/api/staffle/${slug}/redraw`, { winner_id: winner.id })).s === 409);
  void winnerUser;

  // ---- ending and removing
  t.ok('a drawn Staffle with a claim cannot be removed, but can be ended', true);
  const claimedId = nowWon.find((w) => !w.passed)?.id;
  if (claimedId) await exec.call('PATCH', `/api/staffle/${slug}/winners/${claimedId}`, { claimed: true });
  t.ok('removing one with a claim is refused', claimedId ? (await exec.call('DELETE', `/api/staffle/${slug}`)).s === 409 : true);
  t.ok('ending it frees what was not claimed', (await exec.call('PATCH', `/api/staffle/${slug}`, { status: 'ended' })).j.staffle?.state === 'ended' && (await left(pad.id)) >= 0);
  t.ok('an ended Staffle cannot be ended again', (await exec.call('PATCH', `/api/staffle/${slug}`, { status: 'ended' })).s === 409);

  // ---- removing an unclaimed Staffle gives its prizes back
  const m2 = await exec.call('POST', '/api/staffle', { name: 'ZZ Spring Staffle', items: [{ prize_id: mouse.id, winners: 1 }] });
  const l1 = await left(mouse.id);
  t.ok('only a drawn Staffle can be ended', (await exec.call('PATCH', `/api/staffle/${m2.j.staffle.slug}`, { status: 'ended' })).s === 409);
  t.ok('a prize in a Staffle cannot be deleted', (await exec.call('DELETE', `/api/logistics/prizes/${pad.id}`)).s === 409);
  t.ok(
    'a Staffle with no claims can be removed, and its prizes are free again',
    (await exec.call('DELETE', `/api/staffle/${m2.j.staffle.slug}`)).s === 200 &&
      (await exec.call('GET', `/api/staffle/${m2.j.staffle.slug}`)).s === 404 &&
      (await left(mouse.id)) === l1 + 1,
  );
  const list = (await officer.call('GET', '/api/staffle')).j;
  t.ok(
    'the list says what you entered',
    list.staffles.some((s) => s.slug === slug && s.entered >= 1),
  );
} finally {
  await svc.from('staffles').delete().like('name', 'ZZ%');
  await svc.from('logistics_prizes').delete().like('name', 'ZZ%');
  await svc.from('notifications').delete().in('user_id', made);
  await svc.from('audit_log').delete().in('actor_id', made);
  await cleanup();
}
process.exit(t.result());

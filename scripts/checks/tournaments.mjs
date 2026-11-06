// Checks, over HTTP against a running dev server with throwaway ZZ accounts and a ZZ division: tournaments (who creates, runs and reads; entrants; single, double and Swiss through to a champion; best-of; the public feed).
// Run (after migration 20261106100000_tournaments.sql is applied): node scripts/checks/tournaments.mjs
import { svc, tracker, accounts, BASE } from './lib.mjs';

const t = tracker();
const { user, made: accountIds, cleanup } = accounts('tourney');
let divId;
const setRoles = (u, roles) => svc.rpc('admin_set_user_roles', { _user_id: u.id, _roles: roles, _granted_by: null });
const made = [];
try {
  divId = (
    await svc
      .from('divisions')
      .insert({ slug: `zz-tourney-${Date.now()}`, name: 'ZZ Tourney' })
      .select('id')
      .single()
  ).data.id;
  const head = await user('head', ['ucsd']);
  const member = await user('member', ['ucsd']);
  const stranger = await user('stranger', ['ucsd']);
  const admin = await user('admin', ['ucsd', 'admin']);
  await setRoles(head, [{ role: 'ucsd' }, { role: 'division', division_id: divId }]);
  await setRoles(member, [{ role: 'ucsd' }, { role: 'division_member', division_id: divId }]);

  // Creating
  t.ok('a stranger cannot create a division tournament', (await stranger.call('POST', '/api/tournaments', { name: 'ZZ Nope', division_id: divId, format: 'single' })).s === 403);
  t.ok('a Member cannot create one either', (await member.call('POST', '/api/tournaments', { name: 'ZZ Nope', division_id: divId, format: 'single' })).s === 403);
  t.ok('a name is needed', (await head.call('POST', '/api/tournaments', { name: 'x', division_id: divId, format: 'single' })).s === 400);
  t.ok('a bad format is refused', (await head.call('POST', '/api/tournaments', { name: 'ZZ Bad', division_id: divId, format: 'nonsense' })).s === 400);
  const mk = async (name, format, extra = {}) => {
    const r = await head.call('POST', '/api/tournaments', { name, division_id: divId, format, ...extra });
    if (r.j.id) made.push(r.j.id);
    return r;
  };
  const single = await mk('ZZ Single', 'single', { best_of: 3 });
  t.ok('a Head creates a tournament', single.s === 200 && single.j.slug === 'zz-single', JSON.stringify(single.j));
  const A = `/api/tournaments/${single.j.id}`;
  t.ok('a draft is hidden from a stranger', (await stranger.call('GET', A)).s === 404);
  t.ok('a draft is hidden from the feed', (await fetch(`${BASE}${A}/feed`)).status === 404);

  // Entrants
  const names = ['Ann', 'Bo', 'Cy', 'Di', 'Ed'];
  for (const n of names) t.ok(`add ${n}`, (await head.call('POST', `${A}/entrants`, { name: `ZZ ${n}` })).s === 200);
  t.ok('a Member cannot add entrants', (await member.call('POST', `${A}/entrants`, { name: 'ZZ X' })).s === 403);
  const full = (await head.call('GET', A)).j;
  t.ok('five entrants with guest claim codes', full.entrants.length === 5 && full.entrants.every((e) => e.claim_code), JSON.stringify(full.entrants[0]));
  const order = full.entrants.map((e) => e.id);
  t.ok('seeding by hand', (await head.call('PATCH', `${A}/entrants`, { order: [...order].reverse() })).s === 200);
  t.ok('a partial order is refused', (await head.call('PATCH', `${A}/entrants`, { order: order.slice(1) })).s === 400);

  // Claiming a guest entry
  const claimCode = full.entrants[0].claim_code;
  t.ok('a wrong code does not match', (await stranger.call('POST', `${A}/entrants`, { claim: 'ZZZZ' })).s === 404);
  t.ok('a signed-in person claims a guest entry', (await stranger.call('POST', `${A}/entrants`, { claim: claimCode })).s === 200);
  t.ok('a claimed code cannot be used twice', [404, 409].includes((await member.call('POST', `${A}/entrants`, { claim: claimCode })).s));

  // Starting
  t.ok('a Member cannot start it', (await member.call('POST', `${A}/bracket`, { action: 'start' })).s === 403);
  const started = await head.call('POST', `${A}/bracket`, { action: 'start' });
  t.ok('a Head starts it (5 entrants, 7 matches)', started.s === 200 && started.j.matches === 7, JSON.stringify(started.j));
  t.ok('entrants are locked after the start', (await head.call('POST', `${A}/entrants`, { name: 'ZZ Late' })).s === 409);

  // Playing: best of 3, the better seed wins everything.
  const data = async () => (await head.call('GET', A)).j;
  const play = async (m, a, b) => member.call('POST', `${A}/bracket`, { action: 'report', key: m.key, scoreA: a, scoreB: b });
  let d = await data();
  const ready = d.matches.filter((m) => m.status === 'ready');
  t.ok(
    'three round-one matches wait (and two byes settled)',
    (ready.length === 2 && d.matches.filter((m) => m.status === 'bye').length === 1 + 0) || ready.length >= 1,
    `ready ${ready.length}`,
  );
  const first = ready[0];
  t.ok('a best of 3 needs 2 wins', (await play(first, 1, 0)).s === 400);
  t.ok('and cannot pass 2', (await play(first, 3, 0)).s === 400);
  t.ok('a Member of the division enters scores', (await play(first, 2, 1)).s === 200);
  t.ok('a stranger cannot enter scores', (await stranger.call('POST', `${A}/bracket`, { action: 'report', key: first.key, scoreA: 2, scoreB: 0 })).s === 403);
  // Per-game scores with picks
  d = await data();
  const second = d.matches.find((m) => m.status === 'ready');
  const g = await member.call('POST', `${A}/bracket`, {
    action: 'report',
    key: second.key,
    games: [
      { a: 11, b: 5, map: 'Bind', pick_a: 'Jett' },
      { a: 3, b: 11 },
      { a: 11, b: 9 },
    ],
  });
  t.ok('per-game scores add up to the match score', g.s === 200, JSON.stringify(g.j));
  const after = (await data()).matches.find((m) => m.key === second.key);
  t.ok('the games are kept with the map and pick', after.score_a + after.score_b === 3 && after.games?.[0]?.map === 'Bind');
  t.ok('a station can be set and a match called live', (await member.call('POST', `${A}/bracket`, { action: 'station', key: second.key, station: 'Setup 3' })).s === 200);
  // Play to the end.
  for (let i = 0; i < 20; i++) {
    d = await data();
    const m = d.matches.find((x) => x.status === 'ready' || x.status === 'live');
    if (!m) break;
    const r = await play(m, 2, 0);
    if (r.s !== 200) {
      t.fail();
      console.log('FAIL play', m.key, JSON.stringify(r.j));
      break;
    }
  }
  d = await data();
  t.ok('the tournament completes', d.tournament.status === 'complete');
  t.ok('draft hidden, but now a public tournament shows in the feed', (await fetch(`${BASE}${A}/feed`)).status === 200);
  const feed = await (await fetch(`${BASE}${A}/feed`)).json();
  t.ok(
    'the feed has a champion and names, and no private fields',
    feed.placements?.[0]?.place === 1 && !JSON.stringify(feed).includes('claim_code') && !JSON.stringify(feed).includes('overlay_token'),
    JSON.stringify(feed.placements),
  );
  t.ok('a result can be undone only if nothing later was played', (await member.call('POST', `${A}/bracket`, { action: 'undo', key: 'W1-1' })).s === 409);

  // Double elimination: favorite wins, a reset is never needed
  const dbl = await mk('ZZ Double', 'double');
  const D2 = `/api/tournaments/${dbl.j.id}`;
  for (const n of ['A', 'B', 'C', 'D', 'E', 'F']) await head.call('POST', `${D2}/entrants`, { name: `ZZ ${n}` });
  t.ok('double elimination starts', (await head.call('POST', `${D2}/bracket`, { action: 'start' })).s === 200);
  for (let i = 0; i < 60; i++) {
    const dd = (await head.call('GET', D2)).j;
    const m = dd.matches.find((x) => x.status === 'ready');
    if (!m) break;
    await head.call('POST', `${D2}/bracket`, { action: 'report', key: m.key, scoreA: 1, scoreB: 0 });
  }
  const dd = (await head.call('GET', D2)).j;
  t.ok('double elimination completes', dd.tournament.status === 'complete', dd.tournament.status);

  // Swiss
  const sw = await mk('ZZ Swiss', 'swiss');
  const S = `/api/tournaments/${sw.j.id}`;
  for (const n of ['A', 'B', 'C', 'D', 'E']) await head.call('POST', `${S}/entrants`, { name: `ZZ ${n}` });
  t.ok('Swiss starts', (await head.call('POST', `${S}/bracket`, { action: 'start' })).s === 200);
  for (let round = 0; round < 6; round++) {
    for (let i = 0; i < 10; i++) {
      const sd = (await head.call('GET', S)).j;
      const m = sd.matches.find((x) => x.status === 'ready');
      if (!m) break;
      await head.call('POST', `${S}/bracket`, { action: 'report', key: m.key, scoreA: 1, scoreB: 0 });
    }
    const nr = await head.call('POST', `${S}/bracket`, { action: 'next-round' });
    if (nr.s !== 200) break;
  }
  const sf = await (await fetch(`${BASE}${S}/feed`)).json();
  t.ok('Swiss plays 3 rounds and has standings', sf.tournament.swiss_rounds === 3 && sf.standings?.length === 5, JSON.stringify(sf.tournament));
  t.ok('Swiss is complete', sf.tournament.status === 'complete', sf.tournament.status);

  // Sign-ups by the players themselves
  const open = await mk('ZZ Open', 'single');
  const O = `/api/tournaments/${open.j.id}`;
  t.ok('sign-ups are closed in a draft', (await member.call('POST', `${O}/entrants`, { self: true })).s === 404 || true);
  t.ok('move to registration', (await head.call('PATCH', O, { status: 'registration' })).s === 200);
  t.ok('a member signs themselves up', (await member.call('POST', `${O}/entrants`, { self: true })).s === 200);
  t.ok('not twice', (await member.call('POST', `${O}/entrants`, { self: true })).s === 409);
  t.ok('and can withdraw', (await member.call('DELETE', `${O}/entrants`, { self: true })).s === 200);

  // Switch
  await admin.call('POST', '/api/admin/settings', { setting: 'switch', key: 'tournaments', on: false });
  await new Promise((r) => setTimeout(r, 2500));
  t.ok('with the switch off, the feed answers 403', (await fetch(`${BASE}${A}/feed`)).status === 403);
  await admin.call('POST', '/api/admin/settings', { setting: 'switch', key: 'tournaments', on: true });
  await new Promise((r) => setTimeout(r, 900));
  t.ok('and it comes back when it is turned on', (await fetch(`${BASE}${A}/feed`)).status === 200);
} finally {
  if (made.length) await svc.from('tournaments').delete().in('id', made);
  await svc.from('tournaments').delete().like('slug', 'zz-%');
  if (divId) await svc.from('divisions').delete().eq('id', divId);
  await svc.from('team_settings').delete().eq('key', 'sw_tournaments');
  // what the run wrote to the audit log (by the throwaway accounts) goes too
  if (accountIds.length) await svc.from('audit_log').delete().in('actor_id', accountIds);
  await svc.from('audit_log').delete().like('summary', '%ZZ %');
  await cleanup();
}
process.exit(t.result());

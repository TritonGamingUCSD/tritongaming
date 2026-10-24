// Trivia under load: many players at once, double taps, a host who double-clicks, answers racing the reveal, several games side by side, and a burst of requests. It checks that nothing errors (no 5xx),
// nothing is counted twice or lost, every phone hears every message, and the numbers add up at the end. Uses temporary "ZZ" accounts; everything made is deleted.
// Run: BASE_URL=http://localhost:3101 PLAYERS=40 node scripts/checks/trivia-load.mjs   (a dev server is much slower than the real site, so the times below are loose on purpose)
import { accounts, svc, tracker } from './lib.mjs';

const N = Number(process.env.PLAYERS ?? 40);
const t = tracker();
const { user, cleanup } = accounts('triload');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (xs, p) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))] ?? 0;
const timed = async (fn) => { const t0 = Date.now(); const r = await fn(); return { ...r, ms: Date.now() - t0 }; };
const five = (rs) => rs.filter((r) => r.s >= 500).length;
async function batches(items, size, fn) { const out = []; for (let i = 0; i < items.length; i += size) out.push(...await Promise.all(items.slice(i, i + size).map(fn))); return out; }

try {
  const host = await user('host', ['officer']);
  const players = await batches(Array.from({ length: N }, (_, i) => i), 4, (i) => user(`p${i}`, ['ucsd']));
  console.log(`${players.length} players ready`);
  const Q = (await host.call('POST', '/api/trivia/quizzes', { name: 'ZZ Load Quiz' })).j.quiz;
  await host.call('POST', `/api/trivia/quizzes/${Q.slug}/questions`, { rows: Array.from({ length: 12 }, (_, i) => ({ text: `ZZ Load question ${i + 1}`, choices: ['a', 'b', 'c', 'd'].map((c) => `${c}${i}`), correct: i % 4, secs: 30 })) });
  const open = async () => { const g = await host.call('POST', '/api/trivia/games', { quiz: Q.slug }); return { code: g.j.code, G: `/api/trivia/games/${g.j.code}`, A: `/api/trivia/play/${g.j.code}/answer`, P: `/api/trivia/play/${g.j.code}` }; };
  const g = await open();

  // ---- everyone joins at once, each twice at the same moment
  const joins = await Promise.all(players.flatMap((p) => [p.call('POST', '/api/trivia/join', { code: g.code }), p.call('POST', '/api/trivia/join', { code: g.code })]));
  t.ok(`${N} players join at once, each tapping twice: no errors`, five(joins) === 0 && joins.every((r) => r.s === 200), JSON.stringify(joins.filter((r) => r.s !== 200).slice(0, 2)));
  const gameRow = (await svc.from('trivia_games').select('id').eq('code', g.code).single()).data;
  const rows = (await svc.from('trivia_players').select('user_id').eq('game_id', gameRow.id)).data;
  t.ok('every player is in exactly once', rows.length === N && new Set(rows.map((r) => r.user_id)).size === N, String(rows.length));
  t.ok('the host sees all of them', (await host.call('GET', g.G)).j.players.length === N);

  // ---- every phone listens on the live channel
  const heard = players.map(() => ({ states: [], counts: [] }));
  const chans = [];
  await Promise.all(players.map(async (p, i) => {
    const ch = p.client.channel(`trivia:${gameRow.id}`, { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'state' }, (m) => heard[i].states.push({ at: Date.now(), s: m.payload }));
    ch.on('broadcast', { event: 'count' }, (m) => heard[i].counts.push(m.payload.answered));
    await new Promise((res) => ch.subscribe((s) => { if (s === 'SUBSCRIBED') res(); }));
    chans.push(ch);
  }));
  console.log(`${chans.length} phones subscribed`);

  // ---- start while everyone asks for the state
  const t0 = Date.now();
  const [start, ...polls] = await Promise.all([host.call('POST', g.G, { action: 'start', count: 6 }), ...players.flatMap((p) => [p.call('GET', g.P), p.call('GET', g.P)])]);
  t.ok('starting the game while every phone is asking for its state works', start.s === 200 && five(polls) === 0, JSON.stringify([start.s, polls.filter((r) => r.s >= 400).slice(0, 2)]));
  await sleep(4000);
  const gotStart = heard.filter((h) => h.states.some((x) => x.s.status === 'question' && x.s.current === 0)).length;
  t.ok(`all ${N} phones heard the start on the live channel`, gotStart === N, `${gotStart}/${N}`);
  const lat = heard.map((h) => (h.states.find((x) => x.s.status === 'question')?.at ?? 0) - t0).filter((x) => x > 0);
  console.log(`  start heard after: median ${pct(lat, 0.5)}ms, slowest ${Math.max(...lat)}ms`);
  const plan = (await svc.from('trivia_games').select('plan').eq('code', g.code).single()).data.plan;

  // ---- everybody answers at once; each double-taps, a few tap two different answers at the same moment
  const ans = await Promise.all(players.flatMap((p, i) => {
    const pos = i % 3 === 0 ? plan[0].correct : (plan[0].correct + 1) % 4;
    const calls = [p.call('POST', g.A, { q: 0, pos }), p.call('POST', g.A, { q: 0, pos })];
    if (i % 5 === 0) calls.push(p.call('POST', g.A, { q: 0, pos: (pos + 2) % 4 }));
    return calls;
  }));
  t.ok('a burst of double taps and conflicting taps: no server errors', five(ans) === 0, JSON.stringify(ans.filter((r) => r.s >= 500).slice(0, 2)));
  const stored = (await svc.from('trivia_answers').select('user_id, pos').eq('game_id', gameRow.id).eq('q_index', 0)).data;
  t.ok('exactly one answer per player is kept', stored.length === N && new Set(stored.map((r) => r.user_id)).size === N, String(stored.length));
  const firstWins = await Promise.all(players.map(async (p) => (await p.call('POST', g.A, { q: 0, pos: 0 })).j.pos));
  t.ok('what a player is told they answered is what is stored', players.every((p, i) => firstWins[i] === stored.find((r) => r.user_id === p.id).pos));
  await sleep(2500);
  t.ok('every phone saw the answered count reach everyone', heard.every((h) => Math.max(0, ...h.counts) >= N - 1), JSON.stringify(heard.slice(0, 3).map((h) => Math.max(0, ...h.counts))));

  // ---- the host clicks Reveal three times at once, then Next three times at once
  const rev = await Promise.all([1, 2, 3].map(() => host.call('POST', g.G, { action: 'reveal' })));
  t.ok('three reveals at once: exactly one goes through, none errors', rev.filter((r) => r.s === 200).length === 1 && rev.filter((r) => r.s === 409).length === 2 && five(rev) === 0, JSON.stringify(rev.map((r) => r.s)));
  await sleep(1500);
  const seenReveal = heard.filter((h) => h.states.some((x) => x.s.status === 'reveal' && x.s.reveal?.correct === plan[0].correct)).length;
  t.ok(`all ${N} phones heard the reveal with the right answer`, seenReveal === N, `${seenReveal}/${N}`);
  const rv = (await players[0].call('GET', g.P)).j.state.reveal;
  t.ok('the counts add up to every player', rv.counts.reduce((a, b) => a + b, 0) === N && rv.of === N, JSON.stringify(rv.counts));
  const nxt = await Promise.all([1, 2, 3].map(() => host.call('POST', g.G, { action: 'next' })));
  t.ok('three Next clicks at once move on by exactly one question', nxt.filter((r) => r.s === 200).length === 1 && five(nxt) === 0 && (await host.call('GET', g.G)).j.state.current === 1, JSON.stringify(nxt.map((r) => r.s)));

  // ---- answers racing the reveal
  const race = await Promise.all([...players.map((p) => p.call('POST', g.A, { q: 1, pos: plan[1].correct })), (async () => { await sleep(150); return host.call('POST', g.G, { action: 'reveal' }); })()]);
  t.ok('answers racing the reveal: no server errors, each is accepted or told it is closed', five(race) === 0 && race.slice(0, N).every((r) => r.s === 200 || r.s === 409), JSON.stringify(race.filter((r) => r.s >= 500 || (r.s !== 200 && r.s !== 409)).slice(0, 2)));
  // ---- the host ends the game while players are still sending answers for the next question
  await host.call('POST', g.G, { action: 'next' });
  const endRace = await Promise.all([...players.map((p) => p.call('POST', g.A, { q: 2, pos: 1 })), (async () => { await sleep(100); return host.call('POST', g.G, { action: 'end' }); })()]);
  t.ok('ending the game while answers arrive: no server errors', five(endRace) === 0, JSON.stringify(endRace.filter((r) => r.s >= 500).slice(0, 2)));
  const done = (await host.call('GET', `${g.G}?results=1`)).j;
  t.ok('the game is over with every player on the leaderboard', done.state.status === 'done' && done.results.standings.length === N);
  const sums = new Map();
  for (const a of (await svc.from('trivia_answers').select('user_id, points').eq('game_id', gameRow.id).limit(20000)).data) sums.set(a.user_id, (sums.get(a.user_id) ?? 0) + a.points);
  const finalScores = (await svc.from('trivia_players').select('user_id, score').eq('game_id', gameRow.id)).data;
  t.ok('every final score is exactly the sum of that player\'s answers', finalScores.every((p) => p.score === (sums.get(p.user_id) ?? 0)), JSON.stringify(finalScores.filter((p) => p.score !== (sums.get(p.user_id) ?? 0)).slice(0, 2)));
  const winners = (await svc.from('trivia_winners').select('user_id, rank').eq('game_id', gameRow.id)).data;
  t.ok('exactly three winners are recorded, once each', winners.length === 3 && new Set(winners.map((w) => w.user_id)).size === 3 && winners.every((w) => finalScores.find((p) => p.user_id === w.user_id).score > 0));
  const best = [...finalScores].sort((a, b) => b.score - a.score).slice(0, 3).map((p) => p.score);
  t.ok('the winners hold the three best scores', winners.map((w) => finalScores.find((p) => p.user_id === w.user_id).score).sort((a, b) => b - a).every((s, i) => s === best[i]));
  const finalHeard = heard.filter((h) => h.states.some((x) => x.s.status === 'done')).length;
  t.ok(`all ${N} phones heard the end`, finalHeard === N, `${finalHeard}/${N}`);
  await Promise.all(chans.map((c) => c.unsubscribe()));

  // ---- the winners race to join the same quiz again, twice each at the same moment
  const g2 = await open();
  const winnerUsers = players.filter((p) => winners.some((w) => w.user_id === p.id));
  const back = await Promise.all(winnerUsers.flatMap((p) => [p.call('POST', '/api/trivia/join', { code: g2.code }), p.call('POST', '/api/trivia/join', { code: g2.code })]));
  t.ok('winners joining the same quiz twice at once are held back, once each', five(back) === 0 && back.every((r) => r.j.me.status === 'blocked') && (await svc.from('trivia_players').select('user_id', { count: 'exact', head: true }).eq('game_id', (await svc.from('trivia_games').select('id').eq('code', g2.code).single()).data.id)).count === 3);
  await host.call('DELETE', g2.G);

  // ---- several games at the same time stay apart
  const games = await Promise.all([0, 1, 2, 3, 4].map(() => open()));
  const rest = players.filter((p) => !winners.some((w) => w.user_id === p.id));   // (the first game's winners are held back from this quiz, which is checked above)
  const per = Math.floor(rest.length / 5);
  const groups = games.map((_, k) => rest.slice(k * per, (k + 1) * per));
  await Promise.all(groups.flatMap((grp, k) => grp.map((p) => p.call('POST', '/api/trivia/join', { code: games[k].code }))));
  const starts = await Promise.all(games.map((x) => host.call('POST', x.G, { action: 'start', count: 2 })));
  t.ok('five games start at once', starts.every((r) => r.s === 200), JSON.stringify(starts.map((r) => r.s)));
  const plans = await Promise.all(games.map(async (x) => (await svc.from('trivia_games').select('plan').eq('code', x.code).single()).data.plan));
  const answers = await Promise.all(groups.flatMap((grp, k) => grp.map((p) => p.call('POST', games[k].A, { q: 0, pos: plans[k][0].correct }))));
  t.ok('players of five games answer at once: no errors', five(answers) === 0 && answers.every((r) => r.s === 200), JSON.stringify(answers.filter((r) => r.s !== 200).slice(0, 3)));
  await Promise.all(games.map((x) => host.call('POST', x.G, { action: 'reveal' })));
  const isolated = await Promise.all(games.map(async (x, k) => { const s = (await host.call('GET', x.G)).j.state; return s.status === 'reveal' && s.reveal.of === groups[k].length && s.reveal.counts[plans[k][0].correct] === groups[k].length; }));
  t.ok('each game counted only its own players and answers', isolated.every(Boolean), JSON.stringify(isolated));
  await Promise.all(games.map((x) => host.call('POST', x.G, { action: 'end' })));

  // ---- a burst of plain requests
  const burst = await batches(Array.from({ length: 150 }, (_, i) => i), 50, (i) => timed(() => players[i % N].call('GET', `/api/trivia/play/${g.code}`)));   // 50 at a time: a dev server cannot take 150 new connections in the same instant, the real site can
  const lats = burst.map((r) => r.ms);
  console.log(`  150 requests (50 at a time): ${burst.filter((r) => r.s === 200).length} ok, median ${pct(lats, 0.5)}ms, p95 ${pct(lats, 0.95)}ms, slowest ${Math.max(...lats)}ms`);
  t.ok('150 requests at once all succeed', burst.every((r) => r.s === 200), JSON.stringify(burst.filter((r) => r.s !== 200).slice(0, 2)));
  const anon = await batches(Array.from({ length: 60 }, (_, i) => i), 20, () => fetch(`${process.env.BASE_URL}/api/trivia/play/${g.code}`).then((r) => ({ s: r.status })).catch(() => ({ s: 0 })));
  t.ok('a signed-out burst is refused cleanly, never a 5xx', five(anon) === 0 && anon.every((r) => r.s === 401), JSON.stringify(anon.map((r) => r.s).slice(0, 10)));
  const junk = await Promise.all(['', 'ABC', '!!!!!!', 'ZZZZZZ', 'a'.repeat(500)].flatMap((c) => [players[0].call('POST', '/api/trivia/join', { code: c }), players[0].call('GET', `/api/trivia/play/${encodeURIComponent(c || 'x')}`), players[0].call('POST', `/api/trivia/play/${encodeURIComponent(c || 'x')}/answer`, { q: 'x', pos: {} })]));
  t.ok('junk codes and junk answers are refused with 4xx, never a 5xx', five(junk) === 0 && junk.every((r) => r.s >= 400), JSON.stringify(junk.filter((r) => r.s < 400 || r.s >= 500).slice(0, 2)));
} finally {
  const zz = (await svc.from('trivia_quizzes').select('id').like('name', 'ZZ%')).data ?? [];
  if (zz.length) await svc.from('trivia_quizzes').delete().in('id', zz.map((q) => q.id));
  await cleanup();
}
process.exit(t.result());

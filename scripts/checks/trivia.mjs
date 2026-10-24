// Trivia (quizzes with a pool of questions, live games, speed scoring, the top-3 block), end to end against a running dev server as temporary "ZZ" accounts.
// Everything made is deleted at the end (quizzes, their games, players and answers go with them).
// Run: BASE_URL=http://localhost:3101 node scripts/checks/trivia.mjs
import { createClient } from '@supabase/supabase-js';
import { accounts, svc, env, url, tracker } from './lib.mjs';

const t = tracker();
const { user, made, cleanup } = accounts('trivia');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  const host = await user('host', ['officer']);
  const guest = await user('guest', []);          // signed in, no role at all
  const players = [];
  for (let i = 1; i <= 4; i++) players.push(await user(`p${i}`, ['ucsd']));
  const [p1, p2, p3, p4] = players;

  // ---- who may do what
  t.ok('a plain member cannot see quizzes', (await guest.call('GET', '/api/trivia/quizzes')).s === 403 && (await p1.call('POST', '/api/trivia/quizzes', { name: 'ZZ no' })).s === 403);
  t.ok('a signed-out call is refused', (await fetch(`${process.env.BASE_URL}/api/trivia/quizzes`)).status === 401);
  const made1 = await host.call('POST', '/api/trivia/quizzes', { name: 'ZZ Trivia Night' });
  t.ok('an officer makes a quiz', made1.s === 201 && made1.j.quiz.slug === 'zz-trivia-night', JSON.stringify(made1.j));
  t.ok('the same name gets its own address', (await host.call('POST', '/api/trivia/quizzes', { name: 'ZZ Trivia Night' })).j.quiz?.slug === 'zz-trivia-night-2');
  const Q = made1.j.quiz.slug;
  const QU = `/api/trivia/quizzes/${Q}/questions`;

  // ---- the pool
  t.ok('a question needs four answers', (await host.call('POST', QU, { text: 'x', choices: ['a', 'b'] })).s === 400);
  t.ok('the right answer is one of four', (await host.call('POST', QU, { correct: 4 })).s === 400);
  t.ok('the time is bounded', (await host.call('POST', QU, { secs: 2 })).s === 400 && (await host.call('POST', QU, { secs: 500 })).s === 400);
  const blank = await host.call('POST', QU, {});
  t.ok('a blank question can be added, 20 seconds by default', blank.s === 201 && blank.j.questions[0].secs === 20 && blank.j.questions[0].choices.length === 4);
  const bulk = await host.call('POST', QU, { rows: Array.from({ length: 6 }, (_, i) => ({ text: `ZZ Question ${i + 1}`, choices: [`a${i}`, `b${i}`, `c${i}`, `d${i}`], correct: i % 4, secs: 15 })) });
  t.ok('questions can be added in bulk', bulk.s === 201 && bulk.j.questions.length === 6);
  const list = await host.call('GET', '/api/trivia/quizzes');
  const row = list.j.quizzes.find((q) => q.slug === Q);
  t.ok('the list counts the pool and the finished questions (the blank one is not finished)', row.questions === 7 && row.ready === 6, JSON.stringify(row));
  const edit = await host.call('PATCH', QU, { id: bulk.j.questions[0].id, text: 'ZZ Question 1 (edited)' });
  t.ok('a question can be edited', edit.s === 200 && edit.j.question.text.endsWith('(edited)'));
  t.ok('a quiz asks between 1 and 100 questions', (await host.call('PATCH', `/api/trivia/quizzes/${Q}`, { per_game: 0 })).s === 400 && (await host.call('PATCH', `/api/trivia/quizzes/${Q}`, { per_game: 4 })).j.quiz.per_game === 4);
  t.ok('a plain member cannot change the pool', (await p1.call('PATCH', QU, { id: bulk.j.questions[0].id, text: 'hack' })).s === 403);

  // ---- a game
  const g1 = await host.call('POST', '/api/trivia/games', { quiz: Q });
  t.ok('an officer opens a lobby with a 6-character code', g1.s === 201 && /^[A-Z2-9]{6}$/.test(g1.j.code) && g1.j.state.status === 'lobby', JSON.stringify(g1.j));
  const C = g1.j.code;
  const G = `/api/trivia/games/${C}`;
  t.ok('a plain member cannot open the host screen or control a game', (await p1.call('GET', G)).s === 403 && (await p1.call('POST', G, { action: 'start' })).s === 403);
  t.ok('a wrong code is refused', (await p1.call('POST', '/api/trivia/join', { code: 'ZZZZZZ' })).s === 404);
  t.ok('the game cannot start with nobody in', (await host.call('POST', G, { action: 'start' })).s === 409);

  // The live channel: a player's own login follows the game and sees the start the moment it happens.
  const watcher = createClient(url, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const got = [];
  const joined1 = await p1.call('POST', '/api/trivia/join', { code: C.toLowerCase() });
  t.ok('a member joins (the code in any capitals)', joined1.s === 200 && joined1.j.me.status === 'in' && joined1.j.state.players === 1, JSON.stringify(joined1.j));
  const gameId = joined1.j.state.gameId;
  const ch = watcher.channel(`trivia:${gameId}`, { config: { broadcast: { self: false } } });
  ch.on('broadcast', { event: 'state' }, (m) => got.push({ at: Date.now(), p: m.payload }));
  ch.on('broadcast', { event: 'count' }, (m) => got.push({ at: Date.now(), count: m.payload }));
  await new Promise((res) => ch.subscribe((s) => { if (s === 'SUBSCRIBED') res(); }));
  for (const p of [p2, p3, p4]) await p.call('POST', '/api/trivia/join', { code: C });
  t.ok('joining twice keeps one player', (await p1.call('POST', '/api/trivia/join', { code: C })).j.state.players === 4);
  const lobby = (await host.call('GET', G)).j;
  t.ok('the host sees the lobby and how many questions the pool can give', lobby.players.length === 4 && lobby.ready === 6 && lobby.perGame === 4, JSON.stringify([lobby.players.length, lobby.ready, lobby.perGame]));
  t.ok('a player cannot tell a pool question from the lobby', (await p2.call('GET', `/api/trivia/play/${C}`)).j.state.question === undefined);
  t.ok('the number of questions can be set in the lobby', (await host.call('POST', G, { action: 'count', count: 3 })).s === 200 && (await host.call('GET', G)).j.perGame === 3 && (await host.call('POST', G, { action: 'count', count: 0 })).s === 400);
  t.ok('someone who has not joined cannot see the game from the inside', (await guest.call('GET', `/api/trivia/play/${C}`)).s === 404);

  // removing and letting back in
  await guest.call('POST', `/api/trivia/play/${C}/answer`, { q: 0, pos: 0 });   // (a first call compiles the route on a dev server; keep that out of the timed part)
  await p1.call('GET', `/api/trivia/play/${C}`);
  t.ok('the host removes a player', (await host.call('POST', G, { action: 'remove', user_id: p4.id })).s === 200 && (await p4.call('GET', `/api/trivia/play/${C}`)).j.me.status === 'removed');
  t.ok('a removed player stays out when joining again', (await p4.call('POST', '/api/trivia/join', { code: C })).j.me.status === 'removed' && (await p4.call('POST', `/api/trivia/play/${C}/answer`, { q: 0, pos: 0 })).s === 409);
  t.ok('the host lets them back in', (await host.call('POST', G, { action: 'allow', user_id: p4.id })).s === 200 && (await p4.call('GET', `/api/trivia/play/${C}`)).j.me.status === 'in');

  // ---- play: 3 questions
  const startAt = Date.now();
  const st = await host.call('POST', G, { action: 'start', count: 3 });
  t.ok('the host starts the game', st.s === 200, JSON.stringify(st.j));
  await sleep(1200);
  const live = got.find((m) => m.p?.status === 'question');
  t.ok('the start reaches a watching phone through the live channel in about a second', !!live && live.at - startAt < 2500, `${got.length} ${live ? live.at - startAt : 'none'}`);
  const state1 = (await p1.call('GET', `/api/trivia/play/${C}`)).j;
  const showing = JSON.stringify(state1.state);
  t.ok('the question is shown with four answers and 3 in the game, the right one not revealed', state1.state.status === 'question' && state1.state.question.choices.length === 4 && state1.state.total === 3 && !/"correct"/.test(showing) && state1.state.reveal === undefined, showing.slice(0, 300));
  t.ok('the game says a started game cannot be started again', (await host.call('POST', G, { action: 'start' })).s === 409);

  // The right answer for each drawn question, from the database (what the host would see at the reveal).
  const plan = (await svc.from('trivia_games').select('plan').eq('code', C).single()).data.plan;
  t.ok('a game draws 3 distinct finished questions', plan.length === 3 && new Set(plan.map((q) => q.id)).size === 3 && plan.every((q) => q.text.startsWith('ZZ') && new Set(q.choices).size === 4));
  const A = `/api/trivia/play/${C}/answer`;
  const right = (n) => plan[n].correct, wrong = (n) => (plan[n].correct + 1) % 4;

  // question 0: p1 right at once, p2 right after 2s, p3 wrong, p4 does not answer
  const a1 = await p1.call('POST', A, { q: 0, pos: right(0) });
  await sleep(2000);
  const a2 = await p2.call('POST', A, { q: 0, pos: right(0) });
  const a3 = await p3.call('POST', A, { q: 0, pos: wrong(0) });
  t.ok('answers are taken', a1.j.ok && a2.j.ok && a3.j.ok, JSON.stringify([a1, a2, a3]));
  t.ok('someone who has not joined cannot answer', (await guest.call('POST', A, { q: 0, pos: 0 })).s === 403);
  t.ok('a second answer is ignored, the first stands', (await p1.call('POST', A, { q: 0, pos: wrong(0) })).j.pos === right(0));
  t.ok('an answer for another question is refused', (await p3.call('POST', A, { q: 1, pos: 0 })).s === 409 && (await p3.call('POST', A, { q: 0, pos: 9 })).s === 400);
  t.ok('a player sees their answer is locked after a refresh', (await p1.call('GET', `/api/trivia/play/${C}`)).j.me.answered === right(0));
  const cnt = got.filter((m) => m.count).map((m) => m.count.answered);
  t.ok('the answered count goes out as people answer', cnt.length >= 3 && Math.max(...cnt) === 3, JSON.stringify(cnt));
  const rows0 = (await svc.from('trivia_answers').select('user_id, ok, points, ms').eq('game_id', gameId).eq('q_index', 0)).data;
  const pt = (u) => rows0.find((r) => r.user_id === u.id);
  t.ok('a right answer earns 500 to 1000, faster earns more, wrong earns 0', pt(p1).points > pt(p2).points && pt(p2).points >= 500 && pt(p1).points <= 1000 && pt(p3).points === 0 && !pt(p3).ok, JSON.stringify(rows0));
  const rev = await host.call('POST', G, { action: 'reveal' });
  t.ok('the host reveals the answer', rev.s === 200);
  t.ok('revealing twice is refused', (await host.call('POST', G, { action: 'reveal' })).s === 409);
  const afterRev = (await p4.call('GET', `/api/trivia/play/${C}`)).j.state;
  t.ok('the reveal shows the right answer, how many chose what, the top, and each person\'s result', afterRev.status === 'reveal' && afterRev.reveal.correct === right(0) && afterRev.reveal.counts[right(0)] === 2 && afterRev.reveal.counts.reduce((a, b) => a + b, 0) === 3 && afterRev.reveal.top[0].rank === 1 && afterRev.reveal.results[p3.id].ok === false && afterRev.reveal.results[p1.id].ok === true && afterRev.reveal.results[p4.id].pos === null, JSON.stringify(afterRev.reveal).slice(0, 400));
  t.ok('nobody can answer after the reveal', (await p4.call('POST', A, { q: 0, pos: 0 })).s === 409);
  t.ok('next goes to the second question, one cannot skip a reveal', (await host.call('POST', G, { action: 'next' })).s === 200 && (await host.call('POST', G, { action: 'next' })).s === 409);

  // question 1: p2 right, p1 right later, p3 right; p4 wrong
  await p2.call('POST', A, { q: 1, pos: right(1) });
  await p3.call('POST', A, { q: 1, pos: right(1) });
  await p4.call('POST', A, { q: 1, pos: wrong(1) });
  await sleep(1500);
  await p1.call('POST', A, { q: 1, pos: right(1) });
  await host.call('POST', G, { action: 'reveal' });
  await host.call('POST', G, { action: 'next' });
  // question 2: the clock runs out: an answer well after it is refused
  await p1.call('POST', A, { q: 2, pos: right(2) });
  await sleep((plan[2].secs + 2) * 1000);
  t.ok('an answer after the time is refused', (await p2.call('POST', A, { q: 2, pos: right(2) })).s === 409);
  await host.call('POST', G, { action: 'reveal' });
  const last = await host.call('POST', G, { action: 'next' });
  t.ok('after the last question the game ends', last.s === 200 && (await host.call('GET', G)).j.state.status === 'done');
  const fin = (await p1.call('GET', `/api/trivia/play/${C}`)).j.state;
  t.ok('the podium has the top three in order, with every player\'s rank', fin.status === 'done' && fin.reveal.final === true && fin.reveal.top.length === 3 && fin.reveal.top[0].score >= fin.reveal.top[1].score && fin.reveal.top[1].score >= fin.reveal.top[2].score && fin.reveal.of === 4 && Object.keys(fin.reveal.results).length === 4, JSON.stringify(fin.reveal));
  const winners = (await svc.from('trivia_winners').select('user_id, rank').eq('game_id', gameId).order('rank')).data;
  const standings = (await host.call('GET', `${G}?results=1`)).j.results;
  t.ok('exactly three winners are recorded, the top three of the leaderboard', winners.length === 3 && winners.every((w, i) => w.user_id === standings.standings[i].id), JSON.stringify([winners, standings.standings.map((s) => [s.name, s.score])]));
  t.ok('results show per-question counts', standings.questions.length === 3 && standings.questions[0].counts.reduce((a, b) => a + b, 0) === 3);
  t.ok('nobody can join a finished game', (await guest.call('POST', '/api/trivia/join', { code: C })).s === 409);
  const mine = (await p1.call('GET', '/api/trivia/mine')).j.games;
  t.ok('a player sees their finished game with their place', mine.length === 1 && mine[0].status === 'done' && mine[0].rank >= 1 && mine[0].of === 4, JSON.stringify(mine));

  // ---- the top three cannot come back to this quiz
  const winnerIds = new Set(winners.map((w) => w.user_id));
  const loser = players.find((p) => !winnerIds.has(p.id));
  const winner = players.find((p) => winnerIds.has(p.id));
  const g2 = await host.call('POST', '/api/trivia/games', { quiz: Q });
  const C2 = g2.j.code, G2 = `/api/trivia/games/${C2}`;
  const wj = await winner.call('POST', '/api/trivia/join', { code: C2 });
  t.ok('a top three player joining the same quiz again is held back', wj.j.me.status === 'blocked' && wj.j.state.players === 0, JSON.stringify(wj.j));
  t.ok('a player outside the top three joins freely', (await loser.call('POST', '/api/trivia/join', { code: C2 })).j.me.status === 'in');
  const lob2 = (await host.call('GET', G2)).j;
  t.ok('the host sees them as not in, to be let in', lob2.players.find((p) => p.id === winner.id)?.status === 'blocked');
  t.ok('a held back player cannot answer or start anything', (await winner.call('POST', `/api/trivia/play/${C2}/answer`, { q: 0, pos: 0 })).s === 409 && (await winner.call('POST', G2, { action: 'start' })).s === 403);
  t.ok('the host can let them in', (await host.call('POST', G2, { action: 'allow', user_id: winner.id })).s === 200 && (await winner.call('GET', `/api/trivia/play/${C2}`)).j.me.status === 'in');
  // questions asked before come last
  await host.call('POST', G2, { action: 'count', count: 3 });
  t.ok('the second game starts', (await host.call('POST', G2, { action: 'start', count: 3 })).s === 200);
  const plan2 = (await svc.from('trivia_games').select('plan').eq('code', C2).single()).data.plan;
  const used = new Set(plan.map((q) => q.id));
  t.ok('the second game draws the three questions the first did not use', plan2.length === 3 && plan2.every((q) => !used.has(q.id)), JSON.stringify([plan.map((q) => q.text), plan2.map((q) => q.text)]));
  t.ok('a running game cannot be deleted', (await host.call('DELETE', G2)).s === 409);
  t.ok('the host can end a game early', (await host.call('POST', G2, { action: 'end' })).s === 200 && (await host.call('GET', G2)).j.state.status === 'done');

  // ---- practice: nothing blocked, nothing kept
  const gp = await host.call('POST', '/api/trivia/games', { quiz: Q, practice: true });
  const CP = gp.j.code;
  t.ok('a past top three player joins a practice game freely', (await winner.call('POST', '/api/trivia/join', { code: CP })).j.me.status === 'in');
  await host.call('POST', `/api/trivia/games/${CP}`, { action: 'start', count: 1 });
  const planP = (await svc.from('trivia_games').select('plan').eq('code', CP).single()).data.plan;
  await winner.call('POST', `/api/trivia/play/${CP}/answer`, { q: 0, pos: planP[0].correct });
  await host.call('POST', `/api/trivia/games/${CP}`, { action: 'end' });
  const gpId = (await svc.from('trivia_games').select('id').eq('code', CP).single()).data.id;
  t.ok('a practice game records no winners', (await svc.from('trivia_winners').select('user_id', { count: 'exact', head: true }).eq('game_id', gpId)).count === 0);
  t.ok('a practice game is left out of the history and of a player\'s games', !(await host.call('GET', '/api/trivia/games')).j.games.some((g) => g.code === CP) && !(await winner.call('GET', '/api/trivia/mine')).j.games.some((g) => g.code === CP));

  // ---- deleting a game frees its winners
  t.ok('a finished game can be deleted', (await host.call('DELETE', G)).s === 200 && (await svc.from('trivia_winners').select('user_id', { count: 'exact', head: true }).eq('game_id', gameId)).count === 0);
  const g3 = await host.call('POST', '/api/trivia/games', { quiz: Q });
  t.ok('with the game deleted its top three are free to join again', (await winner.call('POST', '/api/trivia/join', { code: g3.j.code })).j.me.status === 'in');
  t.ok('a lobby can be closed', (await host.call('DELETE', `/api/trivia/games/${g3.j.code}`)).s === 200);
  const history = (await host.call('GET', '/api/trivia/games')).j.games;
  t.ok('the history lists the finished game with its winners', history.some((g) => g.code === C2 && g.status === 'done'));

  // ---- deleting a quiz takes everything with it
  t.ok('a plain member cannot delete a quiz', (await p1.call('DELETE', `/api/trivia/quizzes/${Q}`)).s === 403);
  t.ok('an officer deletes the quiz', (await host.call('DELETE', `/api/trivia/quizzes/${Q}`)).s === 200);
  const qid = made1.j.quiz.id;
  const left = await Promise.all(['trivia_questions', 'trivia_games', 'trivia_winners'].map(async (tb) => (await svc.from(tb).select('*', { count: 'exact', head: true }).eq('quiz_id', qid)).count));
  t.ok('its questions, games and winners are gone', left.every((n) => n === 0), JSON.stringify(left));
  await watcher.removeAllChannels();
} finally {
  const zz = (await svc.from('trivia_quizzes').select('id').like('name', 'ZZ%')).data ?? [];
  if (zz.length) await svc.from('trivia_quizzes').delete().in('id', zz.map((q) => q.id));
  await svc.from('audit_log').delete().in('actor_id', made);
  await svc.from('notifications').delete().in('user_id', made);
  await cleanup();
}
process.exit(t.result());
